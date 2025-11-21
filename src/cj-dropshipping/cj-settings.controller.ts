import { Controller, Get, Logger, Post } from '@nestjs/common';
import { CJSettingsService } from './cj-settings.service';

@Controller('cj-dropshipping/settings')
export class CJSettingsController {
  private readonly logger = new Logger(CJSettingsController.name);

  constructor(private readonly cjSettingsService: CJSettingsService) {}

  @Get('account')
  async getAccountSettings() {
    this.logger.log('Requête reçue pour les paramètres du compte CJ');
    return this.cjSettingsService.getAccountSettings();
  }

  @Get('quotas')
  async getQuotaLimits() {
    this.logger.log('Requête reçue pour les limites de quota');
    return this.cjSettingsService.getQuotaLimits();
  }

  @Get('qps-limit')
  async getQPSLimit() {
    this.logger.log('Requête reçue pour la limite QPS');
    return this.cjSettingsService.getQPSLimit();
  }

  @Get('sandbox-status')
  async isSandboxAccount() {
    this.logger.log('Requête reçue pour le statut sandbox');
    return this.cjSettingsService.isSandboxAccount();
  }

  @Get('account-level')
  async getAccountLevel() {
    this.logger.log('Requête reçue pour le niveau d\'accès');
    return this.cjSettingsService.getAccountLevel();
  }

  @Get('callbacks')
  async getCallbackSettings() {
    this.logger.log('Requête reçue pour les paramètres de callback');
    return this.cjSettingsService.getCallbackSettings();
  }

  @Get('webhooks-status')
  async areWebhooksEnabled() {
    this.logger.log('Requête reçue pour le statut des webhooks');
    return this.cjSettingsService.areWebhooksEnabled();
  }

  @Get('callback-urls')
  async getCallbackUrls() {
    this.logger.log('Requête reçue pour les URLs de callback');
    return this.cjSettingsService.getCallbackUrls();
  }

  @Get('performance-analysis')
  async analyzeAccountPerformance() {
    this.logger.log('Requête reçue pour l\'analyse des performances');
    return this.cjSettingsService.analyzeAccountPerformance();
  }

  @Post('sync-to-database')
  async syncSettingsToDatabase() {
    this.logger.log('Requête reçue pour la synchronisation des paramètres');
    return this.cjSettingsService.syncSettingsToDatabase();
  }

  @Get('limits-check')
  async checkAccountLimits() {
    this.logger.log('Requête reçue pour la vérification des limites');
    return this.cjSettingsService.checkAccountLimits();
  }
}
