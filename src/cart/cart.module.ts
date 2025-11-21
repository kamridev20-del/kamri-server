import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ShippingModule } from '../shipping/shipping.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartGroupingService } from './cart-grouping.service';

@Module({
  imports: [PrismaModule, ShippingModule],
  controllers: [CartController],
  providers: [CartService, CartGroupingService],
  exports: [CartService, CartGroupingService],
})
export class CartModule {}

