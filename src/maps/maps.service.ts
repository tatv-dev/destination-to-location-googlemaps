import { Injectable, Logger } from '@nestjs/common';
import { ResolvePlaceDto } from './dto/resolve-place.dto';
import { OsmService } from './osm.service';
import { GoogleMapsService } from './google-maps.service';
import { GoogleGeocodingService } from './google-geocoding.service';

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);

  constructor(
    private readonly osmService: OsmService,
    private readonly googleMapsService: GoogleMapsService,
    private readonly googleGeocodingService: GoogleGeocodingService,
  ) {}

  async resolvePlace(dto: ResolvePlaceDto) {
    this.logger.log(`🚀 Starting resolution for: "${dto.destination}"`);

    // 1. Try Official Google Geocoding API first (Premium but limited)
    try {
      const officialResult = await this.googleGeocodingService.resolvePlace(dto);
      if (officialResult) {
        this.logger.log(`✨ Resolved via Official Google API`);
        return officialResult;
      }
    } catch (e) {
      this.logger.warn(`⚠️ Official API failed: ${e.message}`);
    }

    // 2. Try Google Maps Scraper
    try {
      const googleResult = await this.googleMapsService.resolvePlace(dto);
      if (googleResult && googleResult.lat !== null && googleResult.lng !== null) {
        this.logger.log(`✨ Resolved via Google Maps Scraper`);
        return googleResult;
      }
      this.logger.log(`⚠️ Google Maps Scraper found no coordinates.`);
    } catch (error) {
      this.logger.warn(`⚠️ Google Maps Scraper error: ${error.message}`);
    }

    // 3. Fallback to OSM
    this.logger.log(`🔄 Falling back to OSM...`);
    const osmResult = await this.osmService.resolvePlace(dto);
    if (osmResult) {
      this.logger.log(`✨ Resolved via OSM fallback`);
      return osmResult;
    }

    this.logger.error(`❌ All services failed to resolve: "${dto.destination}"`);
    return null;
  }
}
