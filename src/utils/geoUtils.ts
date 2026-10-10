/**
 * Utility functions for coordinate formatting, distance, and client-side reverse geocoding
 */

const geocodeCache = new Map<string, string>();

/**
 * Formats coordinates into standard human-friendly format
 */
export function formatCoordinates(lat: number, lng: number): string {
  if (!lat && !lng) return '---';
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}

/**
 * Returns formatted location text. Attempts reverse geocoding using OpenStreetMap Nominatim
 * with in-memory caching and graceful fallback.
 */
export async function getApproximateAddress(lat: number, lng: number, isAr = true): Promise<string> {
  if (!lat && !lng) return isAr ? 'لا توجد إحداثيات' : 'No GPS coordinates';

  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // Known quick landmarks for Libya / regional demo coordinates
  if (lat >= 32.8 && lat <= 32.95 && lng >= 13.1 && lng <= 13.3) {
    const address = isAr ? 'طرابلس - طريق الساحلي' : 'Tripoli - Coastal Highway';
    geocodeCache.set(cacheKey, address);
    return address;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      {
        headers: {
          'Accept-Language': isAr ? 'ar,en' : 'en',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const road = addr.road || addr.suburb || addr.neighbourhood || '';
      const city = addr.city || addr.town || addr.village || addr.state || '';
      const country = addr.country || '';

      const parts = [road, city, country].filter(Boolean);
      const formatted = parts.length > 0 ? parts.join(' - ') : data.display_name?.split(',').slice(0, 2).join(' - ') || formatCoordinates(lat, lng);

      geocodeCache.set(cacheKey, formatted);
      return formatted;
    }
  } catch {
    // Quiet fallback to coordinates
  }

  const fallback = formatCoordinates(lat, lng);
  geocodeCache.set(cacheKey, fallback);
  return fallback;
}
