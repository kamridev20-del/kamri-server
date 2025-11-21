import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CJAPIClient } from './cj-api-client';
import { CJCategoriesController } from './cj-categories.controller';
import { CJCategoriesService } from './cj-categories.service';
import { CJCountriesController } from './cj-countries.controller';
import { CJCountriesService } from './cj-countries.service';
import { CJDisputesController } from './cj-disputes.controller';
import { CJDisputesService } from './cj-disputes.service';
import { CJDropshippingController } from './cj-dropshipping.controller';
// 🔧 ANCIEN SERVICE SUPPRIMÉ - Remplacé par les services refactorisés
import { CJLogisticsController } from './cj-logistics.controller';
import { CJLogisticsService } from './cj-logistics.service';
import { CJOrdersController } from './cj-orders.controller';
import { CJOrdersService } from './cj-orders.service';
import { CJSettingsController } from './cj-settings.controller';
import { CJSettingsService } from './cj-settings.service';
import { CJWebhookController } from './cj-webhook.controller';
import { CJWebhookService } from './cj-webhook.service';
// 🔧 NOUVEAUX SERVICES REFACTORISÉS
import { CJServicesModule } from './services/cj-services.module';

@Module({
  imports: [
    ConfigModule,
    CJServicesModule, // 🔧 IMPORT DU MODULE DE SERVICES REFACTORISÉS
  ],
  controllers: [CJDropshippingController, CJWebhookController, CJLogisticsController, CJCountriesController, CJSettingsController, CJOrdersController, CJDisputesController, CJCategoriesController],
  providers: [
    // 🔧 SERVICES SPÉCIALISÉS (conservés)
    CJWebhookService, 
    CJLogisticsService, 
    CJCountriesService, 
    CJSettingsService, 
    CJOrdersService, 
    CJDisputesService, 
    CJCategoriesService, 
    CJAPIClient, 
    PrismaService
  ],
  exports: [
    // 🔧 EXPORTER LES NOUVEAUX SERVICES
    CJServicesModule,
    // Services spécialisés
    CJWebhookService, 
    CJLogisticsService, 
    CJCountriesService, 
    CJSettingsService, 
    CJOrdersService, 
    CJDisputesService, 
    CJCategoriesService, 
    CJAPIClient
  ],
})
export class CJDropshippingModule {}

