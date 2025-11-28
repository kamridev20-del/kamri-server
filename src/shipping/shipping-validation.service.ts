import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CJAPIClient } from '../cj-dropshipping/cj-api-client';
import { ConfigService } from '@nestjs/config';

export interface ShippingCheckResult {
  shippable: boolean;
  availableMethods?: Array<{
    logisticName: string;
    shippingTime: string;
    freight: number;
    currency: string;
  }>;
  error?: string;
  originCountryCode?: string;
}

@Injectable()
export class ShippingValidationService {
  private readonly logger = new Logger(ShippingValidationService.name);
  // Cache pour les résultats de vérification de livraison (TTL: 1 heure)
  private shippingCache = new Map<string, { result: ShippingCheckResult; expiry: number }>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 heure en millisecondes

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private cjApiClient: CJAPIClient,
  ) {}

  /**
   * Initialise le client CJ API si nécessaire
   */
  private async initializeCJClient(): Promise<void> {
    try {
      const config = await this.prisma.cJConfig.findFirst();
      if (!config?.enabled) {
        this.logger.warn('⚠️ Configuration CJ non trouvée ou désactivée');
        return;
      }

      // Initialiser la configuration du client injecté
      this.cjApiClient.setConfig({
        email: config.email,
        apiKey: config.apiKey,
        tier: config.tier as 'free' | 'plus' | 'prime' | 'advanced',
        platformToken: config.platformToken,
        debug: process.env.CJ_DEBUG === 'true',
      });

      // Essayer de charger le token depuis la base de données
      const tokenLoaded = await this.cjApiClient.loadTokenFromDatabase();
      
      if (!tokenLoaded) {
        // Si le token n'est pas en base ou est expiré, faire un login
        this.logger.log('🔑 Token non trouvé en base ou expiré - Login CJ requis');
        await this.cjApiClient.login();
        this.logger.log('✅ Login CJ réussi');
      } else {
        this.logger.log('✅ Token CJ chargé depuis la base de données - Utilisation de la connexion existante');
      }
    } catch (error: any) {
      this.logger.error(`❌ Erreur initialisation client CJ: ${error.message || error}`);
    }
  }

  /**
   * Génère une clé de cache pour une vérification de livraison
   */
  private getCacheKey(productId: string, destinationCountryCode: string, variantId?: string): string {
    return `shipping:${productId}:${destinationCountryCode}:${variantId || 'default'}`;
  }

  /**
   * Nettoie le cache expiré
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.shippingCache.entries()) {
      if (value.expiry < now) {
        this.shippingCache.delete(key);
      }
    }
  }

  /**
   * Vérifie si un produit est livrable dans un pays donné
   */
  async checkProductShipping(
    productId: string,
    destinationCountryCode: string,
    variantId?: string,
  ): Promise<ShippingCheckResult> {
    try {
      // Nettoyer le cache expiré périodiquement (seulement 10% du temps pour éviter la surcharge)
      if (Math.random() < 0.1) {
        this.cleanExpiredCache();
      }

      // Vérifier le cache AVANT toute requête API
      const cacheKey = this.getCacheKey(productId, destinationCountryCode, variantId);
      const cached = this.shippingCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        this.logger.log(`✅ Résultat depuis le cache: produit ${productId} → ${destinationCountryCode}`);
        return cached.result;
      }

      this.logger.log(`🔍 Vérification livraison (nouvelle requête): produit ${productId} → ${destinationCountryCode}`);

      // 1. Récupérer le produit
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          productVariants: variantId ? {
            where: { id: variantId },
          } : true,
          cjMapping: true,
        },
      });

      if (!product) {
        return {
          shippable: false,
          error: 'Produit non trouvé',
        };
      }

      // 2. Déterminer le pays d'origine
      const originCountryCode = product.originCountryCode || 'CN';
      this.logger.log(`📍 Pays d'origine: ${originCountryCode}`);

      // 3. Si c'est un produit CJ, vérifier la livraison via l'API
      let result: ShippingCheckResult;
      if (product.source === 'cj-dropshipping' && product.cjMapping) {
        result = await this.checkCJProductShipping(
          product,
          originCountryCode,
          destinationCountryCode,
          variantId,
        );
      } else {
        // 4. Pour les autres produits, on considère qu'ils sont livrables partout
        this.logger.log(`✅ Produit non-CJ, considéré comme livrable partout`);
        result = {
          shippable: true,
          originCountryCode,
        };
      }

      // Mettre en cache le résultat (sauf en cas d'erreur de rate limit)
      if (!result.error || !result.error.includes('Too Many Requests')) {
        this.shippingCache.set(cacheKey, {
          result,
          expiry: Date.now() + this.CACHE_TTL,
        });
      }

      return result;
    } catch (error: any) {
      this.logger.error(`❌ Erreur vérification livraison: ${error.message}`);
      const result: ShippingCheckResult = {
        shippable: false,
        error: error.message || 'Erreur lors de la vérification de la livraison',
      };
      
      // Ne pas mettre en cache les erreurs de rate limit
      if (!error.message?.includes('Too Many Requests')) {
        const cacheKey = this.getCacheKey(productId, destinationCountryCode, variantId);
        this.shippingCache.set(cacheKey, {
          result,
          expiry: Date.now() + this.CACHE_TTL,
        });
      }
      
      return result;
    }
  }

  /**
   * Vérifie la livraison pour un produit CJ Dropshipping
   */
  private async checkCJProductShipping(
    product: any,
    originCountryCode: string,
    destinationCountryCode: string,
    variantId?: string,
  ): Promise<ShippingCheckResult> {
    try {
      await this.initializeCJClient();

      if (!this.cjApiClient) {
        this.logger.warn('⚠️ Client CJ non disponible');
        return {
          shippable: false,
          error: 'Service de livraison temporairement indisponible',
          originCountryCode,
        };
      }

      // Trouver le variant à utiliser
      let selectedVariant = null;
      if (variantId) {
        selectedVariant = product.productVariants?.find((v: any) => v.id === variantId);
      } else if (product.productVariants && product.productVariants.length > 0) {
        // Prendre le premier variant disponible
        selectedVariant = product.productVariants[0];
      }

      if (!selectedVariant || !selectedVariant.cjVariantId) {
        this.logger.warn('⚠️ Aucun variant CJ trouvé');
        return {
          shippable: false,
          error: 'Variant non disponible',
          originCountryCode,
        };
      }

      // Calculer le fret pour vérifier la disponibilité
      const freightOptions = await this.cjApiClient.calculateFreight(
        originCountryCode,
        destinationCountryCode,
        [
          {
            vid: selectedVariant.cjVariantId,
            quantity: 1,
          },
        ],
      );

      if (!freightOptions || !Array.isArray(freightOptions) || freightOptions.length === 0) {
        this.logger.log(`❌ Aucune option de livraison disponible pour ${originCountryCode} → ${destinationCountryCode}`);
        return {
          shippable: false,
          error: `Ce produit n'est pas livrable en ${this.getCountryName(destinationCountryCode)}`,
          originCountryCode,
        };
      }

      // Produit livrable
      this.logger.log(`✅ Produit livrable avec ${freightOptions.length} option(s)`);
      return {
        shippable: true,
        availableMethods: freightOptions.map((option) => ({
          logisticName: option.logisticName || 'Standard',
          shippingTime: option.shippingTime || 'N/A',
          freight: option.freight || 0,
          currency: option.currency || 'USD',
        })),
        originCountryCode,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur vérification livraison CJ: ${error.message}`);
      return {
        shippable: false,
        error: error.message || 'Erreur lors de la vérification de la livraison',
        originCountryCode,
      };
    }
  }

  /**
   * Obtient le nom du pays depuis son code
   * Liste complète des pays du frontend
   */
  private getCountryName(code: string): string {
    const countryNames: Record<string, string> = {
      'AR': 'Argentine',
      'AU': 'Australie',
      'AT': 'Autriche',
      'BE': 'Belgique',
      'BJ': 'Bénin',
      'BR': 'Brésil',
      'BG': 'Bulgarie',
      'BF': 'Burkina Faso',
      'CM': 'Cameroun',
      'CA': 'Canada',
      'CF': 'République centrafricaine',
      'CN': 'Chine',
      'CI': 'Côte d\'Ivoire',
      'CG': 'Congo',
      'HR': 'Croatie',
      'CY': 'Chypre',
      'CZ': 'République tchèque',
      'DK': 'Danemark',
      'EE': 'Estonie',
      'FI': 'Finlande',
      'FR': 'France',
      'GA': 'Gabon',
      'DE': 'Allemagne',
      'GR': 'Grèce',
      'GQ': 'Guinée équatoriale',
      'GW': 'Guinée-Bissau',
      'HU': 'Hongrie',
      'IS': 'Islande',
      'IN': 'Inde',
      'IE': 'Irlande',
      'IT': 'Italie',
      'JP': 'Japon',
      'KR': 'Corée du Sud',
      'LV': 'Lettonie',
      'LT': 'Lituanie',
      'LU': 'Luxembourg',
      'ML': 'Mali',
      'MT': 'Malte',
      'MX': 'Mexique',
      'NE': 'Niger',
      'NL': 'Pays-Bas',
      'NZ': 'Nouvelle-Zélande',
      'NO': 'Norvège',
      'PL': 'Pologne',
      'PT': 'Portugal',
      'RO': 'Roumanie',
      'RU': 'Russie',
      'SN': 'Sénégal',
      'SK': 'Slovaquie',
      'SI': 'Slovénie',
      'ES': 'Espagne',
      'SE': 'Suède',
      'CH': 'Suisse',
      'TD': 'Tchad',
      'TH': 'Thaïlande',
      'TG': 'Togo',
      'TR': 'Turquie',
      'UA': 'Ukraine',
      'GB': 'Royaume-Uni',
      'US': 'États-Unis',
      'VN': 'Vietnam',
      'ZA': 'Afrique du Sud',
    };

    return countryNames[code.toUpperCase()] || code;
  }
}

