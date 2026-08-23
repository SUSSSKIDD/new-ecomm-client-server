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

  async geocode(address: GeocodableAddress): Promise<GeocodeResult | null> {
    const query = [address.street, address.city, address.state, address.zipCode, 'India']
      .filter(Boolean)
      .join(', ');

    try {
      const { data } = await axios.get(GeocodingService.ENDPOINT, {
        params: { format: 'json', q: query, limit: 1 },
        headers: { 'User-Agent': GeocodingService.USER_AGENT },
        timeout: 5000,
      });

      const match = Array.isArray(data) ? data[0] : null;
      if (!match) {
        this.logger.warn(`No geocode match for address: ${query}`);
        return null;
      }

      const lat = parseFloat(match.lat);
      const lng = parseFloat(match.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }
      return { lat, lng };
    } catch (err) {
      this.logger.warn(
        `Geocoding failed for address "${query}": ${(err as Error).message}`,
      );
      return null;
    }
  }
}
