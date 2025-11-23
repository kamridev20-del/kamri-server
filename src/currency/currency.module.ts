import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { CurrencyScheduler } from './currency.scheduler';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [CurrencyController],
  providers: [CurrencyService, CurrencyScheduler],
  exports: [CurrencyService],
})
export class CurrencyModule {}

