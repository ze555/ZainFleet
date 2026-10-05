using System.Buffers.Binary;

namespace ZainFleet.Protocol;

public static class TeltonikaProtocol
{
    public static byte[] CreateImeiResponse(bool accepted) => [accepted ? (byte)1 : (byte)0];

    public static byte[] CreateAvlAcknowledgement(int recordCount)
    {
        if (recordCount is < 0 or > ushort.MaxValue)
            throw new ArgumentOutOfRangeException(nameof(recordCount));

        var response = new byte[4];
        BinaryPrimitives.WriteInt32BigEndian(response, recordCount);
        return response;
    }

    public static async ValueTask<string?> ReadImeiAsync(Stream stream, TimeSpan idleTimeout, CancellationToken cancellationToken)
    {
        var lengthBytes = new byte[2];
        if (!await ReadExactlyAsync(stream, lengthBytes, allowInitialEof: true, idleTimeout, cancellationToken))
            return null;

        var length = BinaryPrimitives.ReadUInt16BigEndian(lengthBytes);
        if (length != 15)
        {
            await stream.WriteAsync(CreateImeiResponse(false), cancellationToken);
            throw new InvalidDataException($"Unsupported IMEI length: {length}.");
        }

        var payload = new byte[length];
        await ReadExactlyAsync(stream, payload, allowInitialEof: false, idleTimeout, cancellationToken);
        if (!TeltonikaImeiParser.TryParse(payload, out var imei))
        {
            await stream.WriteAsync(CreateImeiResponse(false), cancellationToken);
            throw new InvalidDataException("IMEI must contain exactly 15 ASCII digits.");
        }

        return imei;
    }

    public static async ValueTask<TeltonikaFrame?> ReadFrameAsync(
        Stream stream, int maximumDataFieldLength, TimeSpan idleTimeout, CancellationToken cancellationToken)
    {
        var header = new byte[8];
        if (!await ReadExactlyAsync(stream, header, allowInitialEof: true, idleTimeout, cancellationToken))
            return null;

        if (header[0] != 0 || header[1] != 0 || header[2] != 0 || header[3] != 0)
            throw new InvalidDataException("AVL packet preamble is not zero.");

        var dataLength = BinaryPrimitives.ReadUInt32BigEndian(header.AsSpan(4));
        if (dataLength < 3 || dataLength > maximumDataFieldLength)
            throw new InvalidDataException($"Invalid AVL data-field length: {dataLength}.");

        var tail = new byte[checked((int)dataLength + 4)];
        await ReadExactlyAsync(stream, tail, allowInitialEof: false, idleTimeout, cancellationToken);
        var dataFieldLength = (int)dataLength;
        var dataField = tail[..dataFieldLength];
        var transmittedCrc = BinaryPrimitives.ReadUInt32BigEndian(tail.AsSpan(dataFieldLength));
        if (transmittedCrc > ushort.MaxValue || transmittedCrc != TeltonikaCrc16.Compute(dataField))
            throw new InvalidDataException("AVL packet CRC-16/IBM validation failed.");

        return new TeltonikaFrame(dataField);
    }

    private static async ValueTask<bool> ReadExactlyAsync(
        Stream stream, Memory<byte> destination, bool allowInitialEof, TimeSpan idleTimeout, CancellationToken cancellationToken)
    {
        var offset = 0;
        while (offset < destination.Length)
        {
            using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutSource.CancelAfter(idleTimeout);
            int read;
            try
            {
                read = await stream.ReadAsync(destination[offset..], timeoutSource.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                throw new TimeoutException("TCP connection was idle beyond the configured timeout.");
            }

            if (read == 0)
            {
                if (allowInitialEof && offset == 0)
                    return false;
                throw new EndOfStreamException("Connection closed in the middle of a Teltonika packet.");
            }

            offset += read;
        }

        return true;
    }
}