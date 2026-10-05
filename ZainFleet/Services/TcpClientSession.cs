using System.Net.Sockets;
using ZainFleet.Protocol;

namespace ZainFleet.Services;

internal static class TcpClientSession
{
    public static async Task RunAsync(
        TcpClient client, int timeoutSeconds, int maxPacketBytes, DeviceManager devices,
        ITeltonikaPacketParser parser, ILogger logger, CancellationToken cancellationToken)
    {
        var remote = client.Client.RemoteEndPoint;
        logger.LogInformation("DEVICE CONNECTED {Remote}", remote);
        string? imei = null;
        try
        {
            var stream = client.GetStream();
            var timeout = TimeSpan.FromSeconds(timeoutSeconds);
            imei = await TeltonikaProtocol.ReadImeiAsync(stream, timeout, cancellationToken);
            if (imei is null)
                return;

            await stream.WriteAsync(TeltonikaProtocol.CreateImeiResponse(true), cancellationToken);
            devices.Connected(imei);
            logger.LogInformation("DEVICE IMEI {Imei} connected from {Remote}", imei, remote);

            while (!cancellationToken.IsCancellationRequested)
            {
                var frame = await TeltonikaProtocol.ReadFrameAsync(stream, maxPacketBytes, timeout, cancellationToken);
                if (frame is null)
                    break;

                logger.LogInformation("PACKET RECEIVED {Imei} {Bytes} bytes", imei, frame.DataField.Length);
                var packet = parser.Parse(frame);
                foreach (var record in packet.Records)
                    await devices.RecordAsync(imei, record, cancellationToken);

                logger.LogInformation("AVL RECORDS {Imei}: {Count} (Codec 0x{Codec:X2})", imei, packet.Records.Count, packet.CodecId);
                var acknowledgement = TeltonikaProtocol.CreateAvlAcknowledgement(packet.Records.Count);
                await stream.WriteAsync(acknowledgement, cancellationToken);
                logger.LogInformation("PACKET ACK {Imei}: {Count} records", imei, packet.Records.Count);
            }
        }
        finally
        {
            if (imei is not null)
            {
                devices.Disconnected(imei);
                logger.LogInformation("DEVICE DISCONNECTED {Imei}", imei);
            }
            else
            {
                logger.LogInformation("DEVICE DISCONNECTED {Remote}", remote);
            }
        }
    }
}