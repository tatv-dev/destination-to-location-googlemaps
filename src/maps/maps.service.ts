import { Injectable, Logger } from '@nestjs/common';
import { ResolvePlaceDto } from './dto/resolve-place.dto';
import { OsmService } from './osm.service';
import { GoogleMapsService } from './google-maps.service';

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);

  constructor(
    private readonly osmService: OsmService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  async resolvePlace(dto: ResolvePlaceDto) {
    this.logger.log(`🚀 Starting resolution for: "${dto.destination}"`);

    // Try Google Maps first
    try {
      const googleResult = await this.googleMapsService.resolvePlace(dto);
      if (googleResult && googleResult.lat !== null && googleResult.lng !== null) {
        this.logger.log(`✨ Resolved via Google Maps`);
        return googleResult;
      }
      this.logger.log(`⚠️ Google Maps found no coordinates.`);
    } catch (error) {
      this.logger.warn(`⚠️ Google Maps error: ${error.message}`);
    }

    // Fallback to OSM
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
