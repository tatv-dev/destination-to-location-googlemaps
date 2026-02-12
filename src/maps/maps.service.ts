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

      const parsed = this.extractDataFromHtml(html, destination);

      const result: ResolvedPlace = {
        resolvedName: parsed.name,
        destination,
        lat: parsed.lat,
        lng: parsed.lng,
        source: parsed.source,
        url,
      };

      this.logger.log(`✅ Result: "${result.resolvedName}" → (${result.lat}, ${result.lng}) [Source: ${result.source}]`);
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

  private extractDataFromHtml(html: string, fallbackName: string): { lat: number | null, lng: number | null, name: string, source: string } {
    let lat: number | null = null;
    let lng: number | null = null;
    let source = 'not_found';
    let name = fallbackName;

    // Strategy 1: Parse APP_INITIALIZATION_STATE (Most reliable for the view)
    // Format: window.APP_INITIALIZATION_STATE=[[[zoom, lng, lat], ...]]
    const stateMatch = html.match(/APP_INITIALIZATION_STATE=\[\[\[([-0-9.]+),([-0-9.]+),([-0-9.]+)/);
    if (stateMatch) {
      const pLng = parseFloat(stateMatch[2]);
      const pLat = parseFloat(stateMatch[3]);
      if (!isNaN(pLat) && !isNaN(pLng)) {
        lat = pLat;
        lng = pLng;
        source = 'app_init_state';
        this.logger.debug(`Found coords via APP_INITIALIZATION_STATE: ${lat}, ${lng}`);
      }
    }

    // Strategy 2: Protobuf-style encoding (!2dLng!3dLat)
    if (!lat || !lng) {
      // We look for !2d (Longitude) followed by !3d (Latitude)
      // Usually the destination coords come after a distance indicator or at the end of a !pb string
      const pbMatches = [...html.matchAll(/!2d([-0-9.]+)!3d([-0-9.]+)/g)];
      if (pbMatches.length > 0) {
        // We take the last match as it usually represents the destination in a directions URL
        const lastMatch = pbMatches[pbMatches.length - 1];
        const pLng = parseFloat(lastMatch[1]);
        const pLat = parseFloat(lastMatch[2]);
        if (!isNaN(pLat) && !isNaN(pLng)) {
          lat = pLat;
          lng = pLng;
          source = 'protobuf_pb';
          this.logger.debug(`Found coords via Protobuf regex: ${lat}, ${lng}`);
        }
      }
    }

    // Strategy 3: Fallback Meta tags (og:image markers)
    if (!lat || !lng) {
      const $ = cheerio.load(html);
      name = ($('meta[property="og:title"]').attr('content') || fallbackName).replace(' - Google Maps', '').trim();
      
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        const markersMatch = ogImage.match(/markers=([^&]+)/);
        if (markersMatch) {
          const markersParam = decodeURIComponent(markersMatch[1]);
          const parts = markersParam.split('|');
          const coordPair = parts.find(p => /^-?[0-9.]+,-?[0-9.]+$/.test(p.trim()));
          if (coordPair) {
            const [l1, l2] = coordPair.split(',');
            lat = parseFloat(l1);
            lng = parseFloat(l2);
            source = 'meta_og_image_markers';
          }
        }
      }
    } else {
      // Just extract name if coords already found
      const $ = cheerio.load(html);
      name = ($('meta[property="og:title"]').attr('content') || fallbackName).replace(' - Google Maps', '').trim();
    }

    return { lat, lng, name, source };
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
