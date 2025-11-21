import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeoController } from './geo.controller';
import { GeoLocationService } from './geo.service';

@Module({
  imports: [ConfigModule],
  controllers: [GeoController],
  providers: [GeoLocationService],
  exports: [GeoLocationService],
})
export class GeoModule {}

