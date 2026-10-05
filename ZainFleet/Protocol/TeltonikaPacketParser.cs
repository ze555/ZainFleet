using ZainFleet.Models;

namespace ZainFleet.Protocol;

public sealed class TeltonikaPacketParser : ITeltonikaPacketParser
{
    private readonly IReadOnlyDictionary<byte, ICodecAvlDecoder> _decoders = new Dictionary<byte, ICodecAvlDecoder>
    {
        [0x08] = new Codec8AvlDecoder(),
        [0x8E] = new Codec8ExtendedAvlDecoder()
    };

    public ParsedAvlPacket Parse(TeltonikaFrame frame)
    {
        var reader = new AvlDataReader(frame.DataField);
        var codecId = reader.ReadByte();
        if (!_decoders.TryGetValue(codecId, out var decoder))
            throw new InvalidDataException($"Unsupported Teltonika codec: 0x{codecId:X2}.");

        var recordCount = decoder.ReadCount(reader);
        var records = new List<AvlRecord>(recordCount);
        for (var i = 0; i < recordCount; i++)
            records.Add(decoder.ReadRecord(reader));

        if (decoder.ReadCount(reader) != recordCount || reader.Remaining != 0)
            throw new InvalidDataException("AVL record counts or packet length do not match.");

        return new ParsedAvlPacket(codecId, records);
    }

    private interface ICodecAvlDecoder
    {
        ushort ReadCount(AvlDataReader reader);
        AvlRecord ReadRecord(AvlDataReader reader);
    }

    private abstract class CodecAvlDecoder : ICodecAvlDecoder
    {
        public abstract ushort ReadCount(AvlDataReader reader);
        protected abstract IoData ReadIo(AvlDataReader reader);

        public AvlRecord ReadRecord(AvlDataReader reader)
        {
            var timestampValue = reader.ReadUInt64();
            if (timestampValue > long.MaxValue)
                throw new InvalidDataException("AVL timestamp is out of range.");

            var timestamp = DateTimeOffset.FromUnixTimeMilliseconds((long)timestampValue);
            var priority = reader.ReadByte();
            var longitude = reader.ReadInt32() / 10_000_000d;
            var latitude = reader.ReadInt32() / 10_000_000d;
            var altitude = reader.ReadInt16();
            var angle = reader.ReadUInt16();
            var satellites = reader.ReadByte();
            var speed = reader.ReadUInt16();
            var io = ReadIo(reader);
            return new AvlRecord(timestamp, priority, longitude, latitude, altitude, angle, satellites, speed,
                io.EventIoId, io.Elements);
        }
    }

    private sealed class Codec8AvlDecoder : CodecAvlDecoder
    {
        public override ushort ReadCount(AvlDataReader reader) => reader.ReadByte();
        protected override IoData ReadIo(AvlDataReader reader) => ReadCodec8Io(reader);
    }

    private sealed class Codec8ExtendedAvlDecoder : CodecAvlDecoder
    {
        public override ushort ReadCount(AvlDataReader reader) => reader.ReadUInt16();
        protected override IoData ReadIo(AvlDataReader reader) => ReadCodec8ExtendedIo(reader);
    }

    private sealed record IoData(ushort EventIoId, IReadOnlyList<IoElement> Elements);

    private static IoData ReadCodec8Io(AvlDataReader reader)
    {
        var eventId = reader.ReadByte();
        var total = reader.ReadByte();
        var values = new List<IoElement>(total);
        var actual = ReadGroup(reader, 1, 1, values) + ReadGroup(reader, 2, 1, values) +
                     ReadGroup(reader, 4, 1, values) + ReadGroup(reader, 8, 1, values);
        actual += ReadVariableGroup(reader, 1, 1, values);
        if (actual != total)
            throw new InvalidDataException("Codec 8 IO element count does not match its groups.");
        return new IoData(eventId, values);
    }

    private static IoData ReadCodec8ExtendedIo(AvlDataReader reader)
    {
        var eventId = reader.ReadUInt16();
        var total = reader.ReadUInt16();
        var values = new List<IoElement>(total);
        var actual = ReadGroup(reader, 1, 2, values) + ReadGroup(reader, 2, 2, values) +
                     ReadGroup(reader, 4, 2, values) + ReadGroup(reader, 8, 2, values);
        actual += ReadVariableGroup(reader, 2, 2, values);
        if (actual != total)
            throw new InvalidDataException("Codec 8 Extended IO element count does not match its groups.");
        return new IoData(eventId, values);
    }

    private static int ReadGroup(AvlDataReader reader, int valueLength, int idLength, List<IoElement> values)
    {
        var count = reader.ReadByte();
        for (var i = 0; i < count; i++)
        {
            var id = idLength == 1 ? reader.ReadByte() : reader.ReadUInt16();
            var raw = ReadValue(reader, valueLength);
            values.Add(new IoElement(id, raw, valueLength));
        }
        return count;
    }

    private static int ReadVariableGroup(AvlDataReader reader, int idLength, int lengthLength, List<IoElement> values)
    {
        var count = reader.ReadByte();
        for (var i = 0; i < count; i++)
        {
            var id = idLength == 1 ? reader.ReadByte() : reader.ReadUInt16();
            var length = lengthLength == 1 ? reader.ReadByte() : reader.ReadUInt16();
            if (length == 0 || length > reader.Remaining)
                throw new InvalidDataException("Invalid variable-length IO element.");
            values.Add(new IoElement(id, Convert.ToHexString(reader.ReadBytes(length)), length));
        }
        return count;
    }

    private static string ReadValue(AvlDataReader reader, int length)
    {
        return length switch
        {
            1 => reader.ReadByte().ToString(System.Globalization.CultureInfo.InvariantCulture),
            2 => reader.ReadUInt16().ToString(System.Globalization.CultureInfo.InvariantCulture),
            4 => reader.ReadUInt32().ToString(System.Globalization.CultureInfo.InvariantCulture),
            8 => reader.ReadUInt64().ToString(System.Globalization.CultureInfo.InvariantCulture),
            _ => throw new InvalidDataException("Unsupported IO scalar width.")
        };
    }
}