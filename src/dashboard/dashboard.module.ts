import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { VisitsModule } from '../visits/visits.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule, SuppliersModule, VisitsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
