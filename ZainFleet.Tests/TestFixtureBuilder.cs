using System.Buffers.Binary;
using ZainFleet.Protocol;

namespace ZainFleet.Tests;

internal static class TestFixtureBuilder
{
    public static byte[] Codec8Packet()
    {
        var data = new List<byte> { 0x08, 1 };
        AddRecordHeader(data);
        data.AddRange([0x07, 1, 1, 0x01, 0x2A, 0, 0, 0, 0]);
        data.Add(1);
        return Frame(data.ToArray());
    }

    public static byte[] Codec8ExtendedPacket()
    {
        var data = new List<byte> { 0x8E, 0, 1 };
        AddRecordHeader(data);
        data.AddRange([0, 0x2A, 0, 2, 1, 0, 1, 0x01, 0, 0, 0, 1, 0, 2, 0, 2, 0xAB, 0xCD]);
        data.AddRange([0, 1]);
        return Frame(data.ToArray());
    }

    private static void AddRecordHeader(List<byte> data)
    {
        var timestamp = (ulong)DateTimeOffset.FromUnixTimeMilliseconds(1_700_000_000_000).ToUnixTimeMilliseconds();
        Span<byte> buffer = stackalloc byte[8];
        BinaryPrimitives.WriteUInt64BigEndian(buffer, timestamp);
        data.AddRange(buffer.ToArray());
        data.Add(2);
        AddInt32(data, -1_234_567);
        AddInt32(data, 5_432_100);
        AddInt16(data, 120);
        AddUInt16(data, 90);
        data.Add(8);
        AddUInt16(data, 42);
    }

    private static byte[] Frame(byte[] data)
    {
        var frame = new byte[8 + data.Length + 4];
        BinaryPrimitives.WriteUInt32BigEndian(frame.AsSpan(4), (uint)data.Length);
        data.CopyTo(frame, 8);
        BinaryPrimitives.WriteUInt32BigEndian(frame.AsSpan(8 + data.Length), TeltonikaCrc16.Compute(data));
        return frame;
    }

    private static void AddInt32(List<byte> data, int value)
    {
        Span<byte> bytes = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(bytes, value);
        data.AddRange(bytes.ToArray());
    }

    private static void AddInt16(List<byte> data, short value)
    {
        Span<byte> bytes = stackalloc byte[2];
        BinaryPrimitives.WriteInt16BigEndian(bytes, value);
        data.AddRange(bytes.ToArray());
    }

    private static void AddUInt16(List<byte> data, ushort value)
    {
        Span<byte> bytes = stackalloc byte[2];
        BinaryPrimitives.WriteUInt16BigEndian(bytes, value);
        data.AddRange(bytes.ToArray());
    }
}
