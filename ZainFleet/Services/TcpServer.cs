using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using Microsoft.Extensions.Hosting;
using ZainFleet.Protocol;

namespace ZainFleet.Services;

public sealed class TcpServer(
    IConfiguration configuration,
    ILogger<TcpServer> logger,
    DeviceManager devices,
    ITeltonikaPacketParser parser) : BackgroundService
{
    private readonly ConcurrentDictionary<long, Task> _sessions = new();
    private long _sessionId;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var port = ReadInt("TCP_PORT", 5000, 1, 65535);
        var timeoutSeconds = ReadInt("TCP_IDLE_TIMEOUT_SECONDS", 300, 1, 86400);
        var maxPacketBytes = ReadInt("TCP_MAX_PACKET_BYTES", 1_048_576, 3, 16_777_216);
        var maximumSessions = ReadInt("TCP_MAX_SESSIONS", 1000, 1, 100_000);
        using var capacity = new SemaphoreSlim(maximumSessions, maximumSessions);
        var listener = new TcpListener(IPAddress.Any, port);
        listener.Start();
        logger.LogInformation("Teltonika TCP listener started on 0.0.0.0:{Port}", port);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await capacity.WaitAsync(stoppingToken);
                TcpClient client;
                try
                {
                    client = await listener.AcceptTcpClientAsync(stoppingToken);
                }
                catch
                {
                    capacity.Release();
                    throw;
                }

                client.NoDelay = true;
                var id = Interlocked.Increment(ref _sessionId);
                var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                _sessions[id] = completion.Task;
                _ = HandleAndTrackAsync(id, client, timeoutSeconds, maxPacketBytes, stoppingToken, completion, capacity);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (ObjectDisposedException) when (stoppingToken.IsCancellationRequested)
        {
        }
        finally
        {
            listener.Stop();
            await Task.WhenAll(_sessions.Values);
            logger.LogInformation("Teltonika TCP listener stopped");
        }
    }

    private async Task HandleAndTrackAsync(
        long id, TcpClient client, int timeoutSeconds, int maxPacketBytes, CancellationToken cancellationToken,
        TaskCompletionSource completion, SemaphoreSlim capacity)
    {
        try
        {
            await TcpClientSession.RunAsync(client, timeoutSeconds, maxPacketBytes, devices, parser, logger, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (TimeoutException ex)
        {
            logger.LogInformation("DEVICE TIMEOUT {Remote}: {Message}", client.Client.RemoteEndPoint, ex.Message);
        }
        catch (InvalidDataException ex)
        {
            logger.LogWarning("PARSE ERROR {Remote}: {Message}", client.Client.RemoteEndPoint, ex.Message);
        }
        catch (IOException ex)
        {
            logger.LogDebug("TCP session ended for {Remote}: {Message}", client.Client.RemoteEndPoint, ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "TCP session failed for {Remote}", client.Client.RemoteEndPoint);
        }
        finally
        {
            client.Dispose();
            _sessions.TryRemove(id, out _);
            capacity.Release();
            completion.TrySetResult();
        }
    }

    private int ReadInt(string name, int fallback, int minimum, int maximum)
    {
        var raw = Environment.GetEnvironmentVariable(name) ?? configuration[name];
        if (string.IsNullOrWhiteSpace(raw))
            return fallback;
        if (!int.TryParse(raw, out var value) || value < minimum || value > maximum)
            throw new InvalidOperationException($"{name} must be between {minimum} and {maximum}.");
        return value;
    }
}