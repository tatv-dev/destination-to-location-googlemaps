import { Module } from '@nestjs/common';
import { MapsController } from './maps/maps.controller';
import { MapsService } from './maps/maps.service';
import { OsmService } from './maps/osm.service';
import { GoogleMapsService } from './maps/google-maps.service';
import { GoogleGeocodingService } from './maps/google-geocoding.service';

@Module({
  controllers: [MapsController],
  providers: [MapsService, OsmService, GoogleMapsService, GoogleGeocodingService],
})
export class AppModule {}
