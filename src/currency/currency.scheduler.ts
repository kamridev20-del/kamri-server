import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CurrencyService } from './currency.service';

@Injectable()
export class CurrencyScheduler implements OnModuleInit {
  private readonly logger = new Logger(CurrencyScheduler.name);
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(private readonly currencyService: CurrencyService) {}

  onModuleInit() {
    // Mise à jour initiale au démarrage
    this.updateExchangeRates();
    
    // Mise à jour toutes les 24 heures (86400000 ms)
    this.updateInterval = setInterval(() => {
      this.updateExchangeRates();
    }, 24 * 60 * 60 * 1000);
    
    this.logger.log('✅ CurrencyScheduler initialisé - Mise à jour automatique toutes les 24h');
  }

  onModuleDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  /**
   * Mise à jour automatique des taux de change
   */
  async updateExchangeRates() {
    this.logger.log('🔄 Mise à jour automatique des taux de change...');
    const result = await this.currencyService.updateExchangeRates();
    if (result.success) {
      this.logger.log(`✅ ${result.updated} taux de change mis à jour avec succès`);
    } else {
      this.logger.error(`❌ Erreur lors de la mise à jour: ${result.error}`);
    }
  }
}
