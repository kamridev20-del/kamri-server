import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShippingValidationService } from './shipping-validation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CJAPIClient } from '../cj-dropshipping/cj-api-client';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
  ],
  providers: [
    CJAPIClient,
    ShippingValidationService,
  ],
  exports: [ShippingValidationService],
})
export class ShippingModule {}

