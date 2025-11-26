import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeoController } from './geo.controller';
import { GeoLocationService } from './geo.service';
import { CurrencyModule } from '../currency/currency.module';

@Module({
  imports: [ConfigModule, CurrencyModule],
  controllers: [GeoController],
  providers: [GeoLocationService],
  exports: [GeoLocationService],
})
export class GeoModule {}

