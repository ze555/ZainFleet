using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

// Simple background TCP listener that reads newline-terminated JSON payloads,
// attempts to parse them, logs the payload, and replies with a JSON status.
public class TcpJsonListener : BackgroundService
{
    private readonly IConfiguration _config;
    private readonly ILogger<TcpJsonListener> _logger;

    public TcpJsonListener(IConfiguration config, ILogger<TcpJsonListener> logger)
    {
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var port = _config.GetValue<int?>("TcpPort") ?? 5000;
        var listener = new TcpListener(IPAddress.Any, port);
        listener.Start();
        _logger.LogInformation("TCP JSON listener started on port {Port}", port);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                TcpClient client;
                try
                {
                    client = await listener.AcceptTcpClientAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                _ = HandleClientAsync(client, stoppingToken);
            }
        }
        catch (Exception ex) when (!(ex is OperationCanceledException))
        {
            _logger.LogError(ex, "Listener error");
        }
        finally
        {
            try { listener.Stop(); } catch { }
            _logger.LogInformation("TCP listener stopped");
        }
    }

    private async Task HandleClientAsync(TcpClient client, CancellationToken ct)
    {
        _logger.LogInformation("Client connected: {RemoteEndPoint}", client.Client.RemoteEndPoint);
        using (client)
        {
            var stream = client.GetStream();
            using var ms = new MemoryStream();
            var buffer = new byte[4096];

            try
            {
                // Read until newline or connection close
                while (!ct.IsCancellationRequested)
                {
                    var bytesRead = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), ct);
                    if (bytesRead == 0) break; // client closed
                    ms.Write(buffer, 0, bytesRead);
                    if (Array.IndexOf(buffer, (byte)'\n', 0, bytesRead) >= 0) break;
                }

                var payload = Encoding.UTF8.GetString(ms.ToArray()).Trim();
                _logger.LogDebug("Received payload: {Payload}", payload);

                if (!string.IsNullOrWhiteSpace(payload))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(payload);
                        // TODO: replace with real processing (DB, queue, etc.)
                        _logger.LogInformation("Received JSON with root element kind {Kind} from {Remote}", doc.RootElement.ValueKind, client.Client.RemoteEndPoint);
                    }
                    catch (JsonException jex)
                    {
                        _logger.LogWarning(jex, "Invalid JSON received: {Payload}", payload);
                    }
                }

                var response = JsonSerializer.Serialize(new { status = "ok" }) + "\n";
                var respBytes = Encoding.UTF8.GetBytes(response);
                await stream.WriteAsync(respBytes.AsMemory(0, respBytes.Length), ct);
                await stream.FlushAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling client");
                try
                {
                    var err = JsonSerializer.Serialize(new { status = "error", message = ex.Message }) + "\n";
                    var errBytes = Encoding.UTF8.GetBytes(err);
                    await stream.WriteAsync(errBytes.AsMemory(0, errBytes.Length), CancellationToken.None);
                }
                catch { }
            }
        }

        _logger.LogInformation("Client disconnected");
    }
}
