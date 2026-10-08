using ZainFleet.Models;

namespace ZainFleet.Protocol;

public sealed class TeltonikaPacketParser : ITeltonikaPacketParser
{
    private readonly IReadOnlyDictionary<byte, ICodecAvlDecoder> _decoders =
        new Dictionary<byte, ICodecAvlDecoder>
        {
            [0x08] = new Codec8AvlDecoder(),
            [0x8E] = new Codec8ExtendedAvlDecoder()
        };

    public ParsedAvlPacket Parse(TeltonikaFrame frame)
    {
        var reader = new AvlDataReader(frame.DataField);

        var codecId = reader.ReadByte();

        if (!_decoders.TryGetValue(codecId, out var decoder))
        {
            throw new InvalidDataException(
                $"Unsupported Teltonika codec: 0x{codecId:X2}. " +
                $"DataLength={frame.DataField.Length}, " +
                $"FirstBytes={GetHex(frame.DataField, 0, Math.Min(64, frame.DataField.Length))}");
        }

        var recordCount = decoder.ReadCount(reader);

        Console.WriteLine(
            $"TELTONIKA PARSE: Codec=0x{codecId:X2}, " +
            $"Records={recordCount}, " +
            $"DataLength={frame.DataField.Length}, " +
            $"ReaderPosition={reader.Position}, " +
            $"Remaining={reader.Remaining}");

        var records = new List<AvlRecord>(recordCount);

        for (var i = 0; i < recordCount; i++)
        {
            try
            {
                records.Add(decoder.ReadRecord(reader));
            }
            catch (Exception ex)
            {
                var errorPosition = reader.Position;

                var start = Math.Max(0, errorPosition - 24);
                var length = Math.Min(
                    frame.DataField.Length - start,
                    96);

                var contextBytes = GetHex(
                    frame.DataField,
                    start,
                    length);

                var fullBytes = GetHex(
                    frame.DataField,
                    0,
                    Math.Min(128, frame.DataField.Length));

                throw new InvalidDataException(
                    $"AVL PARSE FAILED. " +
                    $"Codec=0x{codecId:X2}, " +
                    $"Record={i + 1}/{recordCount}, " +
                    $"Position={errorPosition}, " +
                    $"Remaining={reader.Remaining}, " +
                    $"ContextBytes={contextBytes}, " +
                    $"FirstBytes={fullBytes}",
                    ex);
            }
        }

        var secondRecordCount = decoder.ReadCount(reader);

        if (secondRecordCount != recordCount)
        {
            throw new InvalidDataException(
                $"AVL record count mismatch. " +
                $"Codec=0x{codecId:X2}, " +
                $"FirstCount={recordCount}, " +
                $"SecondCount={secondRecordCount}, " +
                $"Position={reader.Position}, " +
                $"Remaining={reader.Remaining}, " +
                $"DataLength={frame.DataField.Length}, " +
                $"FirstBytes={GetHex(frame.DataField, 0, Math.Min(128, frame.DataField.Length))}");
        }

        if (reader.Remaining != 0)
        {
            throw new InvalidDataException(
                $"AVL packet has unexpected trailing bytes. " +
                $"Codec=0x{codecId:X2}, " +
                $"Records={recordCount}, " +
                $"Position={reader.Position}, " +
                $"Remaining={reader.Remaining}, " +
                $"DataLength={frame.DataField.Length}, " +
                $"TrailingBytes={GetHex(frame.DataField, reader.Position, reader.Remaining)}");
        }

        return new ParsedAvlPacket(codecId, records);
    }

    private static string GetHex(
        ReadOnlySpan<byte> data,
        int start,
        int length)
    {
        if (data.Length == 0)
            return string.Empty;

        if (start < 0)
            start = 0;

        if (start >= data.Length)
            return string.Empty;

        length = Math.Min(length, data.Length - start);

        return Convert.ToHexString(data.Slice(start, length));
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

            Console.WriteLine(
                $"TELTONIKA RECORD: " +
                $"RawTimestamp={timestampValue}, " +
                $"Hex=0x{timestampValue:X16}, " +
                $"ReaderPosition={reader.Position}");

            if (timestampValue >
                (ulong)DateTimeOffset.MaxValue.ToUnixTimeMilliseconds())
            {
                throw new InvalidDataException(
                    $"Invalid AVL timestamp. " +
                    $"Raw={timestampValue}, " +
                    $"Hex=0x{timestampValue:X16}, " +
                    $"Position={reader.Position}");
            }

            var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(
                (long)timestampValue);

            var priority = reader.ReadByte();

            var longitude = reader.ReadInt32() / 10_000_000d;

            var latitude = reader.ReadInt32() / 10_000_000d;

            var altitude = reader.ReadInt16();

            var angle = reader.ReadUInt16();

            var satellites = reader.ReadByte();

            var speed = reader.ReadUInt16();

            var io = ReadIo(reader);

            return new AvlRecord(
                timestamp,
                priority,
                longitude,
                latitude,
                altitude,
                angle,
                satellites,
                speed,
                io.EventIoId,
                io.Elements);
        }
    }

    private sealed class Codec8AvlDecoder : CodecAvlDecoder
    {
        public override ushort ReadCount(
            AvlDataReader reader)
        {
            return reader.ReadByte();
        }

        protected override IoData ReadIo(
            AvlDataReader reader)
        {
            return ReadCodec8Io(reader);
        }
    }

    private sealed class Codec8ExtendedAvlDecoder : CodecAvlDecoder
    {
        public override ushort ReadCount(
            AvlDataReader reader)
        {
            return reader.ReadUInt16();
        }

        protected override IoData ReadIo(
            AvlDataReader reader)
        {
            return ReadCodec8ExtendedIo(reader);
        }
    }

    private sealed record IoData(
        ushort EventIoId,
        IReadOnlyList<IoElement> Elements);

    private static IoData ReadCodec8Io(
        AvlDataReader reader)
    {
        var eventId = reader.ReadByte();

        var total = reader.ReadByte();

        var values = new List<IoElement>(total);

        var actual =
            ReadGroup(
                reader,
                1,
                1,
                values)
            +
            ReadGroup(
                reader,
                2,
                1,
                values)
            +
            ReadGroup(
                reader,
                4,
                1,
                values)
            +
            ReadGroup(
                reader,
                8,
                1,
                values);

        actual += ReadVariableGroup(
            reader,
            1,
            1,
            values);

        if (actual != total)
        {
            throw new InvalidDataException(
                $"Codec 8 IO element count does not match its groups. " +
                $"Expected={total}, Actual={actual}, " +
                $"Position={reader.Position}, " +
                $"Remaining={reader.Remaining}");
        }

        return new IoData(
            eventId,
            values);
    }

    private static IoData ReadCodec8ExtendedIo(
        AvlDataReader reader)
    {
        var eventId = reader.ReadUInt16();

        var total = reader.ReadUInt16();

        var values = new List<IoElement>(total);

        var actual =
            ReadGroup(
                reader,
                1,
                2,
                values)
            +
            ReadGroup(
                reader,
                2,
                2,
                values)
            +
            ReadGroup(
                reader,
                4,
                2,
                values)
            +
            ReadGroup(
                reader,
                8,
                2,
                values);

        actual += ReadVariableGroup(
            reader,
            2,
            2,
            values);

        if (actual != total)
        {
            throw new InvalidDataException(
                $"Codec 8 Extended IO element count does not match its groups. " +
                $"Expected={total}, Actual={actual}, " +
                $"Position={reader.Position}, " +
                $"Remaining={reader.Remaining}");
        }

        return new IoData(
            eventId,
            values);
    }

    private static int ReadGroup(
        AvlDataReader reader,
        int valueLength,
        int idLength,
        List<IoElement> values)
    {
        var count = reader.ReadByte();

        for (var i = 0; i < count; i++)
        {
            var id =
                idLength == 1
                    ? reader.ReadByte()
                    : reader.ReadUInt16();

            var raw = ReadValue(
                reader,
                valueLength);

            values.Add(
                new IoElement(
                    id,
                    raw,
                    valueLength));
        }

        return count;
    }

    private static int ReadVariableGroup(
        AvlDataReader reader,
        int idLength,
        int lengthLength,
        List<IoElement> values)
    {
        var count = reader.ReadByte();

        for (var i = 0; i < count; i++)
        {
            var id =
                idLength == 1
                    ? reader.ReadByte()
                    : reader.ReadUInt16();

            var length =
                lengthLength == 1
                    ? reader.ReadByte()
                    : reader.ReadUInt16();

            if (length == 0 ||
                length > reader.Remaining)
            {
                throw new InvalidDataException(
                    $"Invalid variable-length IO element. " +
                    $"Id={id}, Length={length}, " +
                    $"Position={reader.Position}, " +
                    $"Remaining={reader.Remaining}");
            }

            values.Add(
                new IoElement(
                    id,
                    Convert.ToHexString(
                        reader.ReadBytes(length)),
                    length));
        }

        return count;
    }

    private static string ReadValue(
        AvlDataReader reader,
        int length)
    {
        return length switch
        {
            1 => reader
                .ReadByte()
                .ToString(
                    System.Globalization.CultureInfo.InvariantCulture),

            2 => reader
                .ReadUInt16()
                .ToString(
                    System.Globalization.CultureInfo.InvariantCulture),

            4 => reader
                .ReadUInt32()
                .ToString(
                    System.Globalization.CultureInfo.InvariantCulture),

            8 => reader
                .ReadUInt64()
                .ToString(
                    System.Globalization.CultureInfo.InvariantCulture),

            _ => throw new InvalidDataException(
                "Unsupported IO scalar width.")
        };
    }
}