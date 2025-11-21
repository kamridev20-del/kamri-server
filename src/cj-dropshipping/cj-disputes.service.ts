import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CJAPIClient } from './cj-api-client';

@Injectable()
export class CJDisputesService {
  private readonly logger = new Logger(CJDisputesService.name);

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
      // Si le token n'est pas en base ou est expiré, faire un login
      this.logger.log('🔑 Token non trouvé en base ou expiré - Login CJ requis');
      await this.cjApiClient.login();
      this.logger.log('✅ Login CJ réussi');
    } else {
      this.logger.log('✅ Token CJ chargé depuis la base de données - Utilisation de la connexion existante');
    }
    
    return this.cjApiClient;
  }

  /**
   * Récupère la liste des produits en litige
   */
  async getDisputeProducts(orderId: string): Promise<{ success: boolean; disputeProducts: any }> {
    this.logger.log(`🔍 Récupération des produits en litige pour la commande ${orderId}...`);
    
    try {
      const client = await this.initializeClient();
      
      const result = await client.makeRequest('GET', '/disputes/disputeProducts', { orderId });
      
      if (result.code === 200) {
        const data = result.data as any;
        this.logger.log(`✅ ${data.productInfoList?.length || 0} produits en litige trouvés`);
        return {
          success: true,
          disputeProducts: data
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la récupération des produits en litige');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur récupération produits litige: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Confirme un litige (7.2)
   * Retourne les informations nécessaires pour créer un litige (montants max, raisons disponibles, etc.)
   */
  async confirmDispute(params: {
    orderId: string;
    productInfoList: Array<{
      lineItemId: string;
      quantity: string;
      // price n'est pas requis dans la requête selon la doc (l'API le récupère automatiquement)
    }>;
  }): Promise<{ 
    success: boolean; 
    disputeInfo: {
      orderId: string;
      orderNumber?: string;
      maxProductPrice?: number;
      maxPostage?: number;
      maxIossTaxAmount?: number;
      maxIossHandTaxAmount?: number;
      maxAmount?: number;
      expectResultOptionList?: string[]; // ["1"] pour Refund, ["2"] pour Reissue
      productInfoList?: Array<{
        lineItemId: string;
        cjProductId?: string;
        cjVariantId?: string;
        canChoose?: boolean;
        price?: number;
        quantity?: number;
        cjProductName?: string;
        cjImage?: string;
        sku?: string;
        supplierName?: string;
      }>;
      disputeReasonList?: Array<{
        disputeReasonId: number;
        reasonName: string;
      }>;
    };
  }> {
    this.logger.log(`✅ Confirmation du litige pour la commande ${params.orderId}...`);
    
    try {
      const client = await this.initializeClient();
      
      // ✅ Selon la doc, on envoie seulement orderId et productInfoList avec lineItemId et quantity
      const requestBody = {
        orderId: params.orderId,
        productInfoList: params.productInfoList.map(p => ({
          lineItemId: p.lineItemId,
          quantity: p.quantity
        }))
      };
      
      const result = await client.makeRequest('POST', '/disputes/disputeConfirmInfo', requestBody);
      
      if (result.code === 200 && result.result === true) {
        // ✅ Caster result.data en any pour accéder aux propriétés
        const data = result.data as any;
        
        this.logger.log(`✅ Informations de litige récupérées avec succès`);
        this.logger.log(`📊 Montant max: $${data?.maxAmount || 0}`);
        this.logger.log(`📋 ${data?.disputeReasonList?.length || 0} raisons disponibles`);
        this.logger.log(`📦 ${data?.productInfoList?.length || 0} produits concernés`);
        
        return {
          success: true,
          disputeInfo: {
            orderId: data?.orderId || params.orderId, // Utiliser params.orderId comme fallback
            orderNumber: data?.orderNumber,
            maxProductPrice: data?.maxProductPrice,
            maxPostage: data?.maxPostage,
            maxIossTaxAmount: data?.maxIossTaxAmount,
            maxIossHandTaxAmount: data?.maxIossHandTaxAmount,
            maxAmount: data?.maxAmount,
            expectResultOptionList: data?.expectResultOptionList,
            productInfoList: data?.productInfoList,
            disputeReasonList: data?.disputeReasonList
          }
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la confirmation du litige');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur confirmation litige: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Crée un litige (7.3)
   */
  async createDispute(params: {
    orderId: string;
    businessDisputeId: string;
    disputeReasonId: number;
    expectType: number; // 1: Refund, 2: Reissue
    refundType: number; // 1: balance, 2: platform
    messageText: string; // Max 500 caractères
    imageUrl?: string[];
    videoUrl?: string[];
    productInfoList: Array<{
      lineItemId: string;
      quantity: string; // Dans la doc c'est integer mais l'exemple CURL utilise "1" (string)
      price: number; // REQUIS selon la doc
    }>;
  }): Promise<{ 
    success: boolean; 
    disputeId: string; // redirectUri de la réponse
    message: string;
    data?: string; // "true" selon la doc
  }> {
    this.logger.log(`📝 Création d'un litige pour la commande ${params.orderId}...`);
    this.logger.log(`📋 Raison: ${params.disputeReasonId}, Type: ${params.expectType === 1 ? 'Refund' : 'Reissue'}, Remboursement: ${params.refundType === 1 ? 'Balance' : 'Platform'}`);
    
    try {
      const client = await this.initializeClient();
      
      // ✅ Validation selon la doc
      if (!params.businessDisputeId || !params.orderId || !params.disputeReasonId || !params.messageText) {
        throw new Error('Paramètres requis manquants (businessDisputeId, orderId, disputeReasonId, messageText)');
      }
      
      if (params.messageText.length > 500) {
        throw new Error('Le message ne peut pas dépasser 500 caractères');
      }
      
      if (!params.productInfoList || params.productInfoList.length === 0) {
        throw new Error('Au moins un produit doit être inclus dans productInfoList');
      }
      
      // ✅ Vérifier que tous les produits ont un price (requis selon la doc)
      const invalidProducts = params.productInfoList.filter(p => !p.price && p.price !== 0);
      if (invalidProducts.length > 0) {
        throw new Error('Tous les produits doivent avoir un prix (price est requis)');
      }
      
      // ✅ Préparer la requête selon la doc
      const requestBody = {
        orderId: params.orderId,
        businessDisputeId: params.businessDisputeId,
        disputeReasonId: params.disputeReasonId,
        expectType: params.expectType,
        refundType: params.refundType,
        messageText: params.messageText,
        imageUrl: params.imageUrl || [],
        videoUrl: params.videoUrl || [],
        productInfoList: params.productInfoList.map(p => ({
          lineItemId: p.lineItemId,
          quantity: p.quantity,
          price: p.price
        }))
      };
      
      const result = await client.makeRequest('POST', '/disputes/create', requestBody);
      
      if (result.code === 200 && result.result === true) {
        // ✅ Selon la doc, la réponse contient data: "true" et redirectUri
        const responseData = result.data as any;
        const disputeId = responseData?.redirectUri || (typeof responseData === 'string' ? responseData : 'N/A');
        
        this.logger.log(`✅ Litige créé avec succès - ID: ${disputeId}`);
        
        return {
          success: true,
          disputeId: disputeId,
          message: 'Litige créé avec succès',
          data: typeof responseData === 'string' ? responseData : undefined
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la création du litige');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur création litige: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Annule un litige (7.4)
   */
  async cancelDispute(params: {
    orderId: string;
    disputeId: string;
  }): Promise<{ 
    success: boolean; 
    message: string;
    data?: string; // "true" selon la doc
    redirectUri?: string;
  }> {
    this.logger.log(`❌ Annulation du litige ${params.disputeId} pour la commande ${params.orderId}...`);
    
    try {
      const client = await this.initializeClient();
      
      // ✅ Validation selon la doc
      if (!params.orderId || !params.disputeId) {
        throw new Error('Paramètres requis manquants (orderId, disputeId)');
      }
      
      const result = await client.makeRequest('POST', '/disputes/cancel', params);
      
      if (result.code === 200 && result.result === true) {
        // ✅ Selon la doc, la réponse contient data: "true" et redirectUri
        const responseData = result.data as any;
        
        this.logger.log(`✅ Litige annulé avec succès`);
        
        return {
          success: true,
          message: 'Litige annulé avec succès',
          data: typeof responseData === 'string' ? responseData : undefined,
          redirectUri: responseData?.redirectUri
        };
      } else {
        throw new Error(result.message || 'Erreur lors de l\'annulation du litige');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur annulation litige: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère la liste des litiges (7.5)
   */
  async getDisputeList(params: {
    orderId?: string;
    disputeId?: number; // ✅ Selon la doc, c'est un integer
    orderNumber?: string;
    pageNum?: number; // default: 1
    pageSize?: number; // default: 10
  } = {}): Promise<{ 
    success: boolean; 
    disputes: Array<{
      status?: string; // dispute status
      id?: string; // dispute id
      disputeReason?: string; // dispute reason
      replacementAmount?: number; // Reissue amount (USD)
      resendOrderCode?: string; // Reissue order id
      money?: number; // final refund amount (USD)
      finallyDeal?: number; // 1:Refund, 2: Reissue, 3: Reject
      createDate?: string; // create date
      productList?: Array<{
        image?: string; // product image
        price?: number; // product price
        lineItemId?: string; // lineItem id
        cjProductId?: string; // CJ product id
        cjVariantId?: string; // CJ variant id
        productName?: string; // product name
        supplierName?: string; // supplier name
      }>;
    }>; 
    total: number;
    pageNum?: number;
    pageSize?: number;
  }> {
    this.logger.log('📋 Récupération de la liste des litiges...');
    this.logger.log(`📝 Paramètres: ${JSON.stringify(params)}`);
    
    try {
      const client = await this.initializeClient();
      
      // ✅ Préparer les paramètres avec les valeurs par défaut selon la doc
      const queryParams: any = {};
      if (params.orderId) queryParams.orderId = params.orderId;
      if (params.disputeId !== undefined) queryParams.disputeId = params.disputeId; // integer
      if (params.orderNumber) queryParams.orderNumber = params.orderNumber;
      queryParams.pageNum = params.pageNum || 1; // default: 1
      queryParams.pageSize = params.pageSize || 10; // default: 10
      
      const result = await client.makeRequest('GET', '/disputes/getDisputeList', queryParams);
      
      if (result.code === 200 && result.result === true) {
        // ✅ Selon la doc, la réponse contient data avec pageNum, pageSize, total, list
        const data = result.data as any;
        
        this.logger.log(`✅ ${data.list?.length || 0} litiges trouvés (total: ${data.total || 0}, page: ${data.pageNum || 1}/${Math.ceil((data.total || 0) / (data.pageSize || 10))})`);
        
        return {
          success: true,
          disputes: data.list || [],
          total: data.total || 0,
          pageNum: data.pageNum,
          pageSize: data.pageSize
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la récupération des litiges');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur récupération litiges: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Analyse les statistiques des litiges
   */
  async getDisputeAnalytics(): Promise<{ success: boolean; analytics: any }> {
    this.logger.log('📊 Analyse des statistiques des litiges...');
    
    try {
      const disputes = await this.getDisputeList({ pageSize: 100 });
      
      if (disputes.success) {
        const analytics = {
          total: disputes.total,
          byStatus: {},
          byReason: {},
          bySupplier: {},
          avgResolutionTime: 0,
          totalRefundAmount: 0,
          totalReissueAmount: 0
        };
        
        disputes.disputes.forEach(dispute => {
          // Statistiques par statut
          if (!analytics.byStatus[dispute.status]) {
            analytics.byStatus[dispute.status] = 0;
          }
          analytics.byStatus[dispute.status]++;
          
          // Statistiques par raison
          if (dispute.disputeReason) {
            if (!analytics.byReason[dispute.disputeReason]) {
              analytics.byReason[dispute.disputeReason] = 0;
            }
            analytics.byReason[dispute.disputeReason]++;
          }
          
          // Statistiques par fournisseur
          if (dispute.productList && dispute.productList.length > 0) {
            dispute.productList.forEach(product => {
              if (product.supplierName) {
                if (!analytics.bySupplier[product.supplierName]) {
                  analytics.bySupplier[product.supplierName] = 0;
                }
                analytics.bySupplier[product.supplierName]++;
              }
            });
          }
          
          // Montants
          if (dispute.money) {
            analytics.totalRefundAmount += typeof dispute.money === 'string' 
              ? parseFloat(dispute.money) 
              : dispute.money;
          }
          if (dispute.replacementAmount) {
            analytics.totalReissueAmount += typeof dispute.replacementAmount === 'string'
              ? parseFloat(dispute.replacementAmount)
              : dispute.replacementAmount;
          }
        });
        
        this.logger.log(`✅ Analytics des litiges calculées`);
        return {
          success: true,
          analytics
        };
      } else {
        throw new Error('Erreur lors de la récupération des litiges pour l\'analyse');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur analytics litiges: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }
}
