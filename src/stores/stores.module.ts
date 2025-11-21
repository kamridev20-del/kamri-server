import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DuplicatePreventionService } from '../common/services/duplicate-prevention.service';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  controllers: [StoresController],
  providers: [StoresService, PrismaService, DuplicatePreventionService],
  exports: [StoresService],
})
export class StoresModule {}
