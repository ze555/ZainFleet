namespace ZainFleet.Protocol;

public interface ITeltonikaPacketParser
{
    ParsedAvlPacket Parse(TeltonikaFrame frame);
}