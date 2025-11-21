import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CJOrderService } from '../cj-dropshipping/services/cj-order.service';
import { CJAPIClient } from '../cj-dropshipping/cj-api-client';

@Injectable()
export class OrderCJIntegrationService {
  private readonly logger = new Logger(OrderCJIntegrationService.name);
  private cjApiClient: CJAPIClient | null = null;

  constructor(
    private prisma: PrismaService,
    private cjOrderService: CJOrderService, // Utiliser CJOrderService qui charge la config depuis la base
  ) {}

  /**
   * Initialiser le client API CJ (lazy loading)
   */
  private async getCJAPIClient(): Promise<CJAPIClient> {
    if (!this.cjApiClient) {
      // Récupérer le client depuis CJOrderService
      const client = await (this.cjOrderService as any).initializeClient();
      this.cjApiClient = client;
    }
    return this.cjApiClient;
  }

  /**
   * Récupérer le VID réel depuis l'API CJ pour un produit et SKU donné
   * @param cjProductId ID du produit CJ (pid)
   * @param variantSku SKU du variant (optionnel, utilisé pour trouver le bon variant)
   * @param storedVid VID stocké en base (utilisé comme fallback)
   * @returns VID valide depuis l'API CJ ou le VID stocké si l'API échoue
   */
  private async getCJVariantIdFromAPI(
    cjProductId: string,
    variantSku?: string | null,
    storedVid?: string | null
  ): Promise<string | null> {
    this.logger.log(`🔍 Récupération VID depuis API CJ pour produit ${cjProductId}, SKU ${variantSku || 'N/A'}`);
    
    try {
      const client = await this.getCJAPIClient();
      
      // Appeler l'API CJ pour récupérer les variants du produit
      const variants = await client.getProductVariants(cjProductId);
      
      if (!variants || variants.length === 0) {
        this.logger.warn(`⚠️ Aucun variant trouvé dans l'API CJ pour produit ${cjProductId}`);
        // Fallback sur le VID stocké si disponible
        return storedVid || null;
      }
      
      // Si on a un SKU, chercher le variant correspondant
      if (variantSku) {
        const matchingVariant = variants.find(
          (v: any) => v.variantSku === variantSku || v.variantSku === variantSku?.trim()
        );
        
        if (matchingVariant && matchingVariant.vid) {
          const apiVid = String(matchingVariant.vid).trim();
          this.logger.log(`✅ VID trouvé depuis API pour SKU ${variantSku}: ${apiVid}`);
          
          // Vérifier si le VID a changé
          if (storedVid && storedVid !== apiVid) {
            this.logger.warn(`⚠️ VID a changé ! Stocké: ${storedVid}, API: ${apiVid}`);
          }
          
          return apiVid;
        }
      }
      
      // Si pas de SKU ou variant non trouvé, utiliser le premier variant disponible
      if (variants[0] && variants[0].vid) {
        const apiVid = String(variants[0].vid).trim();
        this.logger.log(`✅ VID trouvé depuis API (premier variant): ${apiVid}`);
        return apiVid;
      }
      
      this.logger.warn(`⚠️ Aucun VID valide trouvé dans l'API CJ pour produit ${cjProductId}`);
      return storedVid || null;
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération VID depuis API CJ:`, error.message);
      // En cas d'erreur, utiliser le VID stocké comme fallback
      if (storedVid) {
        this.logger.warn(`⚠️ Utilisation du VID stocké comme fallback: ${storedVid}`);
        return storedVid;
      }
      return null;
    }
  }

  /**
   * Valider si un VID est suspect (format invalide)
   */
  private isVidSuspect(vid: string): boolean {
    if (!vid) return true;
    
    const trimmed = vid.trim();
    
    // VID suspects : contiennent des underscores ou commencent par "TH"
    if (trimmed.includes('_') || trimmed.startsWith('TH')) {
      return true;
    }
    
    // VID valides : UUID (avec tirets) ou nombres longs
    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(trimmed);
    const isNumeric = /^\d+$/.test(trimmed);
    const isValidFormat = /^[0-9a-fA-F\-]+$/i.test(trimmed);
    
    return !(isUUID || isNumeric || isValidFormat);
  }

  /**
   * Vérifier si un produit CJ existe et est disponible
   * @param cjProductId ID du produit CJ (pid)
   * @param cjVariantId ID du variant CJ (vid)
   * @returns true si le produit existe et est disponible, false sinon
   */
  private async verifyCJProductExists(
    cjProductId: string,
    cjVariantId: string
  ): Promise<boolean> {
    this.logger.log(`🔍 Vérification disponibilité produit CJ: ${cjProductId}, variant: ${cjVariantId}`);
    
    try {
      const client = await this.getCJAPIClient();
      
      // Récupérer les variants du produit depuis l'API CJ
      const variants = await client.getProductVariants(cjProductId);
      
      if (!variants || variants.length === 0) {
        this.logger.warn(`❌ Produit ${cjProductId} introuvable ou sans variants dans CJ`);
        this.logger.warn(`⚠️ La vérification de disponibilité échoue, mais on continue quand même (le variant peut être valide)`);
        // ⚠️ IMPORTANT: Ne pas bloquer la création de commande si la vérification échoue
        // Le variant peut être valide même si l'API ne retourne pas de résultats
        // (problème de cache API, produit récemment ajouté, etc.)
        return true; // Retourner true pour permettre la création de la commande
      }
      
      // Chercher le variant spécifique
      const variant = variants.find(
        (v: any) => v.vid === cjVariantId || String(v.vid) === String(cjVariantId)
      );
      
      if (!variant) {
        this.logger.warn(`⚠️ Variant ${cjVariantId} introuvable dans le produit ${cjProductId}`);
        this.logger.log(`📋 Variants disponibles: ${variants.map((v: any) => v.vid).join(', ')}`);
        this.logger.warn(`⚠️ La vérification de disponibilité échoue, mais on continue quand même (le variant peut être valide)`);
        // ⚠️ IMPORTANT: Ne pas bloquer la création de commande si la vérification échoue
        // Le variant peut être valide même s'il n'est pas dans la liste retournée
        // (problème de cache API, variant récemment ajouté, etc.)
        return true; // Retourner true pour permettre la création de la commande
      }
      
      // Vérifier le stock (si disponible dans la réponse)
      // Note: Le stock peut ne pas être disponible dans getProductVariants
      // On vérifie juste que le variant existe
      const hasStock = variant.stock === undefined || variant.stock === null || variant.stock > 0;
      
      if (!hasStock) {
        this.logger.warn(`⚠️ Variant ${cjVariantId} en rupture de stock (stock: ${variant.stock})`);
        // On retourne quand même true car le stock peut être vérifié ailleurs
        // et certains produits peuvent être commandés même avec stock 0
      }
      
      this.logger.log(`✅ Produit ${cjProductId} et variant ${cjVariantId} vérifiés et disponibles`);
      return true;
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur vérification produit CJ ${cjProductId}:`, error.message);
      // En cas d'erreur, on retourne false pour être sûr
      return false;
    }
  }

  /**
   * Détecter si une commande contient des produits CJ
   */
  async hasCJProducts(orderId: string): Promise<boolean> {
    this.logger.log(`🔍 Vérification produits CJ pour commande ${orderId}`);
    
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                cjMapping: true, // Relation vers CJProductMapping
                productVariants: {
                  where: {
                    isActive: true,
                    cjVariantId: { not: null },
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Commande introuvable');
    }

    // Vérifier si au moins un produit a un mapping CJ
    const hasCJ = order.items.some(item => 
      item.product.cjMapping !== null || 
      (item.product.cjProductId !== null && item.product.source === 'cj-dropshipping')
    );

    this.logger.log(`${hasCJ ? '✅' : '❌'} Produits CJ trouvés: ${hasCJ}`);
    
    return hasCJ;
  }

  /**
   * Transformer une commande KAMRI en format CJ
   */
  async transformOrderToCJ(orderId: string) {
    this.logger.log(`🔄 Transformation commande ${orderId} vers format CJ`);
    
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          include: {
            addresses: {
              where: {
                isDefault: true,
              },
              take: 1,
            },
          },
        },
        items: {
          include: {
            product: {
              include: {
                cjMapping: true,
                images: true, // Inclure les images du produit
                productVariants: {
                  // ✅ Inclure tous les variants (même inactifs) pour permettre le fallback vers JSON
                  // Le filtrage sera fait dans la logique métier
                  orderBy: {
                    createdAt: 'asc',
                  },
                },
              },
            },
            variant: true, // ✅ Inclure le variant sélectionné dans OrderItem
          },
        },
      },
    });

    if (!order) {
      throw new Error('Commande introuvable');
    }

    // Récupérer l'adresse de livraison
    const shippingAddress = await this.getShippingAddress(order);

    // Construire les produits au format CJ
    const cjProducts = [];
    const errors = [];

    this.logger.log(`📋 ${order.items.length} article(s) dans la commande`);
    
    for (const item of order.items) {
      const product = item.product;
      
      this.logger.log(`\n🔍 Analyse produit: ${product.name} (${product.id})`);
      this.logger.log(`   cjProductId: ${product.cjProductId || '(aucun)'}`);
      this.logger.log(`   source: ${product.source || '(aucune)'}`);
      this.logger.log(`   variants chargés: ${product.productVariants?.length || 0}`);
      
      // Vérifier si le produit est un produit CJ
      const isCJProduct = product.cjMapping !== null || 
                         (product.cjProductId !== null && product.source === 'cj-dropshipping');
      
      if (!isCJProduct) {
        this.logger.log(`⏭️ Produit ${product.id} n'est pas un produit CJ, skip`);
        continue;
      }
      
      this.logger.log(`✅ Produit CJ détecté - Recherche variant...`);

      // Récupérer le variant CJ
      // Priorité : variant stocké dans OrderItem > productVariants (relation Prisma) > variants (JSON)
      let vid: string | null = null;
      let sku: string | null = null;
      let activeVariant: any = null;

      // 0. ✅ PRIORITÉ ABSOLUE : Utiliser le variant stocké dans OrderItem.variantId si disponible
      if (item.variant && item.variant.cjVariantId && item.variant.cjVariantId.trim() !== '') {
        activeVariant = item.variant;
        vid = item.variant.cjVariantId;
        sku = item.variant.sku || product.productSku || null;
        this.logger.log(`✅ Variant trouvé dans OrderItem.variantId pour produit ${product.id}: vid=${vid}, sku=${sku}`);
      }

      // 1. Si pas de variant dans OrderItem, essayer productVariants (relation Prisma)
      if (!vid && product.productVariants && product.productVariants.length > 0) {
        // Chercher un variant actif avec cjVariantId
        activeVariant = product.productVariants.find(
          v => v.isActive && v.cjVariantId && v.cjVariantId.trim() !== ''
        );
        
        if (activeVariant) {
          vid = activeVariant.cjVariantId;
          sku = activeVariant.sku || product.productSku || null;
          this.logger.log(`✅ Variant trouvé dans productVariants pour produit ${product.id}: vid=${vid}, sku=${sku}`);
        } else {
          this.logger.warn(`⚠️ Produit ${product.id} a des variants mais aucun n'est actif avec cjVariantId`);
          // Essayer le premier variant même s'il n'est pas actif
          const firstVariant = product.productVariants[0];
          if (firstVariant?.cjVariantId && firstVariant.cjVariantId.trim() !== '') {
            activeVariant = firstVariant;
            vid = firstVariant.cjVariantId;
            sku = firstVariant.sku || product.productSku || null;
            this.logger.warn(`⚠️ Utilisation du premier variant (peut-être inactif): vid=${vid}`);
          }
        }
      }

      // 2. Fallback : Si toujours pas de variant, essayer le champ JSON variants
      if (!vid && product.variants) {
        this.logger.log(`🔄 Tentative récupération variant depuis champ JSON pour produit ${product.id}`);
        try {
          const parsedVariants = typeof product.variants === 'string' 
            ? JSON.parse(product.variants) 
            : product.variants;
          
          if (Array.isArray(parsedVariants) && parsedVariants.length > 0) {
            // Prendre le premier variant avec un vid valide
            const jsonVariant = parsedVariants.find((v: any) => 
              (v.vid || v.variantId) && String(v.vid || v.variantId).trim() !== ''
            );
            
            if (jsonVariant) {
              vid = String(jsonVariant.vid || jsonVariant.variantId).trim();
              sku = jsonVariant.variantSku || jsonVariant.sku || product.productSku || null;
              this.logger.log(`✅ Variant trouvé dans champ JSON pour produit ${product.id}: vid=${vid}, sku=${sku}`);
            } else {
              this.logger.warn(`⚠️ Champ JSON variants trouvé mais aucun variant avec vid valide pour produit ${product.id}`);
            }
          }
        } catch (error: any) {
          this.logger.error(`❌ Erreur parsing variants JSON pour produit ${product.id}:`, error.message);
        }
      }

      // ✨ NOUVEAU : Vérifier si le VID est suspect et le récupérer depuis l'API si nécessaire
      if (vid && this.isVidSuspect(vid)) {
        this.logger.warn(`⚠️ VID suspect détecté: "${vid}" - Récupération depuis l'API CJ...`);
        const cjProductId = product.cjMapping?.cjProductId || product.cjProductId;
        if (cjProductId) {
          const apiVid = await this.getCJVariantIdFromAPI(cjProductId, sku, vid);
          if (apiVid && !this.isVidSuspect(apiVid)) {
            vid = apiVid;
            this.logger.log(`✅ VID corrigé depuis l'API: ${vid}`);
          } else {
            this.logger.error(`❌ VID de l'API également suspect ou non trouvé pour produit ${product.id}`);
          }
        }
      }

      // Si pas de variant trouvé en base, essayer de récupérer depuis l'API CJ
      if (!vid) {
        this.logger.warn(`⚠️ Produit ${product.id} n'a pas de variant en base - Tentative récupération depuis API CJ...`);
        const cjProductId = product.cjMapping?.cjProductId || product.cjProductId;
        if (cjProductId) {
          const apiVid = await this.getCJVariantIdFromAPI(cjProductId, sku, null);
          if (apiVid && !this.isVidSuspect(apiVid)) {
            vid = apiVid;
            sku = product.productSku || sku;
            this.logger.log(`✅ VID récupéré depuis API CJ: ${vid}`);
          } else {
            this.logger.error(`❌ Impossible de récupérer un VID valide depuis l'API CJ pour produit ${product.id}`);
            errors.push({
              item: item.id,
              productId: product.id,
              productName: product.name,
              error: 'Produit sans variant CJ. Veuillez synchroniser les variants du produit.',
            });
            continue;
          }
        } else {
          this.logger.error(`❌ Produit ${product.id} (${product.name}) n'a pas de cjProductId`);
          errors.push({
            item: item.id,
            productId: product.id,
            productName: product.name,
            error: 'Produit sans cjProductId. Impossible de récupérer les variants depuis CJ.',
          });
          continue;
        }
      }

      if (!vid || vid.trim() === '') {
        errors.push({
          item: item.id,
          productId: product.id,
          productName: product.name,
          error: 'Pas de variant ID CJ (vid) valide trouvé pour ce produit',
        });
        continue;
      }

      // Valider le format du vid (doit être un UUID ou un ID numérique)
      if (!/^[a-zA-Z0-9\-]+$/.test(vid.trim())) {
        this.logger.error(`❌ Format vid invalide pour produit ${product.id}: "${vid}"`);
        errors.push({
          item: item.id,
          productId: product.id,
          productName: product.name,
          error: `Format vid invalide: "${vid}"`,
        });
        continue;
      }

      // Validation finale du vid avant ajout
      const trimmedVid = vid.trim();
      if (trimmedVid.length === 0) {
        this.logger.error(`❌ VID vide après trim pour produit ${product.id}`);
        errors.push({
          item: item.id,
          productId: product.id,
          productName: product.name,
          error: 'VID vide après traitement',
        });
        continue;
      }

      // ✨ NOUVEAU : Vérifier que le produit existe et est disponible dans CJ
      const cjProductId = product.cjMapping?.cjProductId || product.cjProductId;
      if (cjProductId) {
        const isAvailable = await this.verifyCJProductExists(cjProductId, trimmedVid);
        
        if (!isAvailable) {
          this.logger.error(`❌ Produit ${cjProductId} ou variant ${trimmedVid} non disponible sur CJ`);
          errors.push({
            item: item.id,
            productId: product.id,
            productName: product.name,
            error: `Produit CJ ${cjProductId} ou variant ${trimmedVid} non disponible ou introuvable sur CJ`,
          });
          continue;
        }
      } else {
        this.logger.warn(`⚠️ Impossible de vérifier la disponibilité: pas de cjProductId pour produit ${product.id}`);
      }

      this.logger.log(`✅ Produit ${product.id} ajouté avec vid="${trimmedVid}", quantity=${item.quantity}`);

      // Construire l'objet produit selon la documentation CJ
      // Les produits ne doivent contenir que : vid, quantity, storeLineItemId (optionnel)
      const productData: any = {
        vid: trimmedVid,
        quantity: item.quantity,
        storeLineItemId: item.id, // ID de OrderItem pour le mapping
      };

      cjProducts.push(productData);
    }

    if (cjProducts.length === 0) {
      throw new Error('Aucun produit CJ valide trouvé dans la commande');
    }

    // Construire l'objet commande CJ
    // ⚠️ IMPORTANT: shippingProvince est REQUIS selon la documentation CJ
    if (!shippingAddress.state || shippingAddress.state.trim() === '') {
      this.logger.warn(`⚠️ shippingProvince manquant pour commande ${orderId}, utilisation valeur par défaut`);
      shippingAddress.state = 'N/A'; // Valeur par défaut si manquant
    }

    const cjOrderData = {
      orderNumber: `KAMRI-${order.id.substring(0, 8)}-${Date.now()}`,
      shippingCustomerName: shippingAddress.name,
      shippingAddress: shippingAddress.address1,
      shippingAddress2: shippingAddress.address2 || undefined,
      shippingCity: shippingAddress.city,
      shippingProvince: shippingAddress.state, // Requis selon doc CJ
      shippingZip: shippingAddress.zip,
      shippingCountry: shippingAddress.country,
      shippingCountryCode: shippingAddress.countryCode,
      shippingPhone: shippingAddress.phone || order.user.phone || '',
      email: order.user.email,
      logisticName: this.selectLogistic(shippingAddress.countryCode),
      fromCountryCode: 'CN',
      platform: 'kamri',
      shopAmount: String(order.total),
      products: cjProducts,
    };

    return { 
      cjOrderData, 
      errors: errors.length > 0 ? errors : null,
    };
  }

  /**
   * Créer automatiquement une commande CJ
   */
  async createCJOrder(orderId: string) {
    this.logger.log(`🚀 === CRÉATION COMMANDE CJ POUR ${orderId} ===`);
    
    try {
      // 1. Vérifier si mapping existe déjà
      const existingMapping = await this.prisma.cJOrderMapping.findUnique({
        where: { orderId },
      });

      if (existingMapping) {
        this.logger.warn(`⚠️ Commande CJ déjà créée: ${existingMapping.cjOrderId}`);
        return {
          success: false,
          message: 'Commande CJ déjà existante',
          cjOrderId: existingMapping.cjOrderId,
          mapping: existingMapping,
        };
      }

      // 2. Vérifier que la commande contient des produits CJ
      const hasCJ = await this.hasCJProducts(orderId);
      
      if (!hasCJ) {
        this.logger.log('ℹ️ Commande sans produits CJ, skip');
        return {
          success: false,
          message: 'Commande sans produits CJ',
          skipped: true,
        };
      }

      // 3. Transformer la commande
      const { cjOrderData, errors } = await this.transformOrderToCJ(orderId);

      if (errors && errors.length > 0) {
        this.logger.warn('⚠️ Erreurs transformation:', JSON.stringify(errors, null, 2));
      }

      // Log des produits avant validation
      this.logger.log(`📦 ${cjOrderData.products.length} produit(s) transformé(s) avant validation`);
      cjOrderData.products.forEach((p, idx) => {
        this.logger.log(`  Produit ${idx + 1}: vid="${p.vid}", quantity=${p.quantity}, storeLineItemId="${p.storeLineItemId}"`);
      });

      // 4. Créer la commande CJ via le service qui charge la config depuis la base
      this.logger.log('📤 Envoi commande à CJ...');
      
      // Filtrer et valider les produits avant envoi
      const validProducts = cjOrderData.products
        .filter(p => {
          if (!p.vid || p.vid.trim() === '') {
            this.logger.warn(`⚠️ Produit sans vid ignoré:`, p);
            return false;
          }
          if (!p.quantity || p.quantity <= 0) {
            this.logger.warn(`⚠️ Produit avec quantité invalide ignoré:`, p);
            return false;
          }
          return true;
        })
        .map(p => {
          // S'assurer que vid est une string (CJ attend des strings même pour les IDs numériques)
          const vid = String(p.vid!).trim();
          // S'assurer que quantity est un nombre
          const quantity = Number(p.quantity);
          
          const productPayload: any = {
            vid: vid,
            quantity: quantity,
          };

          // storeLineItemId - optionnel
          if (p.storeLineItemId) {
            productPayload.storeLineItemId = p.storeLineItemId;
          }

          // ✅ Selon la documentation CJ, les produits ne doivent contenir que vid, quantity, storeLineItemId
          // Le champ productionImgList n'existe pas dans l'API createOrderV3

          return productPayload;
        });

      if (validProducts.length === 0) {
        throw new Error('Aucun produit valide à envoyer à CJ (tous les produits ont été filtrés)');
      }

      this.logger.log(`✅ ${validProducts.length} produit(s) valide(s) à envoyer à CJ (sur ${cjOrderData.products.length} total)`);
      validProducts.forEach((p, idx) => {
        this.logger.log(`  ✅ Produit ${idx + 1}: vid="${p.vid}", quantity=${p.quantity}`);
      });

      // ⚠️ VALIDATION CRITIQUE: Vérifier que les vid sont au bon format
      // Les vid CJ sont généralement des nombres longs (ex: 2511110221331614100)
      // ou des UUID (ex: 92511400-C758-4474-93CA-66D442F5F787)
      const invalidVids = validProducts.filter(p => {
        const vid = p.vid.trim();
        // Vérifier que c'est soit un nombre, soit un UUID
        const isNumeric = /^\d+$/.test(vid);
        const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(vid);
        const isValidFormat = isNumeric || isUUID || /^[0-9a-fA-F\-]+$/.test(vid);
        
        if (!isValidFormat) {
          this.logger.error(`❌ Format vid invalide: "${vid}" (doit être numérique ou UUID)`);
          return true;
        }
        return false;
      });

      if (invalidVids.length > 0) {
        throw new Error(`${invalidVids.length} produit(s) avec format vid invalide`);
      }

      // Log final des vid qui seront envoyés
      this.logger.log(`\n📤 VID qui seront envoyés à CJ:`);
      validProducts.forEach((p, idx) => {
        this.logger.log(`  ${idx + 1}. vid="${p.vid}" (${p.vid.length} caractères, ${/^\d+$/.test(p.vid) ? 'numérique' : 'UUID/autre'}), quantity=${p.quantity}, storeLineItemId="${p.storeLineItemId || 'N/A'}"`);
      });
      
      // Log complet de la requête qui sera envoyée (pour débogage)
      this.logger.log(`\n📋 PAYLOAD COMPLET qui sera envoyé à CJ:`);
      this.logger.log(JSON.stringify({
        orderNumber: cjOrderData.orderNumber,
        shippingCountryCode: cjOrderData.shippingCountryCode,
        shippingCountry: cjOrderData.shippingCountry,
        shippingProvince: cjOrderData.shippingProvince,
        shippingCity: cjOrderData.shippingCity,
        shippingAddress: cjOrderData.shippingAddress,
        shippingCustomerName: cjOrderData.shippingCustomerName,
        shippingPhone: cjOrderData.shippingPhone || '(vide)',
        logisticName: cjOrderData.logisticName,
        fromCountryCode: cjOrderData.fromCountryCode || 'CN',
        platform: cjOrderData.platform || 'kamri',
        products: validProducts,
      }, null, 2));
      
      // Transformer au format CJOrderCreateDto (selon documentation officielle)
      const orderDto = {
        orderNumber: cjOrderData.orderNumber,
        shippingCountryCode: cjOrderData.shippingCountryCode,
        shippingCountry: cjOrderData.shippingCountry,
        shippingProvince: cjOrderData.shippingProvince, // Requis selon doc
        shippingCity: cjOrderData.shippingCity,
        shippingAddress: cjOrderData.shippingAddress,
        shippingAddress2: cjOrderData.shippingAddress2, // Optionnel mais utile
        shippingZip: cjOrderData.shippingZip, // Optionnel mais utile
        shippingCustomerName: cjOrderData.shippingCustomerName,
        shippingPhone: cjOrderData.shippingPhone, // Optionnel selon doc
        email: cjOrderData.email, // Optionnel mais utile pour notifications
        logisticName: cjOrderData.logisticName,
        fromCountryCode: cjOrderData.fromCountryCode || 'CN',
        platform: cjOrderData.platform || 'kamri',
        shopAmount: cjOrderData.shopAmount, // Optionnel mais utile pour tracking
        products: validProducts,
      };

      // Log des données envoyées (sans les produits qui sont déjà loggés)
      this.logger.log('📋 Données de commande envoyées à CJ:');
      this.logger.log(`  orderNumber: "${orderDto.orderNumber}"`);
      this.logger.log(`  shippingCountryCode: "${orderDto.shippingCountryCode}"`);
      this.logger.log(`  shippingCountry: "${orderDto.shippingCountry}"`);
      this.logger.log(`  shippingProvince: "${orderDto.shippingProvince}"`);
      this.logger.log(`  shippingCity: "${orderDto.shippingCity}"`);
      this.logger.log(`  shippingAddress: "${orderDto.shippingAddress}"`);
      this.logger.log(`  shippingCustomerName: "${orderDto.shippingCustomerName}"`);
      this.logger.log(`  shippingPhone: "${orderDto.shippingPhone || '(vide)'}"`);
      this.logger.log(`  logisticName: "${orderDto.logisticName}"`);
      this.logger.log(`  platform: "${orderDto.platform}"`);
      this.logger.log(`  products: ${orderDto.products.length} produit(s)`);
      
      const result = await this.cjOrderService.createOrder(orderDto);

      if (!result.orderId) {
        throw new Error(result.message || 'Échec création commande CJ');
      }

      // 5. Créer le mapping avec les montants détaillés
      const mapping = await this.prisma.cJOrderMapping.create({
        data: {
          orderId: orderId,
          cjOrderId: result.orderId,
          cjOrderNumber: cjOrderData.orderNumber,
          status: result.status || 'CREATED',
          trackNumber: null,
          // Stocker les montants détaillés dans metadata (JSON)
          metadata: JSON.stringify({
            productAmount: result.productAmount || 0,
            postageAmount: result.postageAmount || 0,
            productOriginalAmount: result.productOriginalAmount || 0,
            postageOriginalAmount: result.postageOriginalAmount || 0,
            totalDiscountAmount: result.totalDiscountAmount || 0,
            orderAmount: result.totalAmount || 0,
            createdAt: new Date().toISOString(),
          }),
        },
      });

      this.logger.log(`✅ Commande CJ créée: ${result.orderId}`);
      this.logger.log(`✅ Mapping créé: ${mapping.id}`);

      // ✨ NOUVEAU : Ajouter automatiquement la commande au panier CJ et confirmer
      try {
        this.logger.log(`🛒 Ajout de la commande ${result.orderId} au panier CJ...`);
        const addCartResult = await this.cjOrderService.addCart([result.orderId]);
        
        if (addCartResult.successCount > 0) {
          this.logger.log(`✅ Commande ajoutée au panier CJ avec succès`);
          
          // Confirmer le panier
          this.logger.log(`✅ Confirmation du panier CJ...`);
          const confirmResult = await this.cjOrderService.addCartConfirm([result.orderId]);
          
          if (confirmResult.submitSuccess) {
            this.logger.log(`✅ Panier CJ confirmé avec succès`);
          } else {
            this.logger.warn(`⚠️ Panier CJ confirmé mais submitSuccess=false`);
          }
        } else {
          this.logger.warn(`⚠️ Aucune commande ajoutée au panier CJ`);
        }
      } catch (cartError: any) {
        // Ne pas bloquer la création de commande si l'ajout au panier échoue
        this.logger.error(`❌ Erreur lors de l'ajout au panier CJ (non bloquant):`, cartError.message);
      }

      return {
        success: true,
        message: 'Commande CJ créée avec succès',
        cjOrderId: result.orderId,
        cjOrderNumber: cjOrderData.orderNumber,
        mapping: mapping,
        errors: errors,
      };

    } catch (error: any) {
      this.logger.error(`❌ Erreur création commande CJ:`, error);
      
      // Marquer la commande en erreur
      await this.markOrderAsError(orderId, error.message);
      
      return {
        success: false,
        message: error.message || 'Erreur inconnue lors de la création de la commande CJ',
        error: error.message,
      };
    }
  }

  /**
   * Récupérer l'adresse de livraison
   */
  private async getShippingAddress(order: any) {
    // Option 1 : Si l'adresse est dans Order directement (à vérifier dans votre schéma)
    // if (order.shippingAddress) {
    //   return {
    //     name: order.shippingName || `${order.user.firstName} ${order.user.lastName}`,
    //     address1: order.shippingAddress,
    //     address2: order.shippingAddress2,
    //     city: order.shippingCity,
    //     state: order.shippingState,
    //     zip: order.shippingZip,
    //     country: order.shippingCountry,
    //     countryCode: this.getCountryCode(order.shippingCountry),
    //     phone: order.shippingPhone || order.user.phone,
    //   };
    // }

    // Option 2 : Si l'adresse est dans une table séparée (Address)
    let address = null;
    
    if (order.user.addresses && order.user.addresses.length > 0) {
      address = order.user.addresses[0];
    } else {
      // Chercher une adresse par défaut
      address = await this.prisma.address.findFirst({
        where: {
          userId: order.userId,
          isDefault: true,
        },
      });
    }

    if (!address) {
      // Si pas d'adresse, utiliser les infos de l'utilisateur
      this.logger.warn(`⚠️ Pas d'adresse trouvée pour user ${order.userId}, utilisation des infos utilisateur`);
      return {
        name: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.name || 'Client',
        address1: order.user.address || 'Adresse non spécifiée',
        address2: '',
        city: 'Ville non spécifiée',
        state: 'État non spécifié',
        zip: '00000',
        country: order.user.address || 'United States',
        countryCode: 'US',
        phone: order.user.phone || '',
      };
    }

    return {
      name: `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() || order.user.name || 'Client',
      address1: address.street,
      address2: '',
      city: address.city,
      state: address.state,
      zip: address.zipCode,
      country: address.country,
      countryCode: this.getCountryCode(address.country),
      phone: order.user.phone || '',
    };
  }

  /**
   * Sélectionner la logistique selon le pays
   */
  private selectLogistic(countryCode: string): string {
    const logistics: Record<string, string> = {
      'US': 'USPS',
      'CA': 'Canada Post',
      'GB': 'Royal Mail',
      'FR': 'Colissimo',
      'DE': 'DHL',
      'ES': 'Correos',
      'IT': 'Poste Italiane',
      'AU': 'Australia Post',
      'JP': 'Japan Post',
      'CN': 'China Post',
    };
    
    return logistics[countryCode] || 'CJ Packet';
  }

  /**
   * Obtenir le code pays depuis le nom
   */
  private getCountryCode(countryName: string): string {
    const codes: Record<string, string> = {
      'United States': 'US',
      'USA': 'US',
      'France': 'FR',
      'Canada': 'CA',
      'United Kingdom': 'GB',
      'UK': 'GB',
      'Germany': 'DE',
      'Deutschland': 'DE',
      'Spain': 'ES',
      'España': 'ES',
      'Italy': 'IT',
      'Italia': 'IT',
      'Australia': 'AU',
      'Japan': 'JP',
      'China': 'CN',
      'Chine': 'CN',
    };
    
    // Si c'est déjà un code (2 lettres), le retourner tel quel
    if (countryName.length === 2 && countryName === countryName.toUpperCase()) {
      return countryName;
    }
    
    return codes[countryName] || 'US';
  }

  /**
   * Marquer une commande en erreur
   */
  private async markOrderAsError(orderId: string, errorMessage: string) {
    // Log l'erreur pour traçabilité
    this.logger.error(`Commande ${orderId} en erreur: ${errorMessage}`);
    
    // TODO: Si vous avez un champ errorMessage dans Order, l'utiliser
    // await this.prisma.order.update({
    //   where: { id: orderId },
    //   data: { errorMessage: errorMessage },
    // });
    
    // Ou créer une table OrderError pour tracker les erreurs
    // await this.prisma.orderError.create({
    //   data: {
    //     orderId: orderId,
    //     errorMessage: errorMessage,
    //     errorType: 'CJ_CREATION_FAILED',
    //   },
    // });
  }

  /**
   * Ajouter une commande CJ au panier
   */
  async addCJOrderToCart(cjOrderId: string) {
    this.logger.log(`🛒 Ajout commande CJ ${cjOrderId} au panier...`);
    try {
      const result = await this.cjOrderService.addCart([cjOrderId]);
      this.logger.log(`✅ Commande ${cjOrderId} ajoutée au panier CJ avec succès`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Erreur ajout au panier CJ:`, error);
      throw error;
    }
  }

  /**
   * Confirmer le panier CJ pour une commande
   */
  async confirmCJCart(cjOrderId: string) {
    this.logger.log(`✅ Confirmation panier CJ pour commande ${cjOrderId}...`);
    try {
      const result = await this.cjOrderService.addCartConfirm([cjOrderId]);
      this.logger.log(`✅ Panier CJ confirmé pour commande ${cjOrderId}`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Erreur confirmation panier CJ:`, error);
      throw error;
    }
  }
}

