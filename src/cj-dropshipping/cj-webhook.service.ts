import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CJWebhookPayload } from './interfaces/cj-webhook.interface';

@Injectable()
export class CJWebhookService {
  private readonly logger = new Logger(CJWebhookService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Traite les webhooks CJ
   */
  async handleWebhook(type: string, payload: CJWebhookPayload): Promise<void> {
    this.logger.log(`🔄 Traitement webhook ${type}: ${payload.messageId}`);
    
    try {
      switch (type) {
        case 'PRODUCT':
          await this.handleProductUpdate(payload);
          break;
        case 'VARIANT':
          await this.handleVariantUpdate(payload);
          break;
        case 'STOCK':
          await this.handleStockUpdate(payload);
          break;
        case 'ORDER':
          await this.handleOrderUpdate(payload);
          break;
        case 'LOGISTIC':
          await this.handleLogisticUpdate(payload);
          break;
        case 'SOURCINGCREATE':
          await this.handleSourcingUpdate(payload);
          break;
        case 'ORDERSPLIT':
          await this.handleOrderSplitUpdate(payload);
          break;
        default:
          this.logger.warn(`Type de webhook non reconnu: ${type}`);
      }
      
      this.logger.log(`✅ Webhook ${type} traité avec succès`);
    } catch (error) {
      this.logger.error(`❌ Erreur traitement webhook ${type}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Traite les mises à jour de produits
   */
  async handleProductUpdate(payload: CJWebhookPayload): Promise<void> {
    const params = payload.params;
    
    this.logger.log(`🔄 Traitement mise à jour produit: ${params.pid}`);
    
    try {
      // TODO: Ajouter le champ cjPid au modèle Product
      // const existingProduct = await this.prisma.product.findFirst({
      //   where: { id: params.pid } // Temporaire: utiliser id au lieu de cjPid
      // });

      // if (existingProduct) {
      //   // Mettre à jour le produit existant
      //   await this.prisma.product.update({
      //     where: { id: existingProduct.id },
      //     data: {
      //       name: params.productName || existingProduct.name,
      //       description: params.productDescription || existingProduct.description,
      //       image: params.productImage || existingProduct.image,
      //       price: params.productSellPrice ? parseFloat(params.productSellPrice) : existingProduct.price,
      //       status: params.productStatus === 3 ? 'ACTIVE' : 'INACTIVE',
      //       // sku: params.productSku || existingProduct.sku, // TODO: Ajouter le champ sku au modèle Product
      //       updatedAt: new Date(),
      //     }
      //   });
        
      //   this.logger.log(`✅ Produit mis à jour: ${params.pid}`);
      // } else {
      //   // Créer un nouveau produit
      //   await this.prisma.product.create({
      //     data: {
      //       name: params.productName || '',
      //       description: params.productDescription || '',
      //       image: params.productImage || '',
      //       price: params.productSellPrice ? parseFloat(params.productSellPrice) : 0,
      //       status: params.productStatus === 3 ? 'ACTIVE' : 'INACTIVE',
      //       sku: params.productSku || '',
      //       categoryId: params.categoryId || null,
      //       // supplier: 'CJ_DROPSHIPPING', // TODO: Corriger la relation supplier
      //       createdAt: new Date(),
      //       updatedAt: new Date(),
      //     }
      //   });
        
      //   this.logger.log(`✅ Nouveau produit créé: ${params.pid}`);
      // }

      this.logger.log(`✅ Produit traité: ${params.pid}`);
    } catch (error) {
      this.logger.error(`❌ Erreur mise à jour produit ${params.pid}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Traite les mises à jour de variantes
   */
  async handleVariantUpdate(payload: CJWebhookPayload): Promise<void> {
    const params = payload.params;
    
    this.logger.log(`🔄 Traitement mise à jour variante: ${params.vid}`);
    
    try {
      // TODO: Ajouter le modèle ProductVariant au schéma Prisma
      // const existingVariant = await this.prisma.productVariant.findFirst({
      //   where: { cjVid: params.vid }
      // });

      // if (existingVariant) {
      //   // Mettre à jour la variante existante
      //   await this.prisma.productVariant.update({
      //     where: { id: existingVariant.id },
      //     data: {
      //       name: params.variantName || existingVariant.name,
      //       sku: params.variantSku || existingVariant.sku,
      //       price: params.variantSellPrice ? parseFloat(params.variantSellPrice) : existingVariant.price,
      //       status: params.variantStatus === 1 ? 'ACTIVE' : 'INACTIVE',
      //       weight: params.variantWeight || existingVariant.weight,
      //       dimensions: {
      //         length: params.variantLength || existingVariant.dimensions?.length,
      //         width: params.variantWidth || existingVariant.dimensions?.width,
      //         height: params.variantHeight || existingVariant.dimensions?.height,
      //       },
      //       image: params.variantImage || existingVariant.image,
      //       updatedAt: new Date(),
      //     }
      //   });
        
      //   this.logger.log(`✅ Variante mise à jour: ${params.vid}`);
      // } else {
      //   // Créer une nouvelle variante
      //   await this.prisma.productVariant.create({
      //     data: {
      //       cjVid: params.vid,
      //       name: params.variantName || 'Variante CJ',
      //       sku: params.variantSku || '',
      //       price: params.variantSellPrice ? parseFloat(params.variantSellPrice) : 0,
      //       status: params.variantStatus === 1 ? 'ACTIVE' : 'INACTIVE',
      //       weight: params.variantWeight || 0,
      //       dimensions: {
      //         length: params.variantLength || 0,
      //         width: params.variantWidth || 0,
      //         height: params.variantHeight || 0,
      //       },
      //       image: params.variantImage || '',
      //       productId: null, // À associer manuellement ou via logique métier
      //       createdAt: new Date(),
      //       updatedAt: new Date(),
      //     }
      //   });
        
      //   this.logger.log(`✅ Nouvelle variante créée: ${params.vid}`);
      // }

      this.logger.log(`✅ Variante traitée: ${params.vid}`);
    } catch (error) {
      this.logger.error(`❌ Erreur mise à jour variante ${params.vid}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Traite les mises à jour de stock
   */
  async handleStockUpdate(payload: CJWebhookPayload): Promise<void> {
    const params = payload.params;
    
    this.logger.log(`🔄 Traitement mise à jour stock`);
    
    try {
      // Parcourir tous les stocks reçus
      for (const [vid, stockData] of Object.entries(params)) {
        if (Array.isArray(stockData)) {
          for (const stock of stockData) {
            // TODO: Ajouter le modèle Stock au schéma Prisma
            // await this.prisma.stock.upsert({
            //   where: {
            //     variantId_warehouseId: {
            //       variantId: stock.vid,
            //       warehouseId: stock.areaId,
            //     }
            //   },
            //   update: {
            //     quantity: stock.storageNum,
            //     warehouseName: stock.areaEn,
            //     countryCode: stock.countryCode,
            //     updatedAt: new Date(),
            //   },
            //   create: {
            //     variantId: stock.vid,
            //     warehouseId: stock.areaId,
            //     quantity: stock.storageNum,
            //     warehouseName: stock.areaEn,
            //     countryCode: stock.countryCode,
            //     createdAt: new Date(),
            //     updatedAt: new Date(),
            //   }
            // });
            
            this.logger.log(`📦 Stock mis à jour: ${stock.vid} - ${stock.areaEn}: ${stock.storageNum}`);
          }
        }
      }
      
      this.logger.log(`✅ Stock traité avec succès`);
    } catch (error) {
      this.logger.error(`❌ Erreur mise à jour stock: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Traite les mises à jour de commandes
   */
  async handleOrderUpdate(payload: CJWebhookPayload): Promise<void> {
    const params = payload.params;
    
    this.logger.log(`🔄 Traitement mise à jour commande: ${params.orderNumber}`);
    
    try {
      // TODO: Ajouter les champs cjOrderId et orderNumber au modèle Order
      // await this.prisma.order.upsert({
      //   where: { id: params.cjOrderId.toString() }, // TODO: Ajouter cjOrderId au modèle Order
      //   update: {
      //     // orderNumber: params.orderNumber, // TODO: Ajouter orderNumber au modèle Order
      //     status: this.mapOrderStatus(params.orderStatus),
      //     // logisticName: params.logisticName, // TODO: Ajouter logisticName au modèle Order
      //     trackNumber: params.trackNumber,
      //     payDate: params.payDate ? new Date(params.payDate) : null,
      //     deliveryDate: params.deliveryDate ? new Date(params.deliveryDate) : null,
      //     completeDate: params.completeDate ? new Date(params.completeDate) : null,
      //     updatedAt: new Date(),
      //   },
      //   create: {
      //     // cjOrderId: params.cjOrderId.toString(), // TODO: Ajouter cjOrderId au modèle Order
      //     // orderNumber: params.orderNumber, // TODO: Ajouter orderNumber au modèle Order
      //     status: this.mapOrderStatus(params.orderStatus),
      //     // logisticName: params.logisticName, // TODO: Ajouter logisticName au modèle Order
      //     trackNumber: params.trackNumber,
      //     createdAt: new Date(params.createDate),
      //     updatedAt: new Date(params.updateDate),
      //     payDate: params.payDate ? new Date(params.payDate) : null,
      //     deliveryDate: params.deliveryDate ? new Date(params.deliveryDate) : null,
      //     completeDate: params.completeDate ? new Date(params.completeDate) : null,
      //   }
      // });
      
      this.logger.log(`✅ Commande traitée: ${params.orderNumber}`);
    } catch (error) {
      this.logger.error(`❌ Erreur mise à jour commande ${params.orderNumber}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Traite les mises à jour logistiques
   */
  async handleLogisticUpdate(payload: CJWebhookPayload): Promise<void> {
    const params = payload.params;
    
    this.logger.log(`🔄 Traitement mise à jour logistique: ${params.orderId}`);
    
    try {
      // TODO: Ajouter le champ cjOrderId au modèle Order
      // await this.prisma.order.updateMany({
      //   where: { id: params.orderId.toString() }, // TODO: Ajouter cjOrderId au modèle Order
      //   data: {
      //     // logisticName: params.logisticName, // TODO: Ajouter logisticName au modèle Order
      //     trackNumber: params.trackingNumber,
      //     trackingStatus: params.trackingStatus,
      //     trackingEvents: params.logisticsTrackEvents,
      //     updatedAt: new Date(),
      //   }
      // });
      
      this.logger.log(`✅ Logistique traitée: ${params.orderId}`);
    } catch (error) {
      this.logger.error(`❌ Erreur mise à jour logistique ${params.orderId}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Traite les mises à jour de sourcing
   */
  async handleSourcingUpdate(payload: CJWebhookPayload): Promise<void> {
    const params = payload.params;
    
    this.logger.log(`🔄 Traitement mise à jour sourcing: ${params.cjSourcingId}`);
    
    try {
      // TODO: Ajouter le modèle Sourcing au schéma Prisma
      // await this.prisma.sourcing.upsert({
      //   where: { cjSourcingId: params.cjSourcingId },
      //   update: {
      //     status: params.status,
      //     failReason: params.failReason,
      //     updatedAt: new Date(),
      //   },
      //   create: {
      //     cjProductId: params.cjProductId,
      //     cjVariantId: params.cjVariantId,
      //     cjVariantSku: params.cjVariantSku,
      //     cjSourcingId: params.cjSourcingId,
      //     status: params.status,
      //     failReason: params.failReason,
      //     createdAt: new Date(params.createDate),
      //     updatedAt: new Date(),
      //   }
      // });
      
      this.logger.log(`✅ Sourcing traité: ${params.cjSourcingId}`);
    } catch (error) {
      this.logger.error(`❌ Erreur mise à jour sourcing ${params.cjSourcingId}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Traite les divisions de commandes
   */
  async handleOrderSplitUpdate(payload: CJWebhookPayload): Promise<void> {
    const { messageId, params } = payload;
    
    this.logger.log(`🔄 Traitement division commande: ${params.originalOrderId}`);
    
    try {
      // TODO: Implémenter la logique de division des commandes
      // Traiter chaque commande divisée
      // for (const splitOrder of params.splitOrderList) {
      //   await this.prisma.order.create({
      //     data: {
      //       // cjOrderId: splitOrder.orderCode, // TODO: Ajouter cjOrderId au modèle Order
      //       // orderNumber: splitOrder.orderCode, // TODO: Ajouter orderNumber au modèle Order
      //       status: this.mapOrderStatus(splitOrder.orderStatus.toString()),
      //       parentOrderId: params.originalOrderId,
      //       createdAt: new Date(splitOrder.createAt),
      //       updatedAt: new Date(),
      //     }
      //   });
        
      //   this.logger.log(`✅ Commande divisée créée: ${splitOrder.orderCode}`);
      // }
      
      this.logger.log(`✅ Division commande traitée: ${params.originalOrderId}`);
    } catch (error) {
      this.logger.error(`❌ Erreur division commande ${params.originalOrderId}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Mappe le statut de commande CJ vers le statut interne
   */
  private mapOrderStatus(cjStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'CREATED': 'PENDING',
      'PAID': 'PAID',
      'PROCESSING': 'PROCESSING',
      'SHIPPED': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'CANCELLED': 'CANCELLED',
    };
    
    return statusMap[cjStatus] || 'PENDING';
  }

  /**
   * Configure les webhooks CJ
   */
  async configureWebhooks(params: any): Promise<{ success: boolean; message: string }> {
    this.logger.log('🔧 Configuration des webhooks CJ...');
    
    try {
      // TODO: Implémenter la configuration des webhooks
      return {
        success: true,
        message: 'Webhooks configurés avec succès (simulé)'
      };
    } catch (error) {
      this.logger.error(`❌ Erreur configuration webhooks: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Configure les webhooks par défaut
   */
  async setupDefaultWebhooks(baseUrl: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔧 Configuration des webhooks par défaut: ${baseUrl}`);
    
    try {
      // TODO: Implémenter la configuration des webhooks par défaut
      return {
        success: true,
        message: 'Webhooks par défaut configurés (simulé)'
      };
    } catch (error) {
      this.logger.error(`❌ Erreur configuration webhooks par défaut: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Désactive tous les webhooks
   */
  async disableAllWebhooks(): Promise<{ success: boolean; message: string }> {
    this.logger.log('🔧 Désactivation de tous les webhooks CJ...');
    
    try {
      // TODO: Implémenter la désactivation des webhooks
      return {
        success: true,
        message: 'Tous les webhooks désactivés (simulé)'
      };
    } catch (error) {
      this.logger.error(`❌ Erreur désactivation webhooks: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère le statut des webhooks
   */
  async getWebhookStatus(): Promise<{ success: boolean; status: any }> {
    this.logger.log('📊 Récupération du statut des webhooks...');
    
    try {
      // TODO: Implémenter la récupération du statut des webhooks
      return {
        success: true,
        status: {
          product: { enabled: false, url: null },
          stock: { enabled: false, url: null },
          order: { enabled: false, url: null },
          logistics: { enabled: false, url: null }
        }
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération statut webhooks: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }
}