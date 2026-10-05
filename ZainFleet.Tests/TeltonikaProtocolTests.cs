using System.Text;
using ZainFleet.Models;
using ZainFleet.Protocol;
using Xunit;

namespace ZainFleet.Tests;

public sealed class TeltonikaProtocolTests
{
    [Fact(DisplayName = "TEST FIXTURE: parses a valid 15-digit IMEI")]
    public void ImeiParserAcceptsValidImei()
    {
        Assert.True(TeltonikaImeiParser.TryParse(Encoding.ASCII.GetBytes("123456789012345"), out var imei));
        Assert.Equal("123456789012345", imei);
        Assert.False(TeltonikaImeiParser.TryParse(Encoding.ASCII.GetBytes("1234x6789012345"), out _));
    }

    [Fact(DisplayName = "TEST FIXTURE: decodes Codec 8 GPS fields and IO")]
    public async Task Codec8PacketIsDecoded()
    {
        var packet = await ParseFixtureAsync(TestFixtureBuilder.Codec8Packet());
        var record = Assert.Single(packet.Records);

        Assert.Equal((byte)0x08, packet.CodecId);
        Assert.Equal(2, record.Priority);
        Assert.Equal(-0.1234567, record.Longitude, 7);
        Assert.Equal(0.54321, record.Latitude, 5);
        Assert.Equal((short)120, record.Altitude);
        Assert.Equal((ushort)90, record.Angle);
        Assert.Equal((byte)8, record.Satellites);
        Assert.Equal((ushort)42, record.Speed);
        Assert.Equal((ushort)7, record.EventIoId);
        Assert.Equal(new IoElement(1, "42", 1), Assert.Single(record.IoElements));
    }

    [Fact(DisplayName = "TEST FIXTURE: decodes Codec 8 Extended 16-bit IDs and variable IO")]
    public async Task Codec8ExtendedPacketIsDecoded()
    {
        var packet = await ParseFixtureAsync(TestFixtureBuilder.Codec8ExtendedPacket());
        var record = Assert.Single(packet.Records);

        Assert.Equal((byte)0x8E, packet.CodecId);
        Assert.Equal((ushort)42, record.EventIoId);
        Assert.Equal(2, record.IoElements.Count);
        Assert.Equal(new IoElement(1, "1", 1), record.IoElements[0]);
        Assert.Equal(new IoElement(2, "ABCD", 2), record.IoElements[1]);
    }

    [Fact]
    public void Crc16IbmUsesKnownCheckValue()
    {
        Assert.Equal((ushort)0xBB3D, TeltonikaCrc16.Compute(Encoding.ASCII.GetBytes("123456789")));
    }

    [Fact]
    public async Task CorruptedFrameFailsCrcValidation()
    {
        var frame = TestFixtureBuilder.Codec8Packet();
        frame[^1] ^= 0x01;
        await Assert.ThrowsAsync<InvalidDataException>(async () =>
            await TeltonikaProtocol.ReadFrameAsync(new MemoryStream(frame), 1024, TimeSpan.FromSeconds(2), CancellationToken.None));
    }

    [Fact]
    public void AvlAcknowledgementContainsBigEndianRecordCount()
    {
        Assert.Equal(new byte[] { 0, 0, 0, 2 }, TeltonikaProtocol.CreateAvlAcknowledgement(2));
    }

    [Fact(DisplayName = "TEST FIXTURE: packet framing works across partial TCP reads")]
    public async Task PartialPacketReadsAreReassembled()
    {
        await using var stream = new ChunkedReadStream(TestFixtureBuilder.Codec8Packet(), 2);
        var frame = await TeltonikaProtocol.ReadFrameAsync(stream, 1024, TimeSpan.FromSeconds(2), CancellationToken.None);

        Assert.NotNull(frame);
        Assert.Single(new TeltonikaPacketParser().Parse(frame!).Records);
    }

    [Fact(DisplayName = "TEST FIXTURE: IMEI handshake works across partial TCP reads")]
    public async Task PartialImeiReadsAreReassembled()
    {
        var bytes = new byte[] { 0, 15 }.Concat(Encoding.ASCII.GetBytes("123456789012345")).ToArray();
        await using var stream = new ChunkedReadStream(bytes, 1);

        Assert.Equal("123456789012345", await TeltonikaProtocol.ReadImeiAsync(stream, TimeSpan.FromSeconds(2), CancellationToken.None));
        Assert.Equal(new byte[] { 1 }, TeltonikaProtocol.CreateImeiResponse(true));
        Assert.Equal(new byte[] { 0 }, TeltonikaProtocol.CreateImeiResponse(false));
    }

    private static async Task<ParsedAvlPacket> ParseFixtureAsync(byte[] bytes)
    {
        var frame = await TeltonikaProtocol.ReadFrameAsync(new MemoryStream(bytes), 1024, TimeSpan.FromSeconds(2), CancellationToken.None);
        Assert.NotNull(frame);
        return new TeltonikaPacketParser().Parse(frame!);
    }

    private sealed class ChunkedReadStream(byte[] data, int maxChunkSize) : MemoryStream(data)
    {
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) =>
            base.ReadAsync(buffer[..Math.Min(buffer.Length, maxChunkSize)], cancellationToken);
    }
}
