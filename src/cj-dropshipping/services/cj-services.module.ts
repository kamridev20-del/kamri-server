import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CJAPIClient } from '../cj-api-client';
import { CJConfigService } from './cj-config.service';
import { CJFavoriteService } from './cj-favorite.service';
import { CJMainService } from './cj-main.service';
import { CJOrderService } from './cj-order.service';
import { CJProductService } from './cj-product.service';
import { CJWebhookService } from './cj-webhook.service';
import { CjSourcingService } from './cj-sourcing.service';

@Module({
  imports: [CommonModule], // ✅ Importer le module commun pour DuplicatePreventionService
  providers: [
    PrismaService,
    CJAPIClient,
    CJConfigService,
    CJProductService,
    CJFavoriteService,
    CJOrderService,
    CJWebhookService,
    CjSourcingService,
    CJMainService,
  ],
  exports: [
    CJConfigService,
    CJProductService,
    CJFavoriteService,
    CJOrderService,
    CJWebhookService,
    CjSourcingService,
    CJMainService,
  ],
})
export class CJServicesModule {}

