using System.Collections.Concurrent;
using ZainFleet.Models;

namespace ZainFleet.Repositories;

public sealed class InMemoryTelemetryRepository : ITelemetryRepository
{
    private readonly ConcurrentDictionary<string, TelemetrySnapshot> _latest = new(StringComparer.Ordinal);

    public ValueTask StoreAsync(string imei, AvlRecord record, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _latest[imei] = new TelemetrySnapshot(imei, record, DateTimeOffset.UtcNow);
        return ValueTask.CompletedTask;
    }

    public ValueTask<TelemetrySnapshot?> GetLatestAsync(string imei, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _latest.TryGetValue(imei, out var snapshot);
        return ValueTask.FromResult(snapshot);
    }
}