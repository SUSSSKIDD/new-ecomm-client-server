import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface GeocodableAddress {
  street: string;
  city: string;
  state?: string | null;
  zipCode: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * Resolves a structured address to lat/lng via OpenStreetMap Nominatim.
 * Free, no API key — appropriate for this platform's regional order volume.
 * Nominatim's usage policy requires a descriptive User-Agent and caps requests
 * at ~1/sec, which callers must respect (this service does not queue/throttle
 * internally — it's called per-address on save, not per-order).
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private static readonly ENDPOINT = 'https://nominatim.openstreetmap.org/search';
  private static readonly USER_AGENT = 'Neyokart-OrderService/1.0';

  /**
   * Tries a full structured match first, then progressively drops the noisiest
   * fields (street text is rarely indexed cleanly in OSM — house numbers, flat
   * numbers, colony/landmark names). A pincode-level match is still precise
   * enough for this platform's 10km delivery radius, and far better than
   * failing checkout entirely because Nominatim couldn't parse a street line.
   */
  async geocode(address: GeocodableAddress): Promise<GeocodeResult | null> {
    const attempts: Record<string, string>[] = [
      {
        street: address.street,
        city: address.city,
        state: address.state ?? '',
        postalcode: address.zipCode,
      },
      { city: address.city, state: address.state ?? '', postalcode: address.zipCode },
      { postalcode: address.zipCode },
      { city: address.city, state: address.state ?? '' },
    ];

    for (const params of attempts) {
      const cleaned = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v),
      );
      if (Object.keys(cleaned).length === 0) continue;

      const result = await this.tryStructuredQuery(cleaned);
      if (result) return result;
    }

    this.logger.warn(
      `No geocode match for address after all fallbacks: ${JSON.stringify(address)}`,
    );
    return null;
  }

  private async tryStructuredQuery(
    params: Record<string, string>,
  ): Promise<GeocodeResult | null> {
    try {
      const { data } = await axios.get(GeocodingService.ENDPOINT, {
        params: { format: 'json', country: 'India', limit: 1, ...params },
        headers: { 'User-Agent': GeocodingService.USER_AGENT },
        timeout: 5000,
      });

      const match = Array.isArray(data) ? data[0] : null;
      if (!match) return null;

      const lat = parseFloat(match.lat);
      const lng = parseFloat(match.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return { lat, lng };
    } catch (err) {
      this.logger.warn(
        `Geocoding request failed for ${JSON.stringify(params)}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
