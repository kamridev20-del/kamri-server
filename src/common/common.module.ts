import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DuplicatePreventionController } from './duplicate-prevention.controller';
import { DuplicatePreventionService } from './services/duplicate-prevention.service';

@Module({
  imports: [PrismaModule],
  controllers: [DuplicatePreventionController],
  providers: [DuplicatePreventionService],
  exports: [DuplicatePreventionService],
})
export class CommonModule {}