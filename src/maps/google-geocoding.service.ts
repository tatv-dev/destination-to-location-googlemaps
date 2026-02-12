import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ResolvePlaceDto } from './dto/resolve-place.dto';

@Injectable()
export class GoogleGeocodingService {
  private readonly logger = new Logger(GoogleGeocodingService.name);
  private readonly API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
  private readonly MONTHLY_LIMIT = 1000; // Safe limit within $200 free tier
  private readonly STORAGE_PATH = path.join(process.cwd(), 'data', 'geocoding_usage.json');

  async resolvePlace(dto: ResolvePlaceDto) {
    if (!this.API_KEY) {
      this.logger.warn('GOOGLE_MAPS_API_KEY is not set. Skipping Official Geocoding.');
      return null;
    }

    const currentUsage = await this.getCurrentUsage();
    if (currentUsage >= this.MONTHLY_LIMIT) {
      this.logger.warn(`Monthly Geocoding limit reached (${currentUsage}/${this.MONTHLY_LIMIT}). Skipping.`);
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(dto.destination)}&key=${this.API_KEY}&language=vi`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        await this.incrementUsage();
        const result = data.results[0];
        return {
          resolvedName: result.formatted_address,
          destination: dto.destination,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          source: 'google_geocoding_api',
          url: 'api://google_geocoding',
        };
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        this.logger.error('Google API returned OVER_QUERY_LIMIT');
        // Set usage to limit to block further calls this month
        await this.setUsageToLimit();
      }

      return null;
    } catch (error) {
      this.logger.error(`Error calling Google Geocoding API: ${error.message}`);
      return null;
    }
  }

  private async getCurrentUsage(): Promise<number> {
    const monthKey = new Date().toISOString().substring(0, 7); // YYYY-MM
    try {
      await fs.mkdir(path.dirname(this.STORAGE_PATH), { recursive: true });
      const data = JSON.parse(await fs.readFile(this.STORAGE_PATH, 'utf-8'));
      return data[monthKey] || 0;
    } catch {
      return 0;
    }
  }

  private async incrementUsage() {
    const monthKey = new Date().toISOString().substring(0, 7);
    try {
      const usage = await this.getUsageObject();
      usage[monthKey] = (usage[monthKey] || 0) + 1;
      await fs.writeFile(this.STORAGE_PATH, JSON.stringify(usage));
    } catch (e) {
      this.logger.error(`Could not save usage: ${e.message}`);
    }
  }

  private async setUsageToLimit() {
    const monthKey = new Date().toISOString().substring(0, 7);
    const usage = await this.getUsageObject();
    usage[monthKey] = this.MONTHLY_LIMIT;
    await fs.writeFile(this.STORAGE_PATH, JSON.stringify(usage));
  }

  private async getUsageObject() {
    try {
      return JSON.parse(await fs.readFile(this.STORAGE_PATH, 'utf-8'));
    } catch {
      return {};
    }
  }
}
