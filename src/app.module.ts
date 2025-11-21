import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { CJDropshippingModule } from './cj-dropshipping/cj-dropshipping.module';
import { CommonModule } from './common/common.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GeoModule } from './geo/geo.module';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SettingsModule } from './settings/settings.module';
import { ShippingModule } from './shipping/shipping.module';
import { StoresModule } from './stores/stores.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { UsersModule } from './users/users.module';
import { WishlistModule } from './wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: (() => {
        const paths = [
          resolve(__dirname, '..', '.env'),        // Dev: server/src -> server/.env
          resolve(__dirname, '..', '..', '.env'),  // Prod: server/dist/src -> server/.env
          resolve(process.cwd(), 'server', '.env'), // Fallback: depuis la racine
        ];
        console.log('📁 [AppModule] Chemins .env recherchés:');
        paths.forEach((path, i) => {
          const fs = require('fs');
          const exists = fs.existsSync(path);
          console.log(`  ${i + 1}. ${path} ${exists ? '✅ EXISTE' : '❌ N\'EXISTE PAS'}`);
          if (exists) {
            const content = fs.readFileSync(path, 'utf8');
            const hasJwtSecret = content.includes('JWT_SECRET');
            console.log(`     JWT_SECRET présent: ${hasJwtSecret ? '✅ OUI' : '❌ NON'}`);
          }
        });
        return paths;
      })(),
    }),
    PrismaModule,
    CommonModule, // ✅ Module anti-doublons
    AuthModule,
    ProductsModule,
    CategoriesModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    PaymentsModule,
    SuppliersModule,
    SettingsModule,
    DashboardModule,
    AddressesModule,
    UserSettingsModule,
    UsersModule,
    CJDropshippingModule,
    HealthModule,
    StoresModule,
    GeoModule, // ✅ Module géolocalisation
    ShippingModule, // ✅ Module validation livraison
  ],
})
export class AppModule {}

