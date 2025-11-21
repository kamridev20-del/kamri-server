import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CJAPIClient } from '../cj-api-client';
import { CJOrderCreateDto } from '../dto/cj-order-create.dto';
import { CJOrder, CJOrderCreateResult } from '../interfaces/cj-order.interface';

@Injectable()
export class CJOrderService {
  private readonly logger = new Logger(CJOrderService.name);

  constructor(
    private prisma: PrismaService,
    private cjApiClient: CJAPIClient
  ) {}

  /**
   * Initialiser le client CJ avec la configuration
   */
  private async initializeClient(): Promise<CJAPIClient> {
    this.logger.log('🚀 Initialisation du client CJ...');
    
    const config = await this.prisma.cJConfig.findFirst();
    if (!config?.enabled) {
      throw new Error('L\'intégration CJ Dropshipping est désactivée');
    }

    // Initialiser la configuration du client injecté
    this.cjApiClient.setConfig({
      email: config.email,
      apiKey: config.apiKey,
      tier: config.tier as 'free' | 'plus' | 'prime' | 'advanced',
      platformToken: config.platformToken,
      debug: process.env.CJ_DEBUG === 'true',
    });

    // ✅ Essayer de charger le token depuis la base de données
    const tokenLoaded = await this.cjApiClient.loadTokenFromDatabase();
    
    if (!tokenLoaded) {
      // Si le token n'est pas en base ou est expiré, faire un login (dernier recours)
      this.logger.log('🔑 Token non trouvé en base ou expiré - Login CJ requis');
      await this.cjApiClient.login();
      this.logger.log('✅ Login CJ réussi');
    } else {
      this.logger.log('✅ Token CJ chargé depuis la base de données - Utilisation de la connexion existante');
    }
    
    return this.cjApiClient;
  }

  /**
   * Créer une commande CJ
   */
  async createOrder(orderData: CJOrderCreateDto): Promise<CJOrderCreateResult> {
    try {
      const client = await this.initializeClient();
      // S'assurer que shippingPhone a une valeur par défaut si manquant
      const orderDataWithDefaults = {
        ...orderData,
        shippingPhone: orderData.shippingPhone || '',
      };
      
      // 🔍 LOG COMPLET AVANT ENVOI (pour débogage)
      this.logger.log('═══════════════════════════════════════════════════════');
      this.logger.log('🚀 PAYLOAD FINAL ENVOYÉ À CJ createOrderV3:');
      this.logger.log('═══════════════════════════════════════════════════════');
      this.logger.log(JSON.stringify(orderDataWithDefaults, null, 2));
      this.logger.log('═══════════════════════════════════════════════════════');
      this.logger.log(`📦 ${orderDataWithDefaults.products.length} produit(s) dans la requête:`);
      orderDataWithDefaults.products.forEach((p, idx) => {
        this.logger.log(`  ${idx + 1}. vid="${p.vid}", quantity=${p.quantity}, storeLineItemId="${p.storeLineItemId || 'N/A'}"`);
      });
      this.logger.log('═══════════════════════════════════════════════════════\n');
      
      const cjOrder = await client.createOrderV3(orderDataWithDefaults);

      if (!cjOrder) {
        throw new Error('Réponse null de l\'API CJ lors de la création de commande');
      }

      if (!cjOrder.orderId) {
        this.logger.error('❌ Réponse CJ sans orderId:', JSON.stringify(cjOrder, null, 2));
        throw new Error(`Erreur création commande CJ: pas d'orderId dans la réponse`);
      }

      this.logger.log(`✅ Commande CJ créée: ${cjOrder.orderId}`);

      // Extraire les montants détaillés de la réponse
      const productAmount = (cjOrder as any).productAmount || 0;
      const postageAmount = (cjOrder as any).postageAmount || 0;
      const productOriginalAmount = (cjOrder as any).productOriginalAmount || productAmount;
      const postageOriginalAmount = (cjOrder as any).postageOriginalAmount || postageAmount;
      const totalDiscountAmount = (cjOrder as any).totalDiscountAmount || 0;
      const orderAmount = productAmount + postageAmount;

      return {
        orderId: cjOrder.orderId,
        orderNumber: cjOrder.orderNumber || cjOrder.orderId,
        status: cjOrder.orderStatus || 'CREATED',
        totalAmount: orderAmount,
        productAmount,
        postageAmount,
        productOriginalAmount,
        postageOriginalAmount,
        totalDiscountAmount,
        message: 'Commande CJ créée avec succès',
      };
    } catch (error) {
      this.logger.error('Erreur lors de la création de la commande CJ:', error);
      throw error;
    }
  }

  /**
   * Ajouter une commande au panier CJ
   */
  async addCart(cjOrderIdList: string[]): Promise<{
    successCount: number;
    addSuccessOrders: string[];
    unInterceptAddressCount: number;
    interceptOrders: any[];
  }> {
    try {
      const client = await this.initializeClient();
      this.logger.log(`🛒 Ajout de ${cjOrderIdList.length} commande(s) au panier CJ`);
      const result = await client.addCart(cjOrderIdList);
      this.logger.log(`✅ ${result.successCount} commande(s) ajoutée(s) au panier avec succès`);
      return result;
    } catch (error) {
      this.logger.error('Erreur lors de l\'ajout au panier CJ:', error);
      throw error;
    }
  }

  /**
   * Confirmer le panier CJ
   */
  async addCartConfirm(cjOrderIdList: string[]): Promise<{
    successCount: number;
    submitSuccess: boolean;
    shipmentsId: string;
    result: number;
    interceptOrders: any[];
  }> {
    try {
      const client = await this.initializeClient();
      this.logger.log(`✅ Confirmation de ${cjOrderIdList.length} commande(s) dans le panier CJ`);
      const result = await client.addCartConfirm(cjOrderIdList);
      this.logger.log(`✅ Panier confirmé: ${result.submitSuccess ? 'Succès' : 'Échec'}`);
      return result;
    } catch (error) {
      this.logger.error('Erreur lors de la confirmation du panier CJ:', error);
      throw error;
    }
  }

  /**
   * Obtenir le statut d'une commande
   */
  async getOrderStatus(orderId: string): Promise<CJOrder | null> {
    try {
      const client = await this.initializeClient();
      const status = await client.getOrderStatus(orderId);
      
      if (!status) {
        this.logger.warn(`⚠️ Commande ${orderId} introuvable chez CJ Dropshipping`);
        return null;
      }
      
      return status;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération du statut ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Synchroniser les statuts de commandes
   */
  async syncOrderStatuses(): Promise<{ synced: number; errors: number; notFound: number }> {
    try {
      const mappings = await this.prisma.cJOrderMapping.findMany();
      let synced = 0;
      let errors = 0;
      let notFound = 0;

      for (const mapping of mappings) {
        try {
          const client = await this.initializeClient();
          const cjOrder = await client.getOrderStatus(mapping.cjOrderId);
          
          // ✅ Vérifier si la commande existe chez CJ
          if (!cjOrder || !cjOrder.orderStatus) {
            this.logger.warn(`⚠️ Commande ${mapping.cjOrderId} introuvable chez CJ ou en attente de propagation`);
            notFound++;
            continue; // Passer à la suivante
          }
          
          // Mettre à jour le mapping
          await this.prisma.cJOrderMapping.update({
            where: { id: mapping.id },
            data: {
              status: cjOrder.orderStatus,
              trackNumber: cjOrder.trackNumber,
            },
          });

          // Mettre à jour la commande KAMRI
          await this.prisma.order.update({
            where: { id: mapping.orderId },
            data: {
              status: this.mapCJStatusToKamri(cjOrder.orderStatus),
            },
          });

          this.logger.log(`✅ Commande ${mapping.cjOrderId} synchronisée: ${cjOrder.orderStatus}`);
          synced++;
        } catch (error) {
          this.logger.error(`❌ Erreur sync commande ${mapping.cjOrderId}:`, error);
          errors++;
        }
      }

      this.logger.log(`📊 Synchronisation terminée: ${synced} réussies, ${notFound} non trouvées, ${errors} erreurs`);
      return { synced, errors, notFound };
    } catch (error) {
      this.logger.error('Erreur lors de la synchronisation des commandes:', error);
      throw error;
    }
  }

  /**
   * Calculer les frais de port
   */
  async calculateShipping(data: any): Promise<any> {
    try {
      const client = await this.initializeClient();
      return await client.calculateFreight(
        data.fromCountryCode,
        data.toCountryCode,
        data.products
      );
    } catch (error) {
      this.logger.error('Erreur lors du calcul des frais de port:', error);
      throw error;
    }
  }

  /**
   * Obtenir le tracking d'un colis
   */
  async getTracking(trackNumber: string): Promise<any> {
    try {
      const client = await this.initializeClient();
      return await client.getTracking(trackNumber);
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération du tracking ${trackNumber}:`, error);
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
}

