import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ResolvePlaceDto } from './dto/resolve-place.dto';

interface ResolvedPlace {
  resolvedName: string;
  destination: string;
  lat: number | null;
  lng: number | null;
  source: string;
  url: string;
}

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds

  async resolvePlace(dto: ResolvePlaceDto): Promise<ResolvedPlace> {
    const { originLat, originLng, destination } = dto;

    // Validate coordinates
    if (originLat < -90 || originLat > 90 || originLng < -180 || originLng > 180) {
      this.logger.error(`Invalid coordinates: lat=${originLat}, lng=${originLng}`);
      throw new HttpException(
        'Invalid origin coordinates',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Build URL with proper encoding
    const url = `https://www.google.com/maps/dir/${encodeURIComponent(originLat)},${encodeURIComponent(originLng)}/${encodeURIComponent(destination)}`;

    this.logger.log(`🔍 Resolving place: "${destination}" from (${originLat}, ${originLng})`);
    this.logger.debug(`Request URL: ${url}`);

    try {
      // Fetch with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        },
        signal: controller.signal as any,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.error(`Google Maps returned status ${response.status}`);
        throw new HttpException(
          `Failed to fetch from Google Maps: ${response.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const html = await response.text();
      
      // Save HTML to file
      await this.saveHtml(html, destination);

      const $ = cheerio.load(html);

      let lat: number | null = null;
      let lng: number | null = null;
      let source = 'google_maps_dir';

      const ogImage = $('meta[property="og:image"]').attr('content');
      
      if (ogImage) {
        this.logger.debug(`og:image content: ${ogImage}`);
        const markersMatch = ogImage.match(/markers=([^&]+)/);
        if (markersMatch && markersMatch[1]) {
          const markersParam = decodeURIComponent(markersMatch[1]);
          const parts = markersParam.split('|');
          const coordinatePairs = parts.filter(part => /^-?[0-9.]+,-?[0-9.]+$/.test(part.trim()));
          
          if (coordinatePairs.length > 0) {
            const lastPair = coordinatePairs[coordinatePairs.length - 1];
            const [latStr, lngStr] = lastPair.split(',');
            const pLat = parseFloat(latStr);
            const pLng = parseFloat(lngStr);
            
            if (!isNaN(pLat) && !isNaN(pLng)) {
              lat = pLat;
              lng = pLng;
            }
          }
        }
      }

      const resolvedName = ($('meta[property="og:title"]').attr('content') || destination).replace(' - Google Maps', '').trim();

      const result: ResolvedPlace = {
        resolvedName,
        destination,
        lat,
        lng,
        source: lat ? 'google_maps_dir' : 'google_maps_no_coords',
        url,
      };

      this.logger.log(`✅ Result: "${result.resolvedName}" → (${lat}, ${lng})`);
      return result;

    } catch (error: any) {
      // Handle abort/timeout errors
      if (error.name === 'AbortError') {
        this.logger.error(`Request timeout after ${this.REQUEST_TIMEOUT}ms`);
        throw new HttpException(
          'Request timeout: Google Maps took too long to respond',
          HttpStatus.REQUEST_TIMEOUT,
        );
      }

      // Re-throw HttpException
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle network errors
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        this.logger.error(`Network error: ${error.message}`);
        throw new HttpException(
          'Cannot connect to Google Maps',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Log and throw unexpected errors
      this.logger.error(`Unexpected error resolving place: ${error.message}`, error.stack);
      throw new HttpException(
        'Internal server error while resolving place',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async saveHtml(content: string, name: string) {
    const safeName = name.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    const fileName = `${safeName}.html`;
    const htmlDir = path.join(process.cwd(), 'html');
    
    try {
      await fs.mkdir(htmlDir, { recursive: true });
      await fs.writeFile(path.join(htmlDir, fileName), content, 'utf-8');
      this.logger.log(`💾 HTML saved: ${fileName}`);
    } catch (e) {
      this.logger.warn(`Could not save HTML: ${e.message}`);
    }
  }
}
