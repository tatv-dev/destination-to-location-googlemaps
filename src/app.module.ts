import { Module } from '@nestjs/common';
import { MapsController } from './maps/maps.controller';
import { MapsService } from './maps/maps.service';

@Module({
  controllers: [MapsController],
  providers: [MapsService],
})
export class AppModule {}
