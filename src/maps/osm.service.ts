import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';
import { ResolvePlaceDto } from './dto/resolve-place.dto';

@Injectable()
export class OsmService {
  private readonly logger = new Logger(OsmService.name);
  private readonly OFFSET = 0.2;
  private readonly MIN_INTERVAL = 1100; // 1.1s to be safe
  private lastRequestTime = 0;
  private requestQueue: Promise<any> = Promise.resolve();

  async resolvePlace(dto: ResolvePlaceDto) {
    // Queue the request to ensure 1req/s
    return this.requestQueue = this.requestQueue.then(async () => {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      
      if (timeSinceLast < this.MIN_INTERVAL) {
        const delay = this.MIN_INTERVAL - timeSinceLast;
        this.logger.debug(`⏳ Throttling OSM request: waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const result = await this.executeResolve(dto);
      this.lastRequestTime = Date.now();
      return result;
    });
  }

  private async executeResolve(dto: ResolvePlaceDto) {
    const { originLat, originLng, destination } = dto;
    
    const viewbox = `${originLng - this.OFFSET},${originLat + this.OFFSET},${originLng + this.OFFSET},${originLat - this.OFFSET}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&viewbox=${viewbox}`;

    this.logger.log(`🔍 Resolving via OSM: "${destination}"`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Google-Maps-Resolver/1.0 (tatv.icv@gmail.com)',
          'Accept': 'application/json',
          'Accept-Language': 'vi-VN,vi;q=0.9',
        }
      });

      if (!response.ok) {
        this.logger.error(`OSM returned status ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        const topResult = data[0];
        return {
          resolvedName: topResult.display_name,
          destination,
          lat: parseFloat(topResult.lat),
          lng: parseFloat(topResult.lon),
          source: 'osm',
          url,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Error calling OSM: ${error.message}`);
      return null;
    }
  }
}
