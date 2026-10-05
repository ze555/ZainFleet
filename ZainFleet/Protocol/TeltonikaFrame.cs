namespace ZainFleet.Protocol;

public sealed record TeltonikaFrame(byte[] DataField);

public sealed record ParsedAvlPacket(byte CodecId, IReadOnlyList<Models.AvlRecord> Records);