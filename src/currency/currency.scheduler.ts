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
    try {
      const result = await this.currencyService.updateExchangeRates();
      if (result.success) {
        this.logger.log(`✅ ${result.updated} taux de change mis à jour avec succès`);
      } else {
        // Ne pas logger comme erreur si c'est juste la clé API manquante (c'est un avertissement)
        if (result.error?.includes('CURRENCY_API_KEY') || result.error?.includes('non configurée')) {
          this.logger.warn(`⚠️ Mise à jour des taux de change ignorée: ${result.error}`);
          this.logger.warn(`💡 Pour activer la mise à jour automatique, configurez CURRENCY_API_KEY dans vos variables d'environnement`);
        } else {
          this.logger.error(`❌ Erreur lors de la mise à jour: ${result.error}`);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Erreur lors de la mise à jour des taux de change: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
