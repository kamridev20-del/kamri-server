import { Injectable, Logger } from '@nestjs/common';
import { CJAPIClient } from './cj-api-client';

@Injectable()
export class CJOrdersService {
  private readonly logger = new Logger(CJOrdersService.name);

  constructor() {
    this.logger.log('CJOrdersService initialisé');
  }

  /**
   * Crée une commande V2
   */
  async createOrderV2(orderData: {
    orderNumber: string;
    shippingZip?: string;
    shippingCountry: string;
    shippingCountryCode: string;
    shippingProvince: string;
    shippingCity: string;
    shippingCounty?: string;
    shippingPhone?: string;
    shippingCustomerName: string;
    shippingAddress: string;
    shippingAddress2?: string;
    taxId?: string;
    remark?: string;
    email?: string;
    consigneeID?: string;
    payType?: number;
    shopAmount?: string;
    logisticName: string;
    fromCountryCode: string;
    houseNumber?: string;
    iossType?: number;
    platform?: string;
    iossNumber?: string;
    products: Array<{
      vid?: string;
      sku?: string;
      quantity: number;
      unitPrice?: number;
      storeLineItemId?: string;
      podProperties?: string;
    }>;
  }): Promise<{ success: boolean; orderId: string; message: string; data?: any }> {
    this.logger.log(`🛒 Création commande V2: ${orderData.orderNumber}`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('POST', '/shopping/order/createOrderV2', orderData);
      
      if (result.code === 200) {
        const data = result.data as any;
        this.logger.log(`✅ Commande V2 créée: ${data.orderId}`);
        return {
          success: true,
          orderId: data.orderId,
          message: 'Commande V2 créée avec succès',
          data: data
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la création de la commande V2');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur création commande V2: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Crée une commande V3
   */
  async createOrderV3(orderData: {
    orderNumber: string;
    shippingZip?: string;
    shippingCountry: string;
    shippingCountryCode: string;
    shippingProvince: string;
    shippingCity: string;
    shippingCounty?: string;
    shippingPhone?: string;
    shippingCustomerName: string;
    shippingAddress: string;
    shippingAddress2?: string;
    taxId?: string;
    remark?: string;
    email?: string;
    consigneeID?: string;
    shopAmount?: string;
    logisticName: string;
    fromCountryCode: string;
    houseNumber?: string;
    iossType?: number;
    platform?: string;
    iossNumber?: string;
    products: Array<{
      vid?: string;
      sku?: string;
      quantity: number;
      unitPrice?: number;
      storeLineItemId?: string;
      podProperties?: string;
    }>;
  }): Promise<{ success: boolean; orderId: string; message: string; data?: any }> {
    this.logger.log(`🛒 Création commande V3: ${orderData.orderNumber}`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('POST', '/shopping/order/createOrderV3', orderData);
      
      if (result.code === 200) {
        const data = result.data as any;
        this.logger.log(`✅ Commande V3 créée: ${data.orderId}`);
        return {
          success: true,
          orderId: data.orderId,
          message: 'Commande V3 créée avec succès',
          data: data
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la création de la commande V3');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur création commande V3: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Ajoute des commandes au panier
   */
  async addToCart(cjOrderIdList: string[]): Promise<{ success: boolean; message: string; data?: any }> {
    this.logger.log(`🛒 Ajout au panier: ${cjOrderIdList.length} commandes`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('POST', '/shopping/order/addCart', {
        cjOrderIdList
      });
      
      if (result.code === 200) {
        const data = result.data as any;
        this.logger.log(`✅ ${data.successCount} commandes ajoutées au panier`);
        return {
          success: true,
          message: `${data.successCount} commandes ajoutées au panier`,
          data: data
        };
      } else {
        throw new Error(result.message || 'Erreur lors de l\'ajout au panier');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur ajout panier: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Confirme les commandes du panier
   */
  async confirmCart(cjOrderIdList: string[]): Promise<{ success: boolean; message: string; data?: any }> {
    this.logger.log(`✅ Confirmation panier: ${cjOrderIdList.length} commandes`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('POST', '/shopping/order/addCartConfirm', {
        cjOrderIdList
      });
      
      if (result.code === 200) {
        const data = result.data as any;
        this.logger.log(`✅ ${data.successCount} commandes confirmées`);
        return {
          success: true,
          message: `${data.successCount} commandes confirmées`,
          data: data
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la confirmation du panier');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur confirmation panier: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Sauvegarde et génère une commande parent
   */
  async saveGenerateParentOrder(shipmentOrderId: string): Promise<{ success: boolean; message: string; data?: any }> {
    this.logger.log(`💾 Sauvegarde commande parent: ${shipmentOrderId}`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('POST', '/shopping/order/saveGenerateParentOrder', {
        shipmentOrderId
      });
      
      if (result.code === 200) {
        const data = result.data as any;
        this.logger.log(`✅ Commande parent sauvegardée: ${data.payId}`);
        return {
          success: true,
          message: 'Commande parent sauvegardée avec succès',
          data: data
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la sauvegarde de la commande parent');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur sauvegarde commande parent: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère la liste des commandes
   */
  async getOrders(params: {
    pageNum?: number;
    pageSize?: number;
    orderIds?: string[];
    shipmentOrderId?: string;
    status?: string;
  } = {}): Promise<{ success: boolean; orders: any[]; total: number }> {
    this.logger.log('📋 Récupération des commandes...');
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('GET', '/shopping/order/list', params);
      
      if (result.code === 200) {
        const data = result.data as any;
        this.logger.log(`✅ ${data.total} commandes trouvées`);
        return {
          success: true,
          orders: data.list || [],
          total: data.total || 0
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la récupération des commandes');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur récupération commandes: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les détails d'une commande
   */
  async getOrderDetails(orderId: string, features?: string[]): Promise<{ success: boolean; order: any }> {
    this.logger.log(`🔍 Récupération détails commande: ${orderId}`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const params: any = { orderId };
      if (features && features.length > 0) {
        features.forEach(feature => {
          params.features = feature;
        });
      }
      
      const result = await client.makeRequest('GET', '/shopping/order/getOrderDetail', params);
      
      if (result.code === 200) {
        const data = result.data as any;
        this.logger.log(`✅ Détails commande récupérés: ${data.orderId}`);
        return {
          success: true,
          order: data
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la récupération des détails de la commande');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur récupération détails commande: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Supprime une commande
   */
  async deleteOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🗑️ Suppression commande: ${orderId}`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('DELETE', '/shopping/order/deleteOrder', { orderId });
      
      if (result.code === 200) {
        this.logger.log(`✅ Commande supprimée: ${result.data}`);
        return {
          success: true,
          message: 'Commande supprimée avec succès'
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la suppression de la commande');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur suppression commande: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Confirme une commande
   */
  async confirmOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`✅ Confirmation commande: ${orderId}`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('POST', '/shopping/order/confirmOrder', { orderId });
      
      if (result.code === 200) {
        this.logger.log(`✅ Commande confirmée: ${result.data}`);
        return {
          success: true,
          message: 'Commande confirmée avec succès'
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la confirmation de la commande');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur confirmation commande: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère le solde du compte
   */
  async getBalance(): Promise<{ success: boolean; balance: any }> {
    this.logger.log('💰 Récupération du solde...');
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('GET', '/shopping/pay/getBalance', {});
      
      if (result.code === 200) {
        const data = result.data as any;
        this.logger.log(`✅ Solde récupéré: $${data.amount}`);
        return {
          success: true,
          balance: data
        };
      } else {
        throw new Error(result.message || 'Erreur lors de la récupération du solde');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur récupération solde: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Paiement avec solde
   */
  async payWithBalance(orderId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`💳 Paiement avec solde: ${orderId}`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('POST', '/shopping/pay/payBalance', { orderId });
      
      if (result.code === 200) {
        this.logger.log(`✅ Paiement effectué: ${orderId}`);
        return {
          success: true,
          message: 'Paiement effectué avec succès'
        };
      } else {
        throw new Error(result.message || 'Erreur lors du paiement');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur paiement: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Paiement avec solde V2
   */
  async payWithBalanceV2(shipmentOrderId: string, payId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`💳 Paiement V2 avec solde: ${shipmentOrderId}`);
    
    try {
      const client = new CJAPIClient(null as any);
      client.setConfig({
        email: process.env.CJ_EMAIL || '',
        apiKey: process.env.CJ_API_KEY || '',
        tier: 'free',
        debug: true
      });
      
      await client.login();
      
      const result = await client.makeRequest('POST', '/shopping/pay/payBalanceV2', {
        shipmentOrderId,
        payId
      });
      
      if (result.code === 200) {
        this.logger.log(`✅ Paiement V2 effectué: ${shipmentOrderId}`);
        return {
          success: true,
          message: 'Paiement V2 effectué avec succès'
        };
      } else {
        throw new Error(result.message || 'Erreur lors du paiement V2');
      }
    } catch (error) {
      this.logger.error(`❌ Erreur paiement V2: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }
}
