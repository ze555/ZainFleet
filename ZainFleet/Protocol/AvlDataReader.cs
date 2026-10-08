using System.Buffers.Binary;

namespace ZainFleet.Protocol;

internal sealed class AvlDataReader(ReadOnlyMemory<byte> data)
{
    private readonly ReadOnlyMemory<byte> _data;
    private int _offset;

    public int Position => _offset;

    public byte ReadByte() => Read(1).Span[0];
    public ushort ReadUInt16() => BinaryPrimitives.ReadUInt16BigEndian(Read(2).Span);
    public short ReadInt16() => BinaryPrimitives.ReadInt16BigEndian(Read(2).Span);
    public uint ReadUInt32() => BinaryPrimitives.ReadUInt32BigEndian(Read(4).Span);
    public int ReadInt32() => BinaryPrimitives.ReadInt32BigEndian(Read(4).Span);
    public ulong ReadUInt64() => BinaryPrimitives.ReadUInt64BigEndian(Read(8).Span);
    public byte[] ReadBytes(int length) => Read(length).ToArray();
    public int Remaining => _data.Length - _offset;

    private ReadOnlyMemory<byte> Read(int length)
    {
        if (length < 0 || length > Remaining)
            throw new InvalidDataException("AVL record is truncated or malformed.");

        var result = _data.Slice(_offset, length);
        _offset += length;
        return result;
    }
}