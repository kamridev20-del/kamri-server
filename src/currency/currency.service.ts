import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

// ✅ Mapping pays → devise
export const countryToCurrency: Record<string, string> = {
  // Europe
  FR: 'EUR', // France
  BE: 'EUR', // Belgique
  DE: 'EUR', // Allemagne
  ES: 'EUR', // Espagne
  IT: 'EUR', // Italie
  NL: 'EUR', // Pays-Bas
  PT: 'EUR', // Portugal
  AT: 'EUR', // Autriche
  IE: 'EUR', // Irlande
  GR: 'EUR', // Grèce
  FI: 'EUR', // Finlande
  LU: 'EUR', // Luxembourg
  
  // Afrique - FCFA
  CM: 'XAF', // Cameroun
  TD: 'XAF', // Tchad
  CF: 'XAF', // République centrafricaine
  CG: 'XAF', // Congo
  GA: 'XAF', // Gabon
  GQ: 'XAF', // Guinée équatoriale
  
  SN: 'XOF', // Sénégal
  CI: 'XOF', // Côte d'Ivoire
  BF: 'XOF', // Burkina Faso
  ML: 'XOF', // Mali
  NE: 'XOF', // Niger
  TG: 'XOF', // Togo
  BJ: 'XOF', // Bénin
  GW: 'XOF', // Guinée-Bissau
  
  // Amérique
  US: 'USD', // États-Unis
  CA: 'CAD', // Canada
  MX: 'MXN', // Mexique
  BR: 'BRL', // Brésil
  
  // Asie
  CN: 'CNY', // Chine
  JP: 'JPY', // Japon
  KR: 'KRW', // Corée du Sud
  IN: 'INR', // Inde
  TH: 'THB', // Thaïlande
  VN: 'VND', // Vietnam
  
  // Autres
  GB: 'GBP', // Royaume-Uni
  AU: 'AUD', // Australie
  NZ: 'NZD', // Nouvelle-Zélande
  CH: 'CHF', // Suisse
  RU: 'RUB', // Russie
  
  // Par défaut : USD
};

// ✅ Devises supportées
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'XAF', 'XOF', 'CNY', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

// ✅ Taux de change par défaut (fallback si l'API est inaccessible)
// Mis à jour manuellement - Base USD = 1.0
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,      // 1 USD = 0.92 EUR
  GBP: 0.79,      // 1 USD = 0.79 GBP
  CAD: 1.36,      // 1 USD = 1.36 CAD
  AUD: 1.52,      // 1 USD = 1.52 AUD
  CHF: 0.88,      // 1 USD = 0.88 CHF
  CNY: 7.24,      // 1 USD = 7.24 CNY
  JPY: 149.50,    // 1 USD = 149.50 JPY
  XAF: 605.0,     // 1 USD = 605 FCFA (Afrique Centrale)
  XOF: 605.0,     // 1 USD = 605 FCFA (Afrique de l'Ouest)
};

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly EXCHANGE_API_URL = 'https://api.apilayer.com/currency_data/live';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Obtenir la devise d'un pays
   */
  getCurrencyFromCountry(countryCode: string): string {
    return countryToCurrency[countryCode.toUpperCase()] || 'USD';
  }

  /**
   * Récupérer les taux de change depuis l'API externe (Currency Data API)
   * ✅ Avec mécanisme de retry limité
   */
  async fetchExchangeRates(retries = 2): Promise<Record<string, number> | null> {
    const apiKey = this.configService.get<string>('CURRENCY_API_KEY');
    if (!apiKey) {
      // Pas de log ici, déjà géré dans updateExchangeRates
      return null;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (attempt === 1) {
          this.logger.log(`🔄 Récupération des taux de change depuis l'API...`);
        } else {
          this.logger.log(`🔄 Tentative ${attempt}/${retries}...`);
        }
        
        // Construire la liste des devises supportées
        const symbols = SUPPORTED_CURRENCIES.join(',');
        
        const response = await axios.get(this.EXCHANGE_API_URL, {
          params: {
            base: 'USD',
            symbols: symbols, // Limiter aux devises supportées
          },
          headers: {
            'apikey': apiKey,
          },
          timeout: 15000, // ✅ Réduit à 15 secondes
        });

        if (response.data && response.data.success && response.data.quotes) {
          this.logger.log('✅ Taux de change récupérés avec succès depuis l\'API');
          
          // Convertir le format quotes (USDUSD=1.0, USDEUR=0.92) en format simple (EUR=0.92)
          const rates: Record<string, number> = {};
          Object.keys(response.data.quotes).forEach((key) => {
            // key format: "USDEUR" -> extraire "EUR"
            const currency = key.replace('USD', '');
            rates[currency] = response.data.quotes[key];
          });
          
          return rates;
        }

        // Si c'est la dernière tentative, retourner null
        if (attempt === retries) {
          return null;
        }
        
        // Attendre 2 secondes avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        // Si c'est la dernière tentative, juste retourner null sans log verbeux
        if (attempt === retries) {
          return null;
        }
        
        // Attendre 2 secondes avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return null;
  }

  /**
   * Mettre à jour les taux de change dans la base de données
   */
  async updateExchangeRates(): Promise<{ success: boolean; updated: number; error?: string; usingDefaults?: boolean }> {
    try {
      // Vérifier d'abord si la clé API est configurée
      const apiKey = this.configService.get<string>('CURRENCY_API_KEY');
      if (!apiKey) {
        this.logger.warn('⚠️ CURRENCY_API_KEY non configurée - utilisation des taux par défaut');
        return await this.useDefaultRates();
      }

      const rates = await this.fetchExchangeRates();
      
      if (!rates) {
        this.logger.warn('⚠️ API inaccessible - utilisation des taux par défaut');
        return await this.useDefaultRates();
      }

      let updatedCount = 0;

      // Mettre à jour uniquement les devises supportées
      for (const currency of SUPPORTED_CURRENCIES) {
        if (rates[currency]) {
          await this.prisma.exchangeRate.upsert({
            where: { currency },
            update: {
              rate: rates[currency],
              updatedat: new Date(),
            },
            create: {
              currency,
              rate: rates[currency],
            },
          });
          updatedCount++;
        }
      }

      // Toujours inclure USD avec un taux de 1.0
      await this.prisma.exchangeRate.upsert({
        where: { currency: 'USD' },
        update: {
          rate: 1.0,
          updatedat: new Date(),
        },
        create: {
          currency: 'USD',
          rate: 1.0,
        },
      });

      this.logger.log(`✅ ${updatedCount + 1} taux de change mis à jour depuis l'API`);

      return {
        success: true,
        updated: updatedCount + 1,
      };
    } catch (error) {
      this.logger.warn(`⚠️ Erreur lors de la mise à jour - utilisation des taux par défaut`);
      return await this.useDefaultRates();
    }
  }

  /**
   * Utiliser les taux de change par défaut (fallback)
   */
  private async useDefaultRates(): Promise<{ success: boolean; updated: number; error?: string; usingDefaults: boolean }> {
    try {
      let updatedCount = 0;

      for (const [currency, rate] of Object.entries(DEFAULT_EXCHANGE_RATES)) {
        await this.prisma.exchangeRate.upsert({
          where: { currency },
          update: {
            rate: rate,
            updatedat: new Date(),
          },
          create: {
            currency,
            rate: rate,
          },
        });
        updatedCount++;
      }

      this.logger.log(`💡 ${updatedCount} taux de change par défaut appliqués`);

      return {
        success: true,
        updated: updatedCount,
        usingDefaults: true,
      };
    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'application des taux par défaut:', error);
      return {
        success: false,
        updated: 0,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        usingDefaults: true,
      };
    }
  }

  /**
   * Récupérer tous les taux de change depuis la base de données
   */
  async getExchangeRates(): Promise<Record<string, number>> {
    try {
      const rates = await this.prisma.exchangeRate.findMany({
        select: {
          currency: true,
          rate: true,
        },
      });

      const ratesMap: Record<string, number> = {};
      rates.forEach((r) => {
        ratesMap[r.currency] = r.rate;
      });

      // S'assurer que USD est toujours présent
      if (!ratesMap['USD']) {
        ratesMap['USD'] = 1.0;
      }

      return ratesMap;
    } catch (error) {
      this.logger.error('❌ Erreur lors de la récupération des taux:', error);
      // Retourner un fallback avec USD = 1.0
      return { USD: 1.0 };
    }
  }

  /**
   * Convertir un prix depuis USD vers une devise
   */
  async convertPrice(priceUSD: number, targetCurrency: string): Promise<number> {
    if (targetCurrency === 'USD') {
      return priceUSD;
    }

    try {
      const rate = await this.prisma.exchangeRate.findUnique({
        where: { currency: targetCurrency },
      });

      if (!rate) {
        this.logger.warn(`⚠️ Taux non trouvé pour ${targetCurrency}, utilisation de USD`);
        return priceUSD;
      }

      return priceUSD * rate.rate;
    } catch (error) {
      this.logger.error(`❌ Erreur conversion ${targetCurrency}:`, error);
      return priceUSD;
    }
  }

  /**
   * Formater un prix selon la devise
   */
  formatPrice(price: number, currency: string): string {
    try {
      return new Intl.NumberFormat(this.getLocaleFromCurrency(currency), {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(price);
    } catch (error) {
      // Fallback simple
      return `${price.toFixed(2)} ${currency}`;
    }
  }

  /**
   * Obtenir la locale selon la devise
   */
  private getLocaleFromCurrency(currency: string): string {
    const localeMap: Record<string, string> = {
      USD: 'en-US',
      EUR: 'fr-FR',
      GBP: 'en-GB',
      CNY: 'zh-CN',
      JPY: 'ja-JP',
      CAD: 'en-CA',
      AUD: 'en-AU',
      XAF: 'fr-FR',
      XOF: 'fr-FR',
    };

    return localeMap[currency] || 'en-US';
  }
}

