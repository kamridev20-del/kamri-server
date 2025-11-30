// ✅ VERSION OPTIMISÉE - CurrencyScheduler
// Fichier source : src/currency/currency.scheduler.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CurrencyService } from './currency.service';

@Injectable()
export class CurrencyScheduler implements OnModuleInit {
  private readonly logger = new Logger(CurrencyScheduler.name);
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(private readonly currencyService: CurrencyService) {}

  onModuleInit() {
    // ✅ OPTIMISATION : Vérifier si la synchronisation est activée
    const isProduction = process.env.NODE_ENV === 'production';
    const enableCurrencySync = process.env.ENABLE_CURRENCY_SYNC === 'true';
    
    if (!isProduction || !enableCurrencySync) {
      this.logger.log('⚠️ CurrencyScheduler désactivé (mode développement/test)');
      this.logger.log('💡 Pour activer : définir ENABLE_CURRENCY_SYNC=true dans .env');
      return;
    }
    
    // ✅ Mise à jour initiale au démarrage (non bloquante)
    // On attend 30 secondes pour laisser l'application démarrer complètement
    setTimeout(() => {
      this.updateExchangeRates();
    }, 30000); // Délai de 30 secondes après le démarrage
    
    // Mise à jour toutes les 24 heures (86400000 ms)
    this.updateInterval = setInterval(() => {
      this.updateExchangeRates();
    }, 24 * 60 * 60 * 1000);
    
    this.logger.log('✅ CurrencyScheduler initialisé - Première mise à jour dans 30s, puis toutes les 24h');
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
        if (result.usingDefaults) {
          this.logger.log(`💡 ${result.updated} taux de change par défaut appliqués (API externe inaccessible)`);
        } else {
          this.logger.log(`✅ ${result.updated} taux de change mis à jour depuis l'API`);
        }
      } else {
        // Ne pas logger comme erreur - juste un avertissement
        this.logger.warn(`⚠️ Impossible de mettre à jour les taux: ${result.error}`);
      }
    } catch (error) {
      // Erreur silencieuse - ne pas polluer les logs
      this.logger.warn(`⚠️ Mise à jour des taux ignorée: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}


