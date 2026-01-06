import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { MapsService } from './maps.service';
import { ResolvePlaceDto } from './dto/resolve-place.dto';

@Controller('maps')
export class MapsController {
  private readonly logger = new Logger(MapsController.name);

  constructor(private readonly mapsService: MapsService) { }

  @Post('resolve-place')
  @HttpCode(HttpStatus.OK)
  async resolve(@Body() dto: ResolvePlaceDto) {
    this.logger.log(`📨 Received resolve-place request for: ${dto.destination}`);

    try {
      const result = await this.mapsService.resolvePlace(dto);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to resolve place: ${error.message}`);
      throw error;
    }
  }
}
