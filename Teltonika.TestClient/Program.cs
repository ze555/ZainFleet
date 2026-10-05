using System.Buffers.Binary;
using System.Net.Sockets;
using System.Text;
using ZainFleet.Protocol;

if (args.Length != 3 || !int.TryParse(args[1], out var port) || port is < 1 or > 65535 ||
    !TeltonikaImeiParser.TryParse(Encoding.ASCII.GetBytes(args[2]), out var imei))
{
    Console.Error.WriteLine("Usage: Teltonika.TestClient <host> <port> <15-digit-test-imei>");
    return 2;
}

Console.WriteLine("TEST FIXTURE ONLY: sending a generated Codec 8 record with zero coordinates.");
using var client = new TcpClient { NoDelay = true };
using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(15));
await client.ConnectAsync(args[0], port, cancellation.Token);
var stream = client.GetStream();
var imeiBytes = Encoding.ASCII.GetBytes(imei);
var handshake = new byte[2 + imeiBytes.Length];
BinaryPrimitives.WriteUInt16BigEndian(handshake, (ushort)imeiBytes.Length);
imeiBytes.CopyTo(handshake, 2);
await stream.WriteAsync(handshake, cancellation.Token);

var response = new byte[1];
await ReadExactlyAsync(stream, response, cancellation.Token);
if (response[0] != 1)
    throw new InvalidDataException("Server rejected the test IMEI.");

var packet = BuildTestFixturePacket();
await stream.WriteAsync(packet, cancellation.Token);
var acknowledgement = new byte[4];
await ReadExactlyAsync(stream, acknowledgement, cancellation.Token);
Console.WriteLine($"TEST FIXTURE ACK received: {BinaryPrimitives.ReadInt32BigEndian(acknowledgement)} record(s).");
return 0;

static async Task ReadExactlyAsync(NetworkStream stream, Memory<byte> buffer, CancellationToken cancellationToken)
{
    var offset = 0;
    while (offset < buffer.Length)
    {
        var read = await stream.ReadAsync(buffer[offset..], cancellationToken);
        if (read == 0)
            throw new EndOfStreamException("Server disconnected before completing the ACK.");
        offset += read;
    }
}

static byte[] BuildTestFixturePacket()
{
    var data = new List<byte> { 0x08, 1 };
    Span<byte> timestamp = stackalloc byte[8];
    BinaryPrimitives.WriteUInt64BigEndian(timestamp, (ulong)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    data.AddRange(timestamp.ToArray());
    data.Add(1);
    AddInt32(data, 0);
    AddInt32(data, 0);
    AddInt16(data, 0);
    AddUInt16(data, 0);
    data.Add(0);
    AddUInt16(data, 0);
    data.AddRange([0, 0, 0, 0, 0, 0, 0]);
    data.Add(1);

    var packet = new byte[8 + data.Count + 4];
    BinaryPrimitives.WriteUInt32BigEndian(packet.AsSpan(4), (uint)data.Count);
    data.CopyTo(packet, 8);
    BinaryPrimitives.WriteUInt32BigEndian(packet.AsSpan(8 + data.Count), TeltonikaCrc16.Compute(data.ToArray()));
    return packet;
}

static void AddInt32(List<byte> data, int value)
{
    Span<byte> bytes = stackalloc byte[4];
    BinaryPrimitives.WriteInt32BigEndian(bytes, value);
    data.AddRange(bytes.ToArray());
}

static void AddInt16(List<byte> data, short value)
{
    Span<byte> bytes = stackalloc byte[2];
    BinaryPrimitives.WriteInt16BigEndian(bytes, value);
    data.AddRange(bytes.ToArray());
}

static void AddUInt16(List<byte> data, ushort value)
{
    Span<byte> bytes = stackalloc byte[2];
    BinaryPrimitives.WriteUInt16BigEndian(bytes, value);
    data.AddRange(bytes.ToArray());
}
