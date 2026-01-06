import { IsNumber, IsString } from 'class-validator';

export class ResolvePlaceDto {
  @IsNumber()
  originLat: number;

  @IsNumber()
  originLng: number;

  @IsString()
  destination: string;
}
