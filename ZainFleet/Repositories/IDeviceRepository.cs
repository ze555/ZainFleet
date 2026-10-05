using ZainFleet.Models;

namespace ZainFleet.Repositories;

public interface IDeviceRepository
{
    DeviceInfo Upsert(string imei, DateTimeOffset seenAt, bool connected);
    DeviceInfo? Get(string imei);
    IReadOnlyCollection<DeviceInfo> GetAll();
}