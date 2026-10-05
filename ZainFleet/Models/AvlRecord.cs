namespace ZainFleet.Models;

public sealed record IoElement(ushort Id, string Value, int ByteLength);

public sealed record AvlRecord(
    DateTimeOffset Timestamp,
    byte Priority,
    double Longitude,
    double Latitude,
    short Altitude,
    ushort Angle,
    byte Satellites,
    ushort Speed,
    ushort EventIoId,
    IReadOnlyList<IoElement> IoElements);

public sealed record DeviceInfo(string Imei, DateTimeOffset FirstSeen, DateTimeOffset LastSeen, bool Connected);

public sealed record TelemetrySnapshot(string Imei, AvlRecord Record, DateTimeOffset ReceivedAt);