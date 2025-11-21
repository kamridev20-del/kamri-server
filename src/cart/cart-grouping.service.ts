import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingValidationService } from '../shipping/shipping-validation.service';

export interface CartItemGroup {
  originCountryCode: string;
  originCountryName: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    variantId?: string;
    cjVariantId?: string;
    image?: string;
  }>;
  shippingOptions?: Array<{
    logisticName: string;
    shippingTime: string;
    freight: number;
    currency: string;
  }>;
  selectedShippingOption?: {
    logisticName: string;
    shippingTime: string;
    freight: number;
    currency: string;
  };
  subtotal: number;
  shippingCost: number;
  total: number;
}

@Injectable()
export class CartGroupingService {
  private readonly logger = new Logger(CartGroupingService.name);

  constructor(
    private prisma: PrismaService,
    private shippingValidationService: ShippingValidationService,
  ) {}

  /**
   * Groupe les articles du panier par pays d'origine
   */
  async groupCartByOrigin(
    cartItems: any[],
    destinationCountryCode: string,
  ): Promise<CartItemGroup[]> {
    this.logger.log(`📦 Groupement du panier par origine pour ${destinationCountryCode}`);

    // 1. Grouper les articles par origine
    const groupsMap = new Map<string, CartItemGroup>();

    for (const item of cartItems) {
      const product = item.product;
      const originCountryCode = product.originCountryCode || 'CN'; // Par défaut CN pour CJ
      const originCountryName = this.getCountryName(originCountryCode);

      // Trouver le variant si disponible
      let variantId: string | undefined;
      let cjVariantId: string | undefined;
      
      if (product.productVariants && product.productVariants.length > 0) {
        // Prendre le premier variant actif
        const variant = product.productVariants.find((v: any) => v.isActive !== false) || product.productVariants[0];
        variantId = variant.id;
        cjVariantId = variant.cjVariantId || undefined;
      }

      // Récupérer l'image (parser le JSON si nécessaire)
      let image: string | null = null;
      if (product.images && product.images.length > 0) {
        image = product.images[0].url;
      } else if (product.image) {
        if (typeof product.image === 'string') {
          // Essayer de parser le JSON
          try {
            if (product.image.startsWith('[') || product.image.startsWith('"')) {
              const parsed = JSON.parse(product.image);
              if (Array.isArray(parsed) && parsed.length > 0) {
                image = parsed[0];
              } else if (typeof parsed === 'string') {
                image = parsed;
              }
            } else {
              // URL simple
              image = product.image;
            }
          } catch {
            // Si le parsing échoue, utiliser l'image telle quelle si c'est une URL valide
            if (product.image.startsWith('http://') || product.image.startsWith('https://')) {
              image = product.image;
            }
          }
        } else if (Array.isArray(product.image) && product.image.length > 0) {
          image = product.image[0];
        }
      }

      if (!groupsMap.has(originCountryCode)) {
        groupsMap.set(originCountryCode, {
          originCountryCode,
          originCountryName,
          items: [],
          subtotal: 0,
          shippingCost: 0,
          total: 0,
        });
      }

      const group = groupsMap.get(originCountryCode)!;
      group.items.push({
        id: item.id,
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity,
        variantId,
        cjVariantId,
        image,
      });
      group.subtotal += product.price * item.quantity;
    }

    // 2. Calculer le fret pour chaque groupe
    const groups = Array.from(groupsMap.values());
    
    for (const group of groups) {
      // Si c'est un groupe CJ (CN), calculer le fret avec TOUS les produits
      if (group.originCountryCode === 'CN' || group.items.some(item => item.cjVariantId)) {
        try {
          // Collecter tous les produits CJ avec leurs variants et quantités
          const cjProducts = group.items
            .filter(item => item.cjVariantId)
            .map(item => ({
              vid: item.cjVariantId!,
              quantity: item.quantity,
            }));

          if (cjProducts.length > 0) {
            // Utiliser le service de validation qui utilise l'API CJ en bulk
            // Pour l'instant, on prend le premier produit comme référence
            // TODO: Améliorer pour calculer le fret pour tous les produits ensemble
            const firstCJItem = group.items.find(item => item.cjVariantId);
            if (firstCJItem) {
              const product = await this.prisma.product.findUnique({
                where: { id: firstCJItem.productId },
                include: { productVariants: true },
              });

              if (product) {
                // Calculer le fret pour ce groupe (utilise l'API CJ qui gère déjà le bulk)
                const shippingResult = await this.shippingValidationService.checkProductShipping(
                  product.id,
                  destinationCountryCode,
                  firstCJItem.variantId,
                );

                if (shippingResult.shippable && shippingResult.availableMethods) {
                  group.shippingOptions = shippingResult.availableMethods;
                  // Sélectionner la première option par défaut
                  if (shippingResult.availableMethods.length > 0) {
                    group.selectedShippingOption = shippingResult.availableMethods[0];
                    group.shippingCost = shippingResult.availableMethods[0].freight;
                  }
                } else {
                  this.logger.warn(`⚠️ Aucune option de livraison pour ${group.originCountryCode} → ${destinationCountryCode}`);
                  group.shippingCost = 0;
                }
              }
            }
          } else {
            this.logger.warn(`⚠️ Aucun produit CJ trouvé dans le groupe ${group.originCountryCode}`);
            group.shippingCost = 0;
          }
        } catch (error: any) {
          this.logger.error(`❌ Erreur calcul fret pour ${group.originCountryCode}: ${error.message}`);
          group.shippingCost = 0;
        }
      } else {
        // Pour les autres origines, utiliser un tarif fixe ou 0
        group.shippingCost = 0; // TODO: Implémenter le calcul pour d'autres origines
      }

      group.total = group.subtotal + group.shippingCost;
    }

    this.logger.log(`✅ Panier groupé en ${groups.length} groupe(s) par origine`);
    return groups;
  }

  /**
   * Obtient le nom du pays depuis son code
   */
  private getCountryName(code: string): string {
    const countryNames: Record<string, string> = {
      'FR': 'France',
      'US': 'États-Unis',
      'GB': 'Royaume-Uni',
      'DE': 'Allemagne',
      'IT': 'Italie',
      'ES': 'Espagne',
      'CN': 'Chine',
      'JP': 'Japon',
      'KR': 'Corée du Sud',
      'AU': 'Australie',
      'CA': 'Canada',
      'MX': 'Mexique',
      'BR': 'Brésil',
      'IN': 'Inde',
      'NL': 'Pays-Bas',
      'BE': 'Belgique',
      'CH': 'Suisse',
      'AT': 'Autriche',
      'SE': 'Suède',
      'NO': 'Norvège',
      'DK': 'Danemark',
      'FI': 'Finlande',
      'PL': 'Pologne',
      'PT': 'Portugal',
      'GR': 'Grèce',
      'IE': 'Irlande',
    };

    return countryNames[code.toUpperCase()] || code;
  }
}

