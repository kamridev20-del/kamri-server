import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CJAPIClient } from '../cj-api-client';
import { CJConfigService } from './cj-config.service';
import { CJFavoriteService } from './cj-favorite.service';
import { CJOrderService } from './cj-order.service';
import { CJProductService } from './cj-product.service';
import { CjSourcingService } from './cj-sourcing.service';
import { CJWebhookService } from './cj-webhook.service';

@Injectable()
export class CJMainService {
  private readonly logger = new Logger(CJMainService.name);

  constructor(
    private prisma: PrismaService,
    private cjApiClient: CJAPIClient,
    private cjConfigService: CJConfigService,
    private cjProductService: CJProductService,
    private cjFavoriteService: CJFavoriteService,
    private cjOrderService: CJOrderService,
    private cjWebhookService: CJWebhookService,
    public cjSourcingService: CjSourcingService
  ) {}

  // ===== DÉLÉGATION VERS LES SERVICES SPÉCIALISÉS =====

  // Configuration
  async getConfig() {
    return this.cjConfigService.getConfig();
  }

  async updateConfig(data: any) {
    return this.cjConfigService.updateConfig(data);
  }

  async testConnection() {
    return this.cjConfigService.testConnection();
  }

  async getConnectionStatus() {
    return this.cjConfigService.getConnectionStatus();
  }

  // Produits
  async getDefaultProducts(query: any) {
    return this.cjProductService.getDefaultProducts(query);
  }

  async searchProducts(query: any) {
    return this.cjProductService.searchProducts(query);
  }

  async getCategories() {
    return this.cjProductService.getCategories();
  }

  async getCategoriesTree() {
    return this.cjProductService.getCategoriesTree();
  }

  async syncCategories() {
    return this.cjProductService.syncCategories();
  }

  // ===== NOUVELLES MÉTHODES AVANCÉES POUR LES CATÉGORIES =====

  async searchCategories(params: any) {
    return this.cjProductService.searchCategories(params);
  }

  async getPopularCategories(limit: number = 10) {
    return this.cjProductService.getPopularCategories(limit);
  }

  async getSubCategories(parentId: string) {
    return this.cjProductService.getSubCategories(parentId);
  }

  async getCategoryPath(categoryId: string) {
    return this.cjProductService.getCategoryPath(categoryId);
  }

  async getProductDetails(pid: string) {
    return this.cjProductService.getProductDetails(pid);
  }

  async getProductDetailsWithReviews(pid: string) {
    return this.cjProductService.getProductDetailsWithReviews(pid);
  }

  async getProductReviews(pid: string) {
    const client = await this.cjProductService['initializeClient']();
    return client.getAllProductReviews(pid);
  }

  async getProductVariantStock(pid: string, variantId?: string, countryCode?: string) {
    return this.cjProductService.getProductVariantStock(pid, variantId, countryCode);
  }

  async getImportedProducts(filters?: any) {
    return this.cjProductService.getImportedProducts(filters);
  }

  async syncProductVariantsStock(productId: string) {
    return this.cjProductService.syncProductVariantsStock(productId);
  }

  // Favoris
  async getMyProducts(params?: any) {
    return this.cjFavoriteService.getMyProducts(params);
  }

  async syncFavorites() {
    return this.cjFavoriteService.syncFavorites();
  }

  async importProduct(pid: string, categoryId?: string, margin: number = 0, isFavorite: boolean = false) {
    return this.cjFavoriteService.importProduct(pid, categoryId, margin, isFavorite);
  }

  async syncStoreStocks() {
    return this.cjFavoriteService.syncAllStocks();
  }

  // Commandes
  async createOrder(orderData: any) {
    return this.cjOrderService.createOrder(orderData);
  }

  async getOrderStatus(orderId: string) {
    return this.cjOrderService.getOrderStatus(orderId);
  }

  async syncOrderStatuses() {
    return this.cjOrderService.syncOrderStatuses();
  }

  async calculateShipping(data: any) {
    return this.cjOrderService.calculateShipping(data);
  }

  async getTracking(trackNumber: string) {
    return this.cjOrderService.getTracking(trackNumber);
  }

  // Webhooks
  async handleWebhook(type: string, payload: any) {
    return this.cjWebhookService.handleWebhook(type, payload);
  }

  async configureWebhooks(enable: boolean, callbackUrl?: string, types?: ('product' | 'stock' | 'order' | 'logistics')[]) {
    // Si callbackUrl n'est pas fourni, utiliser une URL par défaut ou désactiver
    if (!callbackUrl && enable) {
      // Pour la compatibilité, si enable est true mais pas de callbackUrl, on désactive
      return this.cjWebhookService.configureWebhooks(false, '', types || []);
    }
    return this.cjWebhookService.configureWebhooks(enable, callbackUrl || '', types || ['product', 'stock', 'order', 'logistics']);
  }

  async getWebhookLogs(query?: any) {
    // Adapter le format de query pour le nouveau format
    return this.cjWebhookService.getWebhookLogs({
      type: query?.type,
      status: query?.status,
      limit: query?.limit,
      offset: query?.offset
    });
  }

  // ===== MÉTHODES MANQUANTES (pour compatibilité) =====
  
  async syncProducts(filters?: any) {
    // Délégation vers le service de produits
    return this.cjProductService.syncProducts ? this.cjProductService.syncProducts(filters) : { synced: 0, errors: 0 };
  }

  async getInventory(vid: string) {
    return this.cjProductService.getInventory(vid);
  }

  async getInventoryBySku(sku: string) {
    return this.cjProductService.getInventoryBySku(sku);
  }

  async syncInventory(productIds: string[]) {
    // Délégation vers le service de produits
    return this.cjProductService.syncInventory ? this.cjProductService.syncInventory(productIds) : { updated: 0, errors: 0 };
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Obtenir les statistiques
   */
  async getStats(): Promise<any> {
    const productMappings = await this.prisma.cJProductMapping.count();
    const orderMappings = await this.prisma.cJOrderMapping.count();
    const webhookLogs = await this.prisma.cJWebhookLog.count();
    const recentWebhooks = await this.prisma.cJWebhookLog.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h
        },
      },
    });

    const syncedProducts = await this.prisma.cJProductMapping.count({
      where: { lastSyncAt: { not: null } },
    });

    const activeOrders = await this.prisma.cJOrderMapping.count({
      where: { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
    });

    return {
      products: {
        total: productMappings,
        synced: syncedProducts,
      },
      orders: {
        total: orderMappings,
        active: activeOrders,
      },
      webhooks: {
        total: webhookLogs,
        recent: recentWebhooks,
      },
    };
  }

  /**
   * Statistiques des produits
   */
  async getProductStats(): Promise<any> {
    return {
      synced: await this.prisma.cJProductMapping.count({
        where: {
          lastSyncAt: {
            not: null,
          },
        },
      }),
    };
  }

  /**
   * Statistiques des commandes
   */
  async getOrderStats(): Promise<any> {
    return {
      active: await this.prisma.cJOrderMapping.count({
        where: {
          status: {
            notIn: ['DELIVERED', 'CANCELLED'],
          },
        },
      }),
    };
  }

  /**
   * Statistiques des webhooks
   */
  async getWebhookStats(): Promise<any> {
    return {
      processed: await this.prisma.cJWebhookLog.count({
        where: { processed: true },
      }),
      failed: await this.prisma.cJWebhookLog.count({
        where: { 
          processed: false,
          error: { not: null },
        },
      }),
    };
  }

  // ===== GESTION DU CACHE =====

  /**
   * Obtenir les statistiques du cache
   */
  async getCacheStats(): Promise<any> {
    return this.cjProductService.getCacheStats();
  }

  /**
   * Nettoyer le cache expiré
   */
  async cleanExpiredCache(): Promise<void> {
    return this.cjProductService.cleanExpiredCache();
  }
}

