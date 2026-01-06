import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { ResolvePlaceDto } from './dto/resolve-place.dto';

interface ResolvedPlace {
  resolvedName: string;
  lat: number;
  lng: number;
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
      const $ = cheerio.load(html);

      // Try to extract coordinates from og:image meta tag
      const ogImage = $('meta[property="og:image"]').attr('content');

      if (!ogImage) {
        this.logger.error('og:image meta tag not found in HTML response');
        throw new HttpException(
          'Cannot resolve place: Google Maps structure changed or destination not found',
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.debug(`og:image content: ${ogImage}`);

      // Extract coordinates from markers parameter
      // Google Maps returns multiple markers: origin|destination1|destination2...
      // We need the LAST marker which is the actual destination
      // Pattern: markers=lat1,lng1|lat2,lng2|lat3,lng3

      // First, extract the markers parameter value
      const markersMatch = ogImage.match(/markers=([^&]+)/);

      if (!markersMatch || !markersMatch[1]) {
        this.logger.error('No markers parameter found in og:image');
        throw new HttpException(
          'Markers parameter not found in Google Maps response',
          HttpStatus.NOT_FOUND,
        );
      }

      const markersParam = decodeURIComponent(markersMatch[1]);
      this.logger.debug(`Decoded markers param: ${markersParam}`);

      // Split by | to get all coordinate pairs
      // Format could be: "color:red|lat1,lng1|lat2,lng2" or just "lat1,lng1|lat2,lng2"
      const parts = markersParam.split('|');

      // Find all coordinate pairs (skip color/style parts)
      const coordinatePairs = parts.filter(part => {
        // A coordinate pair should match: number,number
        return /^-?[0-9.]+,-?[0-9.]+$/.test(part.trim());
      });

      if (coordinatePairs.length === 0) {
        this.logger.error(`No coordinate pairs found in markers: ${markersParam}`);
        throw new HttpException(
          'No valid coordinates found in markers',
          HttpStatus.NOT_FOUND,
        );
      }

      // Get the LAST coordinate pair (destination)
      const lastPair = coordinatePairs[coordinatePairs.length - 1];
      this.logger.debug(`Found ${coordinatePairs.length} markers, using last one: ${lastPair}`);

      const [latStr, lngStr] = lastPair.split(',');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);

      // Validate parsed coordinates
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        this.logger.error(`Invalid parsed coordinates: lat=${lat}, lng=${lng}`);
        throw new HttpException(
          'Invalid destination coordinates',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Extract resolved name from og:title
      const resolvedName = $('meta[property="og:title"]').attr('content') || destination;

      const result: ResolvedPlace = {
        resolvedName: resolvedName.trim(),
        lat,
        lng,
        source: 'google_maps_dir',
        url,
      };

      this.logger.log(`✅ Successfully resolved: "${result.resolvedName}" → (${lat}, ${lng})`);

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
}
