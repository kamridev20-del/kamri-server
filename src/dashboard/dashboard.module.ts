import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule, SuppliersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
