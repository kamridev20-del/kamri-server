import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CJDropshippingModule } from '../cj-dropshipping/cj-dropshipping.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderCJIntegrationService } from './order-cj-integration.service';

@Module({
  imports: [
    PrismaModule,
    CJDropshippingModule, // Pour accéder à CJOrdersService
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderCJIntegrationService,
  ],
  exports: [
    OrdersService,
    OrderCJIntegrationService,
  ],
})
export class OrdersModule {}

