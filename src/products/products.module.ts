import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CJDropshippingModule } from '../cj-dropshipping/cj-dropshipping.module';
import { ShippingModule } from '../shipping/shipping.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductViewersService } from './product-viewers.service';

@Module({
  imports: [
    PrismaModule, 
    ConfigModule,
    CJDropshippingModule,  // ✅ AJOUT : Pour accéder à CJAPIClient
    ShippingModule, // ✅ Module validation livraison
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductViewersService],
  exports: [ProductsService],
})
export class ProductsModule {}

