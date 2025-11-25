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
    this.logger.log(`📦 Traitement produit CJ via webhook: ${params.pid}`);
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
      
      // ✅ NOUVEAU COMPORTEMENT : Stocker le webhook dans CJWebhookLog avec action: 'pending'
      // L'utilisateur pourra voir et décider d'importer ou non depuis la page webhooks
      
      // Vérifier si le produit existe déjà dans CJProductStore
      const existingStoreProduct = await this.prisma.cJProductStore.findFirst({
        where: { cjProductId: params.pid }
      });

      if (existingStoreProduct) {
        // ✅ Produit trouvé dans le magasin - Mettre à jour les informations
        const storeProductData = {
          cjProductId: params.pid,
          name: productName,
          description: description,
          price: price,
          originalPrice: price,
          image: params.productImage || '',
          category: params.categoryName || '',
          status: existingStoreProduct.status, // Conserver le statut existant
          productSku: params.productSku || '',
          // Champs supplémentaires si disponibles
          productProperty1: params.productProperty1 || '',
          productProperty2: params.productProperty2 || '',
          productProperty3: params.productProperty3 || '',
        };

        await this.duplicatePreventionService.upsertCJStoreProduct(storeProductData);
        this.logger.log(`✅ Produit mis à jour dans le magasin CJ: ${params.pid}`);

        return {
          success: true,
          messageId,
          type: 'PRODUCT',
          processedAt: new Date(),
          changes: params.fields,
          message: `Produit mis à jour dans le magasin CJ`
        };
      }

      // ✅ Produit non trouvé - Stocker dans CJWebhookLog avec action: 'pending'
      // L'utilisateur pourra voir ce produit sur la page webhooks et décider de l'importer
      await this.prisma.cJWebhookLog.upsert({
        where: { messageId },
        update: {
          payload: JSON.stringify({ type: 'PRODUCT', params }),
          action: 'pending', // Marquer comme en attente
        },
        create: {
          type: 'PRODUCT',
          messageId,
          payload: JSON.stringify({ type: 'PRODUCT', params }),
          processed: false,
          action: 'pending', // En attente d'import par l'utilisateur
        }
      });

      this.logger.log(`📋 Produit ${params.pid} stocké en attente dans CJWebhookLog. Visible sur la page webhooks pour import manuel.`);

      return {
        success: true,
        messageId,
        type: 'PRODUCT',
        processedAt: new Date(),
        changes: params.fields,
        message: `Produit en attente d'import. Visible sur la page webhooks.`
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

      // 3️⃣ Si pas trouvé dans Product, chercher/mettre à jour dans CJProductStore
      // ✅ NOUVEAU COMPORTEMENT : Ne pas créer automatiquement dans Product
      // L'utilisateur décidera quels produits importer depuis le magasin CJ
      if (!existingProduct && pid) {
        const cjStoreProduct = await this.prisma.cJProductStore.findFirst({
          where: {
            cjProductId: pid
          }
        });

        if (cjStoreProduct) {
          // ✅ Mettre à jour le produit dans CJProductStore avec les nouvelles infos de variante
          this.logger.log(`📦 Produit trouvé dans CJProductStore, mise à jour des variants...`);
          
          // Parser les variants existants
          let variants = [];
          try {
            variants = typeof cjStoreProduct.variants === 'string' 
              ? JSON.parse(cjStoreProduct.variants) 
              : cjStoreProduct.variants || [];
          } catch (e) {
            this.logger.warn(`⚠️ Erreur parsing variants:`, e);
          }

          // ✅ Mettre à jour ou ajouter la variante dans le JSON
          const variantIndex = variants.findIndex((v: any) => 
            (v.vid || v.variantId) === params.vid
          );

          const updatedVariant = {
            vid: params.vid,
            variantId: params.vid,
            variantName: params.variantName,
            variantNameEn: params.variantName,
            variantSku: params.variantSku,
            variantSellPrice: params.variantSellPrice,
            variantImage: params.variantImage,
            variantStock: params.variantStock || 0,
            ...params // Inclure tous les autres champs
          };

          if (variantIndex >= 0) {
            variants[variantIndex] = { ...variants[variantIndex], ...updatedVariant };
          } else {
            variants.push(updatedVariant);
          }

          // Mettre à jour CJProductStore
          await this.prisma.cJProductStore.update({
            where: { id: cjStoreProduct.id },
            data: {
              variants: JSON.stringify(variants),
              updatedAt: new Date()
            }
          });

          this.logger.log(`✅ Variante mise à jour dans CJProductStore pour produit ${pid}`);
          this.logger.log(`📋 Action requise: L'utilisateur peut maintenant importer ce produit depuis la page "Magasin CJ"`);
          
          return {
            success: true,
            messageId,
            type: 'VARIANT',
            processedAt: new Date(),
            message: `Variante mise à jour dans le magasin CJ. Le produit peut être importé depuis la page "Magasin CJ".`
          };
        } else {
          // ✅ NOUVEAU COMPORTEMENT : Stocker dans CJWebhookLog avec action: 'pending'
          // L'utilisateur pourra voir ce produit sur la page webhooks et décider de l'importer
          await this.prisma.cJWebhookLog.upsert({
            where: { messageId },
            update: {
              payload: JSON.stringify({ type: 'VARIANT', params }),
              action: 'pending', // Marquer comme en attente
            },
            create: {
              type: 'VARIANT',
              messageId,
              payload: JSON.stringify({ type: 'VARIANT', params }),
              processed: false,
              action: 'pending', // En attente d'import par l'utilisateur
            }
          });

          this.logger.log(`📋 Produit ${pid} (variante ${params.vid}) stocké en attente dans CJWebhookLog. Visible sur la page webhooks pour import manuel.`);
          
          return {
            success: true,
            messageId,
            type: 'VARIANT',
            processedAt: new Date(),
            message: `Produit en attente d'import. Visible sur la page webhooks.`
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
   * Importer un produit depuis CJProductStore vers Product (manuellement)
   * @param cjProductStoreId ID du produit dans CJProductStore
   * @param categoryId ID de la catégorie (optionnel, sera mappé automatiquement si non fourni)
   * @returns Le produit importé
   */
  async importProductFromStore(cjProductStoreId: string, categoryId?: string): Promise<{
    success: boolean;
    message: string;
    product?: any;
    error?: string;
  }> {
    this.logger.log(`📦 Import manuel du produit depuis CJProductStore: ${cjProductStoreId}`);
    
    try {
      // Récupérer le produit depuis CJProductStore
      const cjProduct = await this.prisma.cJProductStore.findUnique({
        where: { id: cjProductStoreId }
      });

      if (!cjProduct) {
        return {
          success: false,
          message: 'Produit non trouvé dans le magasin CJ',
          error: 'PRODUCT_NOT_FOUND'
        };
      }

      // Vérifier si le produit n'est pas déjà importé
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          OR: [
            { cjProductId: cjProduct.cjProductId },
            {
              name: cjProduct.name,
              source: 'cj-dropshipping'
            }
          ]
        }
      });

      if (existingProduct) {
        return {
          success: false,
          message: 'Ce produit a déjà été importé',
          error: 'PRODUCT_ALREADY_IMPORTED',
          product: existingProduct
        };
      }

      // Récupérer le fournisseur CJ Dropshipping
      const cjSupplier = await this.prisma.supplier.findFirst({
        where: { name: 'CJ Dropshipping' }
      });

      if (!cjSupplier) {
        return {
          success: false,
          message: 'Fournisseur CJ Dropshipping non trouvé',
          error: 'SUPPLIER_NOT_FOUND'
        };
      }

      // Mapper la catégorie si nécessaire
      let finalCategoryId = categoryId;
      if (!finalCategoryId && cjProduct.category) {
        const categoryMapping = await this.prisma.categoryMapping.findFirst({
          where: {
            supplierId: cjSupplier.id,
            externalCategory: cjProduct.category
          }
        });
        if (categoryMapping) {
          // internalCategory est le nom de la catégorie, on doit trouver l'ID
          const category = await this.prisma.category.findFirst({
            where: { name: categoryMapping.internalCategory }
          });
          if (category) {
            finalCategoryId = category.id;
            this.logger.log(`✅ Catégorie mappée automatiquement: ${cjProduct.category} → ${category.name} (${category.id})`);
          } else {
            this.logger.warn(`⚠️ Catégorie "${categoryMapping.internalCategory}" non trouvée dans la base de données`);
          }
        } else {
          this.logger.warn(`⚠️ Aucun mapping trouvé pour "${cjProduct.category}", produit créé sans catégorie`);
        }
      }

      // Préparer les données du produit
      const productData = {
        name: cjProduct.name,
        description: cjProduct.description || '',
        price: cjProduct.price || 0,
        originalPrice: cjProduct.originalPrice || cjProduct.price || 0,
        image: cjProduct.image || '',
        supplierId: cjSupplier.id,
        externalCategory: cjProduct.category || '',
        categoryId: finalCategoryId || null,
        source: 'cj-dropshipping',
        status: 'draft', // ✅ Produit en attente de validation
        badge: 'nouveau',
        stock: 0,
        cjProductId: cjProduct.cjProductId || '',
        productSku: cjProduct.productSku || '',
        productWeight: cjProduct.productWeight,
        packingWeight: cjProduct.packingWeight,
        productType: cjProduct.productType,
        productUnit: cjProduct.productUnit,
        productKeyEn: cjProduct.productKeyEn,
        materialNameEn: cjProduct.materialNameEn,
        packingNameEn: cjProduct.packingNameEn,
        suggestSellPrice: cjProduct.suggestSellPrice,
        listedNum: cjProduct.listedNum,
        supplierName: cjProduct.supplierName,
        createrTime: cjProduct.createrTime,
        variants: cjProduct.variants,
        cjReviews: cjProduct.reviews,
        dimensions: cjProduct.dimensions,
        brand: cjProduct.brand,
        tags: cjProduct.tags,
      };

      // Vérifier les doublons
      const duplicateCheck = await this.duplicatePreventionService.checkCJProductDuplicate(
        cjProduct.cjProductId || '',
        cjProduct.productSku || '',
        {
          name: cjProduct.name,
          price: cjProduct.price || 0,
          description: cjProduct.description || ''
        }
      );

      // Créer le produit
      const importResult = await this.duplicatePreventionService.upsertCJProduct(productData, duplicateCheck);
      
      const product = await this.prisma.product.findUnique({
        where: { id: importResult.productId }
      });

      // Marquer comme importé dans CJProductStore
      await this.prisma.cJProductStore.update({
        where: { id: cjProduct.id },
        data: { status: 'imported' }
      });

      // Créer le mapping
      await this.prisma.cJProductMapping.create({
        data: {
          productId: product.id,
          cjProductId: cjProduct.cjProductId || '',
          cjSku: cjProduct.productSku || '',
          lastSyncAt: new Date(),
        },
      });

      this.logger.log(`✅ Produit importé avec succès: ${product.id} (${product.name})`);

      return {
        success: true,
        message: 'Produit importé avec succès',
        product
      };

    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'import du produit:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur lors de l\'import',
        error: 'IMPORT_ERROR'
      };
    }
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

  /**
   * Récupérer les webhooks en attente (produits non importés)
   */
  async getPendingWebhooks(type?: string, page: number = 1, limit: number = 50) {
    try {
      const where: any = {
        action: 'pending',
        type: type ? type.toUpperCase() : undefined,
      };

      // Nettoyer les filtres undefined
      if (!where.type) delete where.type;

      const skip = (page - 1) * limit;

      const [webhooks, total] = await Promise.all([
        this.prisma.cJWebhookLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.cJWebhookLog.count({ where }),
      ]);

      // Parser les payloads et extraire les données des produits
      const products = webhooks.map(webhook => {
        try {
          const payload = JSON.parse(webhook.payload);
          const params = payload.params || payload;
          
          // Extraire les informations du produit selon le type
          if (webhook.type === 'PRODUCT') {
            const productParams = params as CJProductParams;
            return {
              webhookId: webhook.id,
              messageId: webhook.messageId,
              type: webhook.type,
              productId: productParams.pid,
              name: productParams.productNameEn || productParams.productName || `Produit CJ ${productParams.pid}`,
              price: productParams.productSellPrice || 0,
              image: productParams.productImage || '',
              category: productParams.categoryName || '',
              sku: productParams.productSku || '',
              createdAt: webhook.createdAt,
              params: productParams,
            };
          } else if (webhook.type === 'VARIANT') {
            const variantParams = params as CJVariantParams;
            const pid = (variantParams as any).pid || '';
            return {
              webhookId: webhook.id,
              messageId: webhook.messageId,
              type: webhook.type,
              productId: pid,
              variantId: variantParams.vid,
              name: variantParams.variantName || `Variante ${variantParams.vid}`,
              price: variantParams.variantSellPrice || 0,
              image: variantParams.variantImage || '',
              createdAt: webhook.createdAt,
              params: variantParams,
            };
          }
          
          return null;
        } catch (error) {
          this.logger.error(`Erreur parsing payload webhook ${webhook.id}:`, error);
          return null;
        }
      }).filter(Boolean);

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Erreur récupération webhooks en attente:', error);
      throw error;
    }
  }

  /**
   * Importer un produit depuis un webhook en attente
   */
  async importFromPendingWebhook(webhookLogId: string, categoryId?: string) {
    try {
      const webhook = await this.prisma.cJWebhookLog.findUnique({
        where: { id: webhookLogId },
      });

      if (!webhook) {
        throw new Error('Webhook non trouvé');
      }

      if (webhook.action !== 'pending') {
        throw new Error(`Ce webhook a déjà été traité (action: ${webhook.action})`);
      }

      const payload = JSON.parse(webhook.payload);
      const params = payload.params || payload;

      if (webhook.type === 'PRODUCT') {
        const productParams = params as CJProductParams;
        
        // Nettoyer le nom du produit
        let productName = productParams.productNameEn || productParams.productName || `Produit CJ ${productParams.pid}`;
        try {
          if (productName.startsWith('[') && productName.endsWith(']')) {
            const parsed = JSON.parse(productName);
            if (Array.isArray(parsed) && parsed.length > 0) {
              productName = parsed[0];
            }
          }
        } catch (e) {
          // Ignorer
        }
        productName = this.cleanProductName(productName);

        const price = typeof productParams.productSellPrice === 'string' 
          ? parseFloat(productParams.productSellPrice) || 0
          : (productParams.productSellPrice || 0);

        // Créer le produit dans CJProductStore
        const storeProductData = {
          cjProductId: productParams.pid,
          name: productName,
          description: this.cleanProductDescription(productParams.productDescription || ''),
          price: price,
          originalPrice: price,
          image: productParams.productImage || '',
          category: productParams.categoryName || '',
          status: 'available',
          productSku: productParams.productSku || '',
        };

        const storeResult = await this.duplicatePreventionService.upsertCJStoreProduct(storeProductData);

        // Mettre à jour le webhook
        await this.prisma.cJWebhookLog.update({
          where: { id: webhookLogId },
          data: { action: 'imported' },
        });

        this.logger.log(`✅ Produit ${productParams.pid} importé depuis webhook vers CJProductStore`);

        return {
          success: true,
          message: 'Produit importé avec succès dans le magasin',
          productId: storeResult.productId,
          cjProductId: productParams.pid,
        };
      } else if (webhook.type === 'VARIANT') {
        // Pour les variants, on ne peut pas créer un produit complet
        // On retourne une erreur ou on suggère d'importer le produit parent
        throw new Error('Les variants doivent être importés via leur produit parent. Recherchez le produit avec le PID correspondant.');
      }

      throw new Error(`Type de webhook non supporté pour l'import: ${webhook.type}`);
    } catch (error) {
      this.logger.error(`Erreur import depuis webhook ${webhookLogId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur lors de l\'import',
      };
    }
  }

  /**
   * Ignorer un produit depuis un webhook en attente
   */
  async ignorePendingWebhook(webhookLogId: string) {
    try {
      const webhook = await this.prisma.cJWebhookLog.findUnique({
        where: { id: webhookLogId },
      });

      if (!webhook) {
        throw new Error('Webhook non trouvé');
      }

      if (webhook.action !== 'pending') {
        throw new Error(`Ce webhook a déjà été traité (action: ${webhook.action})`);
      }

      // Mettre à jour le webhook
      await this.prisma.cJWebhookLog.update({
        where: { id: webhookLogId },
        data: { action: 'ignored' },
      });

      this.logger.log(`✅ Webhook ${webhookLogId} ignoré`);

      return {
        success: true,
        message: 'Produit ignoré avec succès',
      };
    } catch (error) {
      this.logger.error(`Erreur ignore webhook ${webhookLogId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur lors de l\'ignore',
      };
    }
  }
}
