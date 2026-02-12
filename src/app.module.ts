import { Module } from '@nestjs/common';
import { MapsController } from './maps/maps.controller';
import { MapsService } from './maps/maps.service';
import { OsmService } from './maps/osm.service';
import { GoogleMapsService } from './maps/google-maps.service';

@Module({
  controllers: [MapsController],
  providers: [MapsService, OsmService, GoogleMapsService],
})
export class AppModule {}
