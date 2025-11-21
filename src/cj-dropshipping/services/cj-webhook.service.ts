import { Injectable, Logger } from '@nestjs/common';
import { DuplicatePreventionService } from '../../common/services/duplicate-prevention.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CJAPIClient } from '../cj-api-client';
import {
    CJOrderParams,
    CJOrderSplitParams,
    CJProductParams,
    CJSourcingCreateParams,
    CJStockParams,
    CJVariantParams,
    CJWebhookPayload,
    WebhookProcessingResult
} from '../interfaces/cj-webhook.interface';

@Injectable()
export class CJWebhookService {
  private readonly logger = new Logger(CJWebhookService.name);

  constructor(
    private prisma: PrismaService,
    private cjApiClient: CJAPIClient,
    private duplicatePreventionService: DuplicatePreventionService
  ) {}

  /**
   * Traiter un webhook CJ selon son type
   */
  async processWebhook(payload: CJWebhookPayload): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    this.logger.log(`🎯 Traitement webhook ${payload.type} [${payload.messageId}]`);

    try {
      // Vérifier que l'intégration est activée
      const config = await this.prisma.cJConfig.findFirst();
      if (!config?.enabled) {
        throw new Error('L\'intégration CJ Dropshipping est désactivée');
      }

      // Enregistrer le webhook reçu
      await this.logWebhookReceived(payload);

      let result: WebhookProcessingResult;

      // Router selon le type de webhook
      switch (payload.type) {
        case 'PRODUCT':
          result = await this.handleProductWebhook(payload.params as CJProductParams, payload.messageId);
          break;
        
        case 'VARIANT':
          result = await this.handleVariantWebhook(payload.params as CJVariantParams, payload.messageId);
          break;

        case 'STOCK':
          result = await this.handleStockWebhook(payload.params as CJStockParams, payload.messageId);
          break;

        case 'ORDER':
          result = await this.handleOrderWebhook(payload.params as CJOrderParams, payload.messageId);
          break;

        case 'ORDERSPLIT':
          result = await this.handleOrderSplitWebhook(payload.params as CJOrderSplitParams, payload.messageId);
          break;

        case 'SOURCINGCREATE':
          result = await this.handleSourcingCreateWebhook(payload.params as CJSourcingCreateParams, payload.messageId);
          break;
        
        default:
          this.logger.warn(`⚠️  Type de webhook non géré: ${payload.type}`);
          result = {
            success: false,
            messageId: payload.messageId,
            type: payload.type,
            processedAt: new Date(),
            error: `Type de webhook non supporté: ${payload.type}`
          };
      }

      // Mesurer le temps de traitement
      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Webhook ${payload.type} traité en ${processingTime}ms [${payload.messageId}]`);

      // Enregistrer le résultat
      await this.logWebhookProcessed(payload.messageId, result, processingTime);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`❌ Erreur traitement webhook ${payload.type} [${payload.messageId}]:`, errorMessage);
      
      const result: WebhookProcessingResult = {
        success: false,
        messageId: payload.messageId,
        type: payload.type,
        processedAt: new Date(),
        error: errorMessage
      };

      await this.logWebhookProcessed(payload.messageId, result, processingTime);
      return result;
    }
  }

  /**
   * Gérer les webhooks de type PRODUCT
   */
  private async handleProductWebhook(params: CJProductParams, messageId: string): Promise<WebhookProcessingResult> {
    this.logger.log(`📦 Traitement produit CJ: ${params.pid}`);
    this.logger.log(`🔄 Champs modifiés: ${params.fields.join(', ')}`);

    try {
      // ✅ PRIORISER productNameEn (anglais) avant productName (chinois)
      // Nettoyer le nom du produit (peut être un tableau JSON stringifié)
      let productName = params.productNameEn || params.productName || `Produit CJ ${params.pid}`;
      try {
        // Si c'est un tableau JSON stringifié, extraire le premier élément
        if (productName.startsWith('[') && productName.endsWith(']')) {
          const parsed = JSON.parse(productName);
          if (Array.isArray(parsed) && parsed.length > 0) {
            productName = parsed[0];
          }
        }
      } catch (e) {
        // Si ce n'est pas du JSON, garder le nom tel quel
      }
      
      // Nettoyer le nom (enlever les caractères spéciaux, HTML, etc.)
      productName = this.cleanProductName(productName);
      
      // Convertir le prix en Float
      const price = typeof params.productSellPrice === 'string' 
        ? parseFloat(params.productSellPrice) || 0
        : (params.productSellPrice || 0);
      
      // Nettoyer la description
      const description = this.cleanProductDescription(params.productDescription || '');
      
      // Utiliser le service anti-doublons pour l'upsert intelligent
      const duplicateCheck = await this.duplicatePreventionService.checkCJProductDuplicate(params.pid);
      
      const upsertResult = await this.duplicatePreventionService.upsertCJProduct({
        cjProductId: params.pid,
        name: productName,
        description: description,
        price: price,
        productSku: params.productSku, // ✅ Utiliser productSku au lieu de sku
        status: params.productStatus,
        categoryId: params.categoryId,
        categoryName: params.categoryName,
        image: params.productImage,
        properties: {
          property1: params.productProperty1,
          property2: params.productProperty2,
          property3: params.productProperty3,
        },
        modifiedFields: params.fields
      }, duplicateCheck);

      // ✅ Créer une notification de mise à jour
      if (upsertResult.productId) {
        await this.createProductUpdateNotification({
          productId: upsertResult.productId,
          cjProductId: params.pid,
          webhookType: 'PRODUCT',
          webhookMessageId: messageId,
          changes: params.fields,
          productName: params.productNameEn || params.productName || `Produit CJ ${params.pid}`
        });
      }

      return {
        success: true,
        messageId,
        type: 'PRODUCT',
        processedAt: new Date(),
        changes: params.fields,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`❌ Erreur traitement produit ${params.pid}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Gérer les webhooks de type VARIANT
   */
  private async handleVariantWebhook(params: CJVariantParams, messageId: string): Promise<WebhookProcessingResult> {
    this.logger.log(`🔧 Traitement variante CJ: ${params.vid}`);
    this.logger.log(`🔄 Champs modifiés: ${params.fields.join(', ')}`);

    try {
      const pid = (params as any).pid;
      
      // 1️⃣ Chercher le produit parent par la variante existante
      let existingProduct = await this.prisma.product.findFirst({
        where: {
          productVariants: {
            some: {
              cjVariantId: params.vid
            }
          }
        },
        include: {
          productVariants: true
        }
      });

      // 2️⃣ Si pas trouvé, chercher par cjProductId (pid)
      if (!existingProduct && pid) {
        existingProduct = await this.prisma.product.findFirst({
          where: {
            cjProductId: pid
          },
          include: {
            productVariants: true
          }
        });
      }

      // 3️⃣ Si pas trouvé, chercher dans CJProductStore
      if (!existingProduct && pid) {
        const cjStoreProduct = await this.prisma.cJProductStore.findFirst({
          where: {
            cjProductId: pid
          }
        });

        if (cjStoreProduct) {
          this.logger.log(`📦 Produit trouvé dans CJProductStore, création dans Product...`);
          
          // Parser les variants depuis le JSON
          let variants = [];
          try {
            variants = typeof cjStoreProduct.variants === 'string' 
              ? JSON.parse(cjStoreProduct.variants) 
              : cjStoreProduct.variants || [];
          } catch (e) {
            this.logger.warn(`⚠️ Erreur parsing variants:`, e);
          }

          // Trouver la catégorie mappée
          let categoryId = null;
          if (cjStoreProduct.category) {
            const categoryMapping = await this.prisma.categoryMapping.findFirst({
              where: {
                externalCategory: cjStoreProduct.category
              }
            });
            if (categoryMapping) {
              categoryId = categoryMapping.internalCategory;
            }
          }

          // Trouver le fournisseur
          let supplierId = null;
          const supplier = await this.prisma.supplier.findFirst({
            where: {
              name: cjStoreProduct.supplierName || 'CJ Dropshipping'
            }
          });
          if (supplier) {
            supplierId = supplier.id;
          }

          // Créer le produit dans Product (draft)
          existingProduct = await this.prisma.product.create({
            data: {
              name: cjStoreProduct.name,
              description: cjStoreProduct.description || '',
              price: cjStoreProduct.price || 0,
              originalPrice: cjStoreProduct.price || 0,
              image: cjStoreProduct.image || '',
              categoryId: categoryId,
              supplierId: supplierId,
              externalCategory: cjStoreProduct.category,
              source: 'cj-dropshipping',
              status: 'draft',
              stock: 0,
              cjProductId: pid,
              productSku: cjStoreProduct.productSku,
              variants: cjStoreProduct.variants,
              cjMapping: {
                create: {
                  cjProductId: pid,
                  cjSku: cjStoreProduct.productSku || pid
                }
              },
              // Créer les variants comme ProductVariant
              productVariants: {
                create: variants.map((v: any) => {
                  // ✅ Convertir status en String si c'est un nombre
                  const variantStatus = v.variantStatus !== null && v.variantStatus !== undefined
                    ? (typeof v.variantStatus === 'number' ? String(v.variantStatus) : v.variantStatus)
                    : null;
                  
                  return {
                    name: v.variantName || v.variantNameEn || '',
                    sku: v.variantSku || '',
                    price: parseFloat(v.sellPrice || v.variantSellPrice || '0'),
                    weight: v.variantWeight || 0,
                    dimensions: v.variantLength || v.variantWidth || v.variantHeight ? 
                      JSON.stringify({
                        length: v.variantLength,
                        width: v.variantWidth,
                        height: v.variantHeight
                      }) : null,
                    image: v.variantImage || null,
                    stock: parseInt(v.stock || v.variantStock || '0', 10), // ✅ AJOUT DU STOCK
                    status: variantStatus || ((parseInt(v.stock || '0', 10) > 0) ? 'available' : 'out_of_stock'),
                    properties: JSON.stringify({
                      key: v.variantKey || '',
                      value1: v.variantValue1 || '',
                      value2: v.variantValue2 || '',
                      value3: v.variantValue3 || '',
                    }),
                    cjVariantId: v.vid || v.variantId || ''
                  };
                }).filter((v: any) => v.cjVariantId) // Filtrer les variants sans cjVariantId
              }
            },
            include: {
              productVariants: true
            }
          });

          this.logger.log(`✅ Produit créé depuis CJProductStore: ${existingProduct.id} avec ${existingProduct.productVariants.length} variants`);
        }
      }

      // 4️⃣ Si toujours pas trouvé, créer un produit minimal avec les informations de la variante
      if (!existingProduct && pid) {
        this.logger.log(`📦 Produit ${pid} introuvable, création d'un produit minimal depuis la variante...`);
        
        try {
          // Extraire le nom du produit depuis variantName (enlever les infos de variante)
          let productName = params.variantName || `Produit CJ ${pid}`;
          // Enlever les suffixes de variante courants (Style, AU, etc.)
          productName = productName
            .replace(/\s*(2 Style|AU|US|EU|UK|Style)\s*$/i, '')
            .trim();
          
          // Trouver le fournisseur CJ Dropshipping
          let supplierId = null;
          const supplier = await this.prisma.supplier.findFirst({
            where: {
              name: {
                contains: 'CJ'
              }
            }
          });
          if (supplier) {
            supplierId = supplier.id;
          }

          // Créer un produit minimal en draft
          existingProduct = await this.prisma.product.create({
            data: {
              name: this.cleanProductName(productName),
              description: `Produit créé automatiquement depuis webhook VARIANT (PID: ${pid})`,
              price: params.variantSellPrice 
                ? (typeof params.variantSellPrice === 'string' ? parseFloat(params.variantSellPrice) : params.variantSellPrice)
                : 0,
              originalPrice: params.variantSellPrice 
                ? (typeof params.variantSellPrice === 'string' ? parseFloat(params.variantSellPrice) : params.variantSellPrice)
                : 0,
              image: params.variantImage || '',
              categoryId: null, // Pas de catégorie, à mapper manuellement
              supplierId: supplierId,
              externalCategory: null,
              source: 'cj-dropshipping',
              status: 'draft', // En draft pour être complété
              stock: 0,
              cjProductId: pid,
              productSku: params.variantSku || '',
              cjMapping: {
                create: {
                  cjProductId: pid,
                  cjSku: params.variantSku || pid
                }
              },
              productVariants: {
                create: [] // La variante sera créée après
              }
            },
            include: {
              productVariants: true
            }
          });

          this.logger.log(`✅ Produit minimal créé: ${existingProduct.id} (PID: ${pid}) - Statut: draft`);
          this.logger.warn(`⚠️  Produit créé en mode draft. Veuillez le compléter (catégorie, description, etc.) depuis la page de gestion des produits.`);
        } catch (createError: any) {
          this.logger.error(`❌ Erreur création produit minimal pour PID ${pid}:`, createError.message);
          // Si la création échoue, retourner une erreur
          return {
            success: false,
            messageId,
            type: 'VARIANT',
            processedAt: new Date(),
            error: `Produit parent introuvable pour variante ${params.vid}. Impossible de créer le produit automatiquement. Importez-le depuis la page de recherche CJ Dropshipping avec le PID: ${pid}. Erreur: ${createError.message}`
          };
        }
      }

      // 5️⃣ Si toujours pas trouvé après toutes les tentatives, retourner une erreur
      if (!existingProduct) {
        this.logger.error(`❌ Produit parent introuvable pour variante ${params.vid} (pid: ${pid})`);
        return {
          success: false,
          messageId,
          type: 'VARIANT',
          processedAt: new Date(),
          error: `Produit parent introuvable pour variante ${params.vid}. Le produit n'a pas été importé. Importez-le depuis la page de recherche CJ Dropshipping avec le PID: ${pid}`
        };
      }

      // Mettre à jour ou créer la variante
      // ✅ Convertir price et weight en Float si ce sont des strings
      const variantPrice = params.variantSellPrice 
        ? (typeof params.variantSellPrice === 'string' ? parseFloat(params.variantSellPrice) : params.variantSellPrice)
        : null;
      const variantWeight = params.variantWeight 
        ? (typeof params.variantWeight === 'string' ? parseFloat(params.variantWeight) : params.variantWeight)
        : null;
      
      // Vérifier que les valeurs sont valides (pas NaN)
      const finalPrice = variantPrice !== null && !isNaN(variantPrice) ? variantPrice : null;
      const finalWeight = variantWeight !== null && !isNaN(variantWeight) ? variantWeight : null;
      
      // ✅ Convertir status en String si c'est un nombre
      const variantStatus = params.variantStatus !== null && params.variantStatus !== undefined
        ? (typeof params.variantStatus === 'number' ? String(params.variantStatus) : params.variantStatus)
        : null;
      
      const variantData = {
        name: params.variantName,
        sku: params.variantSku,
        price: finalPrice,
        weight: finalWeight,
        dimensions: params.variantLength || params.variantWidth || params.variantHeight ? 
          JSON.stringify({
            length: params.variantLength,
            width: params.variantWidth,
            height: params.variantHeight
          }) : null,
        image: params.variantImage,
        status: variantStatus,
        properties: JSON.stringify({
          key: params.variantKey,
          value1: params.variantValue1,
          value2: params.variantValue2,
          value3: params.variantValue3,
        }),
        cjVariantId: params.vid,
      };

      // Upsert de la variante
      const variant = await this.prisma.productVariant.upsert({
        where: {
          cjVariantId: params.vid
        },
        update: variantData,
        create: {
          ...variantData,
          product: {
            connect: { id: existingProduct.id }
          }
        }
      });

      this.logger.log(`✅ Variante ${params.vid} mise à jour: ${variant.id}`);

      // ✅ Créer une notification de mise à jour
      const productPid = (params as any).pid || existingProduct.cjProductId;
      if (productPid && existingProduct) {
        await this.createProductUpdateNotification({
          productId: existingProduct.id,
          cjProductId: productPid,
          cjVariantId: params.vid,
          webhookType: 'VARIANT',
          webhookMessageId: messageId,
          changes: params.fields,
          productName: existingProduct.name
        });
      }

      return {
        success: true,
        messageId,
        type: 'VARIANT',
        processedAt: new Date(),
        changes: params.fields,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`❌ Erreur traitement variante ${params.vid}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Gérer les webhooks de type STOCK
   * 
   * Structure attendue:
   * params = {
   *   "PID": [
   *     { vid: "VID1", storageNum: 100, ... },
   *     { vid: "VID2", storageNum: 200, ... }
   *   ]
   * }
   */
  private async handleStockWebhook(params: CJStockParams | any, messageId: string): Promise<WebhookProcessingResult> {
    this.logger.log(`📦 Traitement stock CJ: ${Object.keys(params).length} produit(s)`);

    try {
      let updatedVariants = 0;
      let notFoundVariants = 0;
      const variantStockMap = new Map<string, number>(); // Map<vid, totalStock>

      // Parcourir tous les produits (clés = PID)
      for (const [pid, stockInfos] of Object.entries(params)) {
        if (!Array.isArray(stockInfos)) {
          this.logger.warn(`⚠️ Format inattendu pour PID ${pid}, ignoré`);
          continue;
        }

        this.logger.log(`📦 Produit ${pid}: ${stockInfos.length} variante(s) avec stock`);

        // Grouper les stocks par VID (un variant peut avoir plusieurs entrepôts)
        for (const stockInfo of stockInfos) {
          const vid = stockInfo.vid || stockInfo.variantId;
          const storageNum = stockInfo.storageNum || 0;

          if (!vid) {
            this.logger.warn(`⚠️ Stock sans VID pour PID ${pid}, ignoré`);
            continue;
          }

          // Additionner le stock de tous les entrepôts pour ce variant
          const currentStock = variantStockMap.get(vid) || 0;
          variantStockMap.set(vid, currentStock + storageNum);
        }
      }

      this.logger.log(`📦 ${variantStockMap.size} variant(s) unique(s) à mettre à jour`);

      // Mettre à jour chaque variant
      for (const [vid, totalStock] of variantStockMap.entries()) {
        try {
          const result = await this.prisma.productVariant.updateMany({
            where: { cjVariantId: vid },
            data: { 
              stock: totalStock,
              status: totalStock > 0 ? 'available' : 'out_of_stock',
              lastSyncAt: new Date()
            }
          });

          if (result.count > 0) {
            updatedVariants++;
            this.logger.log(`✅ Variant ${vid} mis à jour: ${totalStock} unités`);
          } else {
            notFoundVariants++;
            this.logger.warn(`⚠️ Variant ${vid} non trouvé en base (cjVariantId)`);
          }
        } catch (error: any) {
          notFoundVariants++;
          this.logger.warn(`⚠️ Erreur mise à jour variant ${vid}: ${error.message}`);
        }
      }

      const changes = [
        `${updatedVariants} variant(s) mis à jour`,
        ...(notFoundVariants > 0 ? [`${notFoundVariants} variant(s) non trouvé(s) en base`] : [])
      ];

      return {
        success: true,
        messageId,
        type: 'STOCK',
        processedAt: new Date(),
        changes,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`❌ Erreur traitement stock:`, errorMessage);
      throw error;
    }
  }

  /**
   * Gérer les webhooks de type ORDER
   */
  private async handleOrderWebhook(params: CJOrderParams, messageId: string): Promise<WebhookProcessingResult> {
    this.logger.log(`📋 Traitement commande CJ: ${params.orderNumber}`);

    try {
      // Trouver la commande correspondante via le mapping
      const mapping = await this.prisma.cJOrderMapping.findFirst({
        where: { cjOrderId: params.cjOrderId.toString() }
      });

      if (!mapping) {
        this.logger.warn(`⚠️ Commande CJ ${params.cjOrderId} non trouvée en mapping`);
        return {
          success: false,
          messageId,
          type: 'ORDER',
          processedAt: new Date(),
          error: `Commande ${params.cjOrderId} non trouvée`
        };
      }

      // Mapper le statut CJ vers KAMRI
      const kamriStatus = this.mapCJStatusToKamri(params.orderStatus);

      // Mettre à jour la commande
      await this.prisma.order.update({
        where: { id: mapping.orderId },
        data: {
          status: kamriStatus,
          ...(params.trackNumber && { trackingNumber: params.trackNumber })
        }
      });

      // Mettre à jour le mapping
      await this.prisma.cJOrderMapping.update({
        where: { id: mapping.id },
        data: {
          status: params.orderStatus,
          trackNumber: params.trackNumber
        }
      });

      this.logger.log(`✅ Commande ${params.orderNumber} mise à jour: ${kamriStatus}`);

      return {
        success: true,
        messageId,
        type: 'ORDER',
        processedAt: new Date(),
        changes: [`Statut: ${kamriStatus}`, ...(params.trackNumber ? [`Tracking: ${params.trackNumber}`] : [])],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`❌ Erreur traitement commande ${params.orderNumber}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Gérer les webhooks de division de commande
   */
  private async handleOrderSplitWebhook(params: CJOrderSplitParams, messageId: string): Promise<WebhookProcessingResult> {
    this.logger.log(`🔀 Traitement division commande: ${params.originalOrderId}`);

    try {
      // Trouver la commande originale
      const originalMapping = await this.prisma.cJOrderMapping.findFirst({
        where: { cjOrderId: params.originalOrderId }
      });

      if (!originalMapping) {
        this.logger.warn(`⚠️ Commande originale ${params.originalOrderId} non trouvée`);
        return {
          success: false,
          messageId,
          type: 'ORDERSPLIT',
          processedAt: new Date(),
          error: `Commande originale ${params.originalOrderId} non trouvée`
        };
      }

      // Créer des mappings pour les commandes divisées
      const splitOrderCodes: string[] = [];
      for (const splitOrder of params.splitOrderList) {
        await this.prisma.cJOrderMapping.create({
          data: {
            orderId: originalMapping.orderId,
            cjOrderId: splitOrder.orderCode,
            cjOrderNumber: splitOrder.orderCode, // Ajouter le champ requis
            status: splitOrder.orderStatus.toString()
          }
        });
        splitOrderCodes.push(splitOrder.orderCode);
      }

      this.logger.log(`✅ Division commande créée: ${splitOrderCodes.length} sous-commandes`);

      return {
        success: true,
        messageId,
        type: 'ORDERSPLIT',
        processedAt: new Date(),
        changes: [`${splitOrderCodes.length} sous-commandes créées`],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`❌ Erreur division commande:`, errorMessage);
      throw error;
    }
  }

  /**
   * Gérer les webhooks de création de sourcing
   */
  private async handleSourcingCreateWebhook(params: CJSourcingCreateParams, messageId: string): Promise<WebhookProcessingResult> {
    this.logger.log(`🎯 Traitement sourcing CJ: ${params.cjSourcingId}`);

    try {
      // Trouver le produit correspondant
      const product = await this.prisma.product.findFirst({
        where: { cjProductId: params.cjProductId }
      });

      if (!product) {
        this.logger.warn(`⚠️ Produit ${params.cjProductId} non trouvé pour sourcing`);
        return {
          success: false,
          messageId,
          type: 'SOURCINGCREATE',
          processedAt: new Date(),
          error: `Produit ${params.cjProductId} non trouvé`
        };
      }

      // Mettre à jour le produit avec les infos de sourcing
      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          description: product.description ? 
            `${product.description}\n\nCJ Sourcing: ${params.cjSourcingId} (${params.status})` :
            `CJ Sourcing: ${params.cjSourcingId} (${params.status})`,
          lastImportAt: new Date()
        }
      });

      this.logger.log(`✅ Sourcing ${params.cjSourcingId} appliqué au produit ${product.name}`);

      return {
        success: true,
        messageId,
        type: 'SOURCINGCREATE',
        processedAt: new Date(),
        changes: [`Sourcing ${params.status}: ${params.cjSourcingId}`],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`❌ Erreur sourcing ${params.cjSourcingId}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Mapper le statut CJ vers KAMRI
   */
  private mapCJStatusToKamri(cjStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'CREATED': 'PENDING',
      'PAID': 'CONFIRMED',
      'SHIPPED': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'CANCELLED': 'CANCELLED',
    };
    return statusMap[cjStatus] || 'PENDING';
  }

  /**
   * Enregistrer la réception d'un webhook
   */
  private async logWebhookReceived(payload: CJWebhookPayload): Promise<void> {
    try {
      await this.prisma.webhookLog.create({
        data: {
          messageId: payload.messageId,
          type: payload.type,
          payload: JSON.stringify(payload),
          status: 'RECEIVED',
          receivedAt: new Date(),
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error('❌ Erreur enregistrement webhook reçu:', errorMessage);
    }
  }

  /**
   * Enregistrer le résultat du traitement
   */
  private async logWebhookProcessed(
    messageId: string, 
    result: WebhookProcessingResult, 
    processingTimeMs: number
  ): Promise<void> {
    try {
      await this.prisma.webhookLog.updateMany({
        where: { messageId },
        data: {
          status: result.success ? 'PROCESSED' : 'ERROR',
          processedAt: result.processedAt,
          processingTimeMs,
          error: result.error,
          result: JSON.stringify(result)
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error('❌ Erreur enregistrement résultat webhook:', errorMessage);
    }
  }

  /**
   * Gérer un webhook (pour compatibilité avec CJMainService)
   */
  async handleWebhook(type: string, payload: any): Promise<any> {
    const webhookPayload: CJWebhookPayload = {
      type: type as any,
      messageId: payload.messageId || `webhook_${Date.now()}`,
      params: payload
    };
    
    return this.processWebhook(webhookPayload);
  }

  /**
   * Configurer les webhooks CJ Dropshipping
   * Doc : POST https://developers.cjdropshipping.com/api2.0/v1/webhook/set
   * Format conforme à la documentation officielle CJ
   */
  async configureWebhooks(
    enable: boolean,
    callbackUrl: string,
    types: ('product' | 'stock' | 'order' | 'logistics')[] = ['product', 'stock', 'order', 'logistics']
  ): Promise<{
    code: number;
    result: boolean;
    message: string;
    data: any;
    requestId: string;
  }> {
    this.logger.log('🔧 === CONFIGURATION WEBHOOKS CJ ===');
    this.logger.log(`   Action: ${enable ? 'ENABLE' : 'CANCEL'}`);
    this.logger.log(`   URL: ${callbackUrl}`);
    this.logger.log(`   Types: ${types.join(', ')}`);

    // Validation de l'URL : HTTPS obligatoire (même en local, CJ Dropshipping exige HTTPS)
    // Pour tester en local, utilisez un tunnel HTTPS (ngrok, Cloudflare Tunnel, etc.)
    if (enable) {
      if (!callbackUrl.startsWith('https://')) {
        // ✅ Retourner le format CJ au lieu de lancer une exception
        return {
          code: 200,
          result: false,
          message: 'Callback URL must use HTTPS protocol. CJ Dropshipping requires HTTPS even for local testing. Use ngrok or similar tunnel: https://ngrok.com/',
          data: {
            error: 'HTTPS required by CJ Dropshipping API',
            suggestion: 'For local testing, use ngrok: ngrok http 3001'
          },
          requestId: 'config-validation-' + Date.now()
        };
      }
    }

    // Construire la configuration selon la doc CJ
    const config: any = {};
    
    types.forEach(type => {
      config[type] = {
        type: enable ? 'ENABLE' : 'CANCEL',
        callbackUrls: [callbackUrl]
      };
    });

    this.logger.log('📝 Configuration à envoyer:', JSON.stringify(config, null, 2));

    try {
      // Récupérer la configuration CJ
      const cjConfig = await this.prisma.cJConfig.findFirst();
      if (!cjConfig || !cjConfig.enabled) {
        throw new Error('Configuration CJ Dropshipping non trouvée ou désactivée');
      }

      // Initialiser le client CJ avec la config
      this.cjApiClient.setConfig({
        email: cjConfig.email,
        apiKey: cjConfig.apiKey,
        tier: cjConfig.tier as any,
        platformToken: cjConfig.platformToken || undefined
      });

      // S'assurer que le client est authentifié
      await this.cjApiClient.login();
      
      // Appel API CJ pour configurer les webhooks
      this.logger.log('📡 Envoi de la configuration à CJ Dropshipping...');
      const response = await this.cjApiClient.makeRequest('POST', '/webhook/set', config);

      this.logger.log('📥 Réponse CJ:', JSON.stringify(response, null, 2));

      if (response.code === 200 && response.result) {
        this.logger.log('✅ Webhooks configurés avec succès sur CJ');
        
        // Enregistrer la configuration dans la base de données
        await this.saveWebhookConfig(enable, callbackUrl, types);
        
        return {
          code: 200,
          result: true,
          message: 'Webhooks configured successfully',
          data: {
            enabled: enable,
            callbackUrl,
            types,
            configuredAt: new Date(),
            cjResponse: response.data
          },
          requestId: response.requestId || `config-${Date.now()}`
        };
      } else {
        throw new Error(response.message || 'Failed to configure webhooks on CJ platform');
      }
    } catch (error: any) {
      this.logger.error('❌ Erreur configuration webhooks:', error);
      // ✅ Retourner le format CJ au lieu de lancer une exception
      return {
        code: 200,
        result: false,
        message: error.message || 'Webhook configuration failed',
        data: {
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        requestId: 'config-error-' + Date.now()
      };
    }
  }

  /**
   * Sauvegarder la configuration des webhooks dans la base de données
   */
  private async saveWebhookConfig(
    enabled: boolean,
    callbackUrl: string,
    types: string[]
  ): Promise<void> {
    this.logger.log('💾 Sauvegarde de la configuration dans la base de données...');
    
    try {
      // Récupérer la config CJ existante
      const config = await this.prisma.cJConfig.findFirst();
      
      if (config) {
        await this.prisma.cJConfig.update({
          where: { id: config.id },
          data: {
            webhookEnabled: enabled,
            webhookUrl: callbackUrl,
            webhookTypes: types.join(','),
            updatedAt: new Date()
          }
        });
        this.logger.log('✅ Configuration sauvegardée dans CJConfig');
      } else {
        this.logger.warn('⚠️ Aucune configuration CJ trouvée pour sauvegarder les webhooks');
      }
    } catch (error: any) {
      this.logger.error('❌ Erreur sauvegarde config webhooks:', error);
      // Ne pas bloquer si la sauvegarde échoue
    }
  }

  /**
   * Obtenir le statut de configuration des webhooks
   */
  async getWebhookStatus(): Promise<{
    code: number;
    result: boolean;
    message: string;
    data: any;
    requestId: string;
  }> {
    this.logger.log('🔍 Récupération du statut des webhooks...');
    
    try {
      const config = await this.prisma.cJConfig.findFirst();
      
      if (!config) {
        return {
          code: 200,
          result: true,
          message: 'No webhook configuration found',
          data: {
            enabled: false,
            configured: false,
            message: 'No CJ configuration found. Please configure CJ Dropshipping first.'
          },
          requestId: 'status-' + Date.now()
        };
      }

      const status = {
        enabled: config.webhookEnabled || false,
        configured: !!config.webhookUrl,
        callbackUrl: config.webhookUrl || null,
        types: config.webhookTypes ? config.webhookTypes.split(',') : [],
        lastUpdated: config.updatedAt
      };

      this.logger.log('✅ Statut webhooks:', JSON.stringify(status, null, 2));

      return {
        code: 200,
        result: true,
        message: 'Webhook status retrieved',
        data: status,
        requestId: 'status-' + Date.now()
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur récupération statut webhooks:', error);
      throw error;
    }
  }

  /**
   * Obtenir les logs des webhooks
   * Format conforme à la documentation CJ
   */
  async getWebhookLogs(filters?: {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    code: number;
    result: boolean;
    message: string;
    data: any;
    requestId: string;
  }> {
    this.logger.log('📋 Récupération des logs webhooks...');
    
    try {
      const where: any = {};
      
      if (filters?.type) where.type = filters.type;
      if (filters?.status) where.status = filters.status;

      const logs = await this.prisma.webhookLog.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: filters?.limit || 100,
        skip: filters?.offset || 0
      });

      const total = await this.prisma.webhookLog.count({ where });

      this.logger.log(`✅ ${logs.length} logs récupérés (total: ${total})`);

      return {
        code: 200,
        result: true,
        message: 'Webhook logs retrieved',
        data: {
          logs,
          total,
          limit: filters?.limit || 100,
          offset: filters?.offset || 0
        },
        requestId: 'logs-' + Date.now()
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur récupération logs webhooks:', error);
      throw error;
    }
  }

  /**
   * Créer une notification de mise à jour de produit
   */
  private async createProductUpdateNotification(data: {
    productId?: string;
    cjProductId: string;
    cjVariantId?: string;
    webhookType: string;
    webhookMessageId: string;
    changes: string[];
    productName?: string;
  }): Promise<void> {
    try {
      await this.prisma.productUpdateNotification.create({
        data: {
          productId: data.productId || null,
          cjProductId: data.cjProductId,
          cjVariantId: data.cjVariantId || null,
          webhookType: data.webhookType,
          webhookMessageId: data.webhookMessageId,
          changes: JSON.stringify(data.changes),
          productName: data.productName || `Produit CJ ${data.cjProductId}`,
          isRead: false
        }
      });
      this.logger.log(`🔔 Notification créée pour produit ${data.cjProductId} (${data.webhookType})`);
    } catch (error) {
      // Ne pas bloquer le traitement du webhook si la notification échoue
      this.logger.warn(`⚠️ Erreur lors de la création de la notification:`, error);
    }
  }

  /**
   * Nettoyer le nom d'un produit
   */
  private cleanProductName(name: string): string {
    if (!name) return '';
    
    // Si c'est un tableau JSON stringifié, extraire le premier élément
    try {
      if (name.startsWith('[') && name.endsWith(']')) {
        const parsed = JSON.parse(name);
        if (Array.isArray(parsed) && parsed.length > 0) {
          name = parsed[0];
        }
      }
    } catch (e) {
      // Si ce n'est pas du JSON, garder le nom tel quel
    }
    
    return name
      .trim()
      .replace(/\s+/g, ' ') // Espaces multiples
      .replace(/[^\w\s-]/gi, '') // Caractères spéciaux (sauf tirets et lettres)
      .substring(0, 200); // Limite de longueur
  }

  /**
   * Nettoyer la description d'un produit
   */
  private cleanProductDescription(description: string): string {
    if (!description) return '';
    
    // Supprimer les balises HTML
    let cleaned = description
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    
    // ✅ NETTOYAGE AGRESSIF : Supprimer TOUT le CSS
    let cssRemoved = cleaned;
    let previousLength = 0;
    while (cssRemoved.length !== previousLength) {
      previousLength = cssRemoved.length;
      cssRemoved = cssRemoved
        .replace(/#[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
        .replace(/\.[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
        .replace(/@media[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
        .replace(/[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
        .replace(/\{[^{}]*\}/g, '')
        .trim();
    }
    cleaned = cssRemoved;
    
    // ✅ Supprimer markdown et caractères spéciaux
    cleaned = cleaned
      .replace(/###\s*[^\n]+/g, '')
      .replace(/##\s*[^\n]+/g, '')
      .replace(/#\s*[^\n]+/g, '')
      .replace(/\*\*[^\*]+\*\*/g, '')
      .replace(/\*[^\*]+\*/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/⚠️\s*NOTES\s*IMPORTANTES[^\n]*/gi, '')
      .replace(/\*\*\s*##\s*⚠️[^\n]*/gi, '')
      .replace(/🎨\s*Couleurs\s*disponibles[^\n]*/gi, '')
      .replace(/🎯\s*Tailles\s*disponibles[^\n]*/gi, '')
      .replace(/[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/[a-zA-Z0-9_-]+:\s*[^;]+;/g, '')
      .trim();
    
    // ✅ Supprimer la section "Technical Details" complète
    const technicalDetailsPattern = /(?:Technical\s+Details?|Technical\s+Specifications?|Specifications?)[\s\S]*$/i;
    cleaned = cleaned.replace(technicalDetailsPattern, '');
    
    // ✅ Supprimer les spécifications techniques individuelles
    const specPatterns = [
      /Bike\s+Type:\s*[^\n]+/gi, /Age\s+Range[^\n]+/gi, /Number\s+of\s+Speeds?:\s*[^\n]+/gi,
      /Wheel\s+Size:\s*[^\n]+/gi, /Frame\s+Material:\s*[^\n]+/gi, /Suspension\s+Type:\s*[^\n]+/gi,
      /Accessories?:\s*[^\n]+/gi, /Included\s+Components?:\s*[^\n]+/gi, /Brake\s+Style:\s*[^\n]+/gi,
      /Voltage:\s*[^\n]+/gi, /Wattage:\s*[^\n]+/gi, /Material:\s*[^\n]+/gi,
      /Item\s+Package\s+Dimensions?[^\n]+/gi, /Package\s+Weight:\s*[^\n]+/gi,
      /Item\s+Dimensions?[^\n]+/gi, /Part\s+Number:\s*[^\n]+/gi,
    ];
    specPatterns.forEach(pattern => cleaned = cleaned.replace(pattern, ''));
    
    // ✅ Supprimer infos techniques fausses
    cleaned = cleaned
      .replace(/Weight:\s*[^\n.,]+[kg|g|lb]?[^\n.]*/gi, '')
      .replace(/Poids:\s*[^\n.,]+[kg|g|lb]?[^\n.]*/gi, '')
      .replace(/Dimensions?:\s*[^\n.,]+[cm|mm|m|inch]?[^\n.]*/gi, '')
      .replace(/Size:\s*[^\n.,]*×[^\n.,]*/gi, '')
      .replace(/Package\s+Weight:\s*[^\n.,]+/gi, '')
      .replace(/Shipping\s+Weight:\s*[^\n.,]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned;
  }
}
