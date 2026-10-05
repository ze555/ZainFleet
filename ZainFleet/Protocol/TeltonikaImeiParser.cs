using System.Text;

namespace ZainFleet.Protocol;

public static class TeltonikaImeiParser
{
    public static bool TryParse(ReadOnlySpan<byte> payload, out string imei)
    {
        imei = string.Empty;
        if (payload.Length != 15)
            return false;

        foreach (var value in payload)
        {
            if (value is < (byte)'0' or > (byte)'9')
                return false;
        }

        imei = Encoding.ASCII.GetString(payload);
        return true;
    }
}