using ZainFleet.Models;

namespace ZainFleet.Repositories;

public interface ITelemetryRepository
{
    ValueTask StoreAsync(string imei, AvlRecord record, CancellationToken cancellationToken = default);
    ValueTask<TelemetrySnapshot?> GetLatestAsync(string imei, CancellationToken cancellationToken = default);
}