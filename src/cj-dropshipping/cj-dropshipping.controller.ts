import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    Logger,
    Param,
    Post,
    Put,
    Query,
    Req,
    Sse,
    MessageEvent
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
// 🔧 ANCIEN SERVICE SUPPRIMÉ - Remplacé par CJMainService
import { UpdateCJConfigDto } from './dto/cj-config.dto';
import { CJOrderCreateDto } from './dto/cj-order-create.dto';
import { CJProductSearchDto } from './dto/cj-product-search.dto';
import { CJWebhookDto } from './dto/cj-webhook.dto';
import { CJWebhookPayload, WebhookProcessingResult } from './interfaces/cj-webhook.interface';
import { CJSyncProgressEvent, CJSyncResult } from './interfaces/cj-sync-progress.interface';
import { CJSourcingCreateRequest } from './interfaces/cj-sourcing.interface';
// 🔧 NOUVEAUX SERVICES REFACTORISÉS
import { CJMainService } from './services/cj-main.service';
import { CJWebhookService } from './services/cj-webhook.service';
import { CJProductService } from './services/cj-product.service';

@ApiTags('cj-dropshipping')
@Controller('api/cj-dropshipping')
// @UseGuards(JwtAuthGuard) // Temporairement désactivé pour les tests
// @ApiBearerAuth()
export class CJDropshippingController {
  private readonly logger = new Logger(CJDropshippingController.name);
  
  constructor(
    private readonly cjMainService: CJMainService, // 🔧 SERVICE REFACTORISÉ
    private readonly cjWebhookService: CJWebhookService, // ✅ SERVICE WEBHOOK
    private readonly cjProductService: CJProductService, // ✅ SERVICE PRODUITS
    private readonly prisma: PrismaService
  ) {}

  // ===== CONFIGURATION =====

  @Get('config')
  @ApiOperation({ summary: 'Obtenir la configuration CJ Dropshipping' })
  @ApiResponse({ status: 200, description: 'Configuration récupérée avec succès' })
  async getConfig() {
    return this.cjMainService.getConfig();
  }

  @Get('config/status')
  @ApiOperation({ summary: 'Obtenir le statut de connexion CJ' })
  @ApiResponse({ status: 200, description: 'Statut de connexion récupéré' })
  async getConnectionStatus() {
    try {
      const status = await this.cjMainService.getConnectionStatus();
      return status;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération statut: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      return {
        connected: false,
        tier: 'free',
        lastSync: null,
        apiLimits: {
          qps: '1 req/s',
          loginPer5min: 1,
          refreshPerMin: 5
        },
        tips: ['CJ non configuré']
      };
    }
  }

  @Put('config')
  @ApiOperation({ summary: 'Mettre à jour la configuration CJ Dropshipping' })
  @ApiResponse({ status: 200, description: 'Configuration mise à jour avec succès' })
  async updateConfig(@Body() dto: UpdateCJConfigDto) {
    return this.cjMainService.updateConfig(dto);
  }

  @Post('config/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tester la connexion CJ Dropshipping' })
  @ApiResponse({ status: 200, description: 'Test de connexion effectué' })
  async testConnection() {
    return this.cjMainService.testConnection();
  }


  @Get('status')
  @ApiOperation({ summary: 'Obtenir le statut de connexion CJ Dropshipping' })
  @ApiResponse({ status: 200, description: 'Statut récupéré avec succès' })
  async getStatus() {
    return this.cjMainService.getConnectionStatus();
  }


  // ===== CATÉGORIES =====
  // Les endpoints de catégories sont maintenant gérés par CJCategoriesController
  // pour une meilleure séparation des responsabilités

  // ===== PRODUITS =====

  @Get('products/default')
  @ApiOperation({ summary: 'Obtenir les produits CJ par défaut' })
  @ApiResponse({ status: 200, description: 'Liste des produits par défaut' })
  async getDefaultProducts(@Query() query: { pageNum?: number; pageSize?: number; countryCode?: string; useCache?: boolean }) {
    this.logger.log('🔍 === DÉBUT CONTROLLER getDefaultProducts ===');
    this.logger.log('📝 Query reçue:', JSON.stringify(query, null, 2));
    
    try {
      const result = await this.cjMainService.getDefaultProducts(query);
      this.logger.log('✅ Controller getDefaultProducts terminé avec succès');
      // Le résultat est maintenant un objet avec products, total, totalPages, etc.
      const productCount = Array.isArray(result) ? result.length : (result.products?.length || 0);
      this.logger.log('📊 Nombre de produits retournés:', productCount);
      if (!Array.isArray(result) && result.total) {
        this.logger.log(`📊 Total: ${result.total}, Pages: ${result.totalPages}`);
      }
      this.logger.log('🔍 === FIN CONTROLLER getDefaultProducts ===');
      return result;
    } catch (error) {
      this.logger.error('❌ === ERREUR CONTROLLER getDefaultProducts ===');
      this.logger.error('💥 Erreur détaillée:', error);
      this.logger.error('📊 Type d\'erreur:', typeof error);
      this.logger.error('📊 Message d\'erreur:', error instanceof Error ? error.message : String(error));
      this.logger.error('📊 Stack trace:', error instanceof Error ? error.stack : 'N/A');
      this.logger.error('🔍 === FIN ERREUR CONTROLLER getDefaultProducts ===');
      
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
        details: error
      };
    }
  }

  @Get('products/search')
  @ApiOperation({ summary: 'Rechercher des produits CJ Dropshipping' })
  @ApiResponse({ status: 200, description: 'Liste des produits trouvés' })
  async searchProducts(@Query() query: CJProductSearchDto) {
    this.logger.log('🔍 === DÉBUT CONTROLLER searchProducts ===');
    this.logger.log('📝 Query reçue:', JSON.stringify(query, null, 2));
    
    try {
      const result = await this.cjMainService.searchProducts(query);
      this.logger.log('✅ Controller searchProducts terminé avec succès');
      this.logger.log('📊 Nombre de produits retournés:', result.products?.length || 0);
      this.logger.log('📊 Total disponible:', result.total || 0);
      this.logger.log('🔍 === FIN CONTROLLER searchProducts ===');
      return result;
    } catch (error) {
      this.logger.error('❌ === ERREUR CONTROLLER searchProducts ===');
      this.logger.error('💥 Erreur détaillée:', error);
      this.logger.error('📊 Type d\'erreur:', typeof error);
      this.logger.error('📊 Message d\'erreur:', error instanceof Error ? error.message : String(error));
      this.logger.error('📊 Stack trace:', error instanceof Error ? error.stack : 'N/A');
      this.logger.error('🔍 === FIN ERREUR CONTROLLER searchProducts ===');
      
      // ✅ CORRECTION: Rethrow l'erreur au lieu de retourner un objet
      throw error;
    }
  }


  @Post('products/:pid/import')
  @ApiOperation({ summary: 'Importer un produit CJ vers KAMRI' })
  @ApiResponse({ status: 201, description: 'Produit importé avec succès' })
  async importProduct(
    @Param('pid') pid: string,
    @Body() body: { categoryId?: string; margin?: number }
  ) {
    return this.cjMainService.importProduct(pid, body.categoryId, body.margin || 0);
  }

  @Post('products/sync')
  @ApiOperation({ summary: 'Synchroniser tous les produits CJ' })
  @ApiResponse({ status: 200, description: 'Synchronisation effectuée' })
  async syncProducts(@Body() filters?: any) {
    return this.cjMainService.syncProducts(filters);
  }

  @Get('products/:pid/details')
  @ApiOperation({ summary: 'Obtenir les détails complets d\'un produit CJ' })
  @ApiResponse({ status: 200, description: 'Détails du produit avec variants, stock, images' })
  async getProductDetails(@Param('pid') pid: string) {
    this.logger.log('🔍 === DÉBUT CONTROLLER getProductDetails ===');
    this.logger.log('📝 PID:', pid);
    
    try {
      const result = await this.cjMainService.getProductDetails(pid);
      this.logger.log('✅ Controller getProductDetails terminé avec succès');
      this.logger.log('🔍 === FIN CONTROLLER getProductDetails ===');
      return result;
    } catch (error) {
      this.logger.error('❌ === ERREUR CONTROLLER getProductDetails ===');
      this.logger.error('💥 Erreur:', error);
      this.logger.error('🔍 === FIN ERREUR CONTROLLER getProductDetails ===');
      throw error;
    }
  }

  @Get('products/:pid/details-with-reviews')
  @ApiOperation({ summary: 'Obtenir les détails complets d\'un produit CJ avec tous ses reviews' })
  @ApiResponse({ status: 200, description: 'Détails du produit avec tous les reviews paginés' })
  async getProductDetailsWithReviews(@Param('pid') pid: string) {
    this.logger.log('🔍 === DÉBUT CONTROLLER getProductDetailsWithReviews ===');
    this.logger.log('📝 PID:', pid);
    
    try {
      const result = await this.cjMainService.getProductDetailsWithReviews(pid);
      this.logger.log('✅ Controller getProductDetailsWithReviews terminé avec succès');
      this.logger.log('🔍 === FIN CONTROLLER getProductDetailsWithReviews ===');
      return result;
    } catch (error) {
      this.logger.error('❌ === ERREUR CONTROLLER getProductDetailsWithReviews ===');
      this.logger.error('💥 Erreur:', error);
      this.logger.error('🔍 === FIN ERREUR CONTROLLER getProductDetailsWithReviews ===');
      throw error;
    }
  }

  @Get('products/:pid/reviews')
  @ApiOperation({ summary: 'Obtenir tous les reviews d\'un produit CJ' })
  @ApiResponse({ status: 200, description: 'Liste de tous les reviews paginés' })
  async getProductReviews(@Param('pid') pid: string) {
    this.logger.log('🔍 === DÉBUT CONTROLLER getProductReviews ===');
    this.logger.log('📝 PID:', pid);
    
    try {
      const reviews = await this.cjMainService.getProductReviews(pid);
      
      this.logger.log(`✅ ${reviews.length} reviews récupérés`);
      this.logger.log('🔍 === FIN CONTROLLER getProductReviews ===');
      
      return {
        success: true,
        reviews: reviews,
        total: reviews.length
      };
    } catch (error) {
      this.logger.error('❌ === ERREUR CONTROLLER getProductReviews ===');
      this.logger.error('💥 Erreur:', error);
      this.logger.error('🔍 === FIN ERREUR CONTROLLER getProductReviews ===');
      throw error;
    }
  }

  @Get('products/:pid/variant-stock')
  @ApiOperation({ summary: 'Obtenir le stock des variantes d\'un produit CJ' })
  @ApiResponse({ status: 200, description: 'Stock des variantes' })
  async getProductVariantStock(
    @Param('pid') pid: string,
    @Query('variantId') variantId?: string,
    @Query('countryCode') countryCode?: string
  ) {
    this.logger.log('🔍 === DÉBUT CONTROLLER getProductVariantStock ===');
    this.logger.log('📝 Paramètres:', { pid, variantId, countryCode });
    
    try {
      const result = await this.cjMainService.getProductVariantStock(pid, variantId, countryCode);
      this.logger.log('✅ Controller getProductVariantStock terminé avec succès');
      this.logger.log('🔍 === FIN CONTROLLER getProductVariantStock ===');
      return result;
    } catch (error) {
      this.logger.error('❌ === ERREUR CONTROLLER getProductVariantStock ===');
      this.logger.error('💥 Erreur:', error);
      this.logger.error('🔍 === FIN ERREUR CONTROLLER getProductVariantStock ===');
      throw error;
    }
  }

  @Get('products/:pid/stock')
  @ApiOperation({ summary: 'Obtenir le stock en masse de TOUS les variants d\'un produit (optimisé)' })
  @ApiResponse({ status: 200, description: 'Stock de tous les variants en 1 requête' })
  async getProductStockBulk(@Param('pid') pid: string) {
    this.logger.log(`⚡ === RÉCUPÉRATION STOCK BULK POUR PID: ${pid} ===`);
    
    try {
      // Obtenir le client CJ initialisé via le service produit
      const productService = this.cjMainService['cjProductService'];
      const client = await productService['initializeClient']();
      const stockMap = await client.getProductInventoryBulk(pid);
      
      // Convertir la Map en objet pour JSON
      const stockData: Record<string, any> = {};
      stockMap.forEach((data, vid) => {
        stockData[vid] = data;
      });
      
      this.logger.log(`✅ Stock de ${stockMap.size} variants récupéré`);
      
      return {
        success: true,
        data: stockData,
        message: `Stock de ${stockMap.size} variants récupéré`
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération stock bulk:', error);
      return {
        success: false,
        data: {},
        message: 'Erreur lors de la récupération des stocks'
      };
    }
  }

  // ===== GESTION DU CACHE =====

  @Get('cache/stats')
  @ApiOperation({ summary: 'Obtenir les statistiques du cache CJ' })
  @ApiResponse({ status: 200, description: 'Statistiques du cache' })
  async getCacheStats() {
    this.logger.log('📊 Récupération des statistiques du cache');
    try {
      const stats = await this.cjMainService.getCacheStats();
      this.logger.log('✅ Statistiques du cache récupérées');
      return {
        success: true,
        data: stats,
        message: '📊 Statistiques du cache récupérées'
      };
    } catch (error) {
      this.logger.error('❌ Erreur lors de la récupération des stats cache:', error);
      throw error;
    }
  }

  @Post('cache/clean')
  @ApiOperation({ summary: 'Nettoyer le cache expiré CJ' })
  @ApiResponse({ status: 200, description: 'Cache nettoyé' })
  async cleanCache() {
    this.logger.log('🧹 Nettoyage du cache expiré');
    try {
      await this.cjMainService.cleanExpiredCache();
      this.logger.log('✅ Cache nettoyé avec succès');
      return {
        success: true,
        message: '🧹 Cache expiré nettoyé avec succès'
      };
    } catch (error) {
      this.logger.error('❌ Erreur lors du nettoyage du cache:', error);
      throw error;
    }
  }

  // ===== INVENTAIRE =====
  // ⚠️ IMPORTANT: Les routes spécifiques DOIVENT être AVANT les routes génériques

  @Get('inventory/vid/:vid')
  @ApiOperation({ summary: '3.1 Inventory Inquiry - Obtenir le stock d\'une variante CJ par VID' })
  @ApiResponse({ status: 200, description: 'Liste des stocks par entrepôt pour ce variant' })
  async getInventoryByVid(@Param('vid') vid: string) {
    this.logger.log(`📦 Récupération inventaire par VID: ${vid}`);
    return this.cjMainService.getInventory(vid);
  }

  @Get('inventory/sku/:sku')
  @ApiOperation({ summary: '3.2 Query Inventory by SKU - Obtenir le stock par SKU' })
  @ApiResponse({ status: 200, description: 'Liste des stocks par entrepôt pour ce SKU' })
  async getInventoryBySku(@Param('sku') sku: string) {
    this.logger.log(`📦 Récupération inventaire par SKU: ${sku}`);
    return this.cjMainService.getInventoryBySku(sku);
  }

  // ✅ Endpoint legacy pour compatibilité - Utilise un chemin différent pour éviter les conflits
  @Get('inventory/legacy/:vid')
  @ApiOperation({ summary: '[LEGACY] Obtenir le stock d\'une variante CJ par VID' })
  @ApiResponse({ status: 200, description: 'Informations de stock' })
  async getInventoryLegacy(@Param('vid') vid: string) {
    this.logger.log(`📦 [LEGACY] Récupération inventaire par VID: ${vid}`);
    return this.cjMainService.getInventory(vid);
  }

  @Post('inventory/sync')
  @ApiOperation({ summary: 'Synchroniser l\'inventaire des produits CJ' })
  @ApiResponse({ status: 200, description: 'Synchronisation de l\'inventaire effectuée' })
  async syncInventory(@Body() body: { productIds?: string[] }) {
    return this.cjMainService.syncInventory(body.productIds || []);
  }

  /**
   * Synchroniser les variants de tous les produits CJ
   * ⚠️ IMPORTANT: Cette route doit être AVANT la route avec paramètre pour éviter les conflits
   */
  @Post('products/sync-all-variants')
  @ApiOperation({ summary: 'Synchroniser les variants de tous les produits CJ' })
  @ApiResponse({ status: 200, description: 'Variants synchronisés' })
  async syncAllProductsVariants() {
    this.logger.log(`📡 === REQUÊTE SYNC VARIANTS TOUS PRODUITS ===`);
    
    try {
      // Récupérer tous les produits CJ
      const products = await this.prisma.product.findMany({
        where: {
          source: 'cj-dropshipping',
        },
        select: {
          id: true,
          name: true,
          cjProductId: true,
        },
      });

      // Filtrer ceux qui ont un cjProductId
      const cjProducts = products.filter(p => p.cjProductId !== null);

      this.logger.log(`📦 ${cjProducts.length} produit(s) CJ à synchroniser`);

      let totalSynced = 0;
      let totalFailed = 0;
      let totalVariants = 0;
      const errors: Array<{ productId: string; name: string; error: string }> = [];

      // Synchroniser chaque produit (avec pause pour rate limiting)
      for (const product of cjProducts) {
        try {
          const result = await this.cjMainService.syncProductVariantsStock(product.id);
          
          if (result.success) {
            totalSynced++;
            totalVariants += result.updated || 0;
            this.logger.log(`✅ ${product.name}: ${result.updated} variants`);
          } else {
            totalFailed++;
            errors.push({
              productId: product.id,
              name: product.name || 'N/A',
              error: result.message || 'Erreur inconnue'
            });
          }

          // Pause de 600ms entre chaque produit (tier plus = 2 req/s)
          await new Promise(resolve => setTimeout(resolve, 600));
        } catch (error: any) {
          totalFailed++;
          errors.push({
            productId: product.id,
            name: product.name || 'N/A',
            error: error.message || 'Erreur inconnue'
          });
          this.logger.error(`❌ Erreur pour ${product.name}:`, error.message);
        }
      }

      return {
        success: true,
        message: `Synchronisation terminée: ${totalSynced} produits, ${totalVariants} variants`,
        data: {
          totalProducts: cjProducts.length,
          synced: totalSynced,
          failed: totalFailed,
          totalVariants: totalVariants,
          errors: errors.length > 0 ? errors : undefined
        }
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur endpoint sync all variants:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur synchronisation';
      return {
        success: false,
        message: errorMessage,
        data: {
          totalProducts: 0,
          synced: 0,
          failed: 0,
          totalVariants: 0,
          errors: []
        }
      };
    }
  }

  /**
   * Synchroniser le stock des variants d'un produit manuellement
   * ⚠️ IMPORTANT: Cette route doit être APRÈS la route sync-all-variants
   */
  @Post('products/:productId/sync-variants-stock')
  @ApiOperation({ summary: 'Synchroniser le stock des variants d\'un produit manuellement' })
  @ApiResponse({ status: 200, description: 'Stock des variants synchronisé' })
  async syncProductVariantsStock(
    @Param('productId') productId: string
  ) {
    this.logger.log(`📡 === REQUÊTE SYNC STOCK VARIANTS ===`);
    this.logger.log(`   Product ID: ${productId}`);
    
    try {
      const result = await this.cjMainService.syncProductVariantsStock(productId);
      
      this.logger.log(`✅ Sync terminée: ${result.updated} variants mis à jour`);
      
      return {
        success: result.success,
        message: result.message,
        data: {
          updated: result.updated || 0,
          failed: result.failed || 0,
          total: result.total || 0
        }
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur endpoint sync stock variants:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur synchronisation stock';
      return {
        success: false,
        message: errorMessage,
        data: {
          updated: 0,
          failed: 1,
          total: 0
        }
      };
    }
  }

  // ===== COMMANDES =====

  @Post('orders')
  @ApiOperation({ summary: 'Créer une commande CJ Dropshipping' })
  @ApiResponse({ status: 201, description: 'Commande créée avec succès' })
  async createOrder(@Body() dto: CJOrderCreateDto) {
    return this.cjMainService.createOrder(dto);
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Obtenir le statut d\'une commande CJ' })
  @ApiResponse({ status: 200, description: 'Statut de la commande' })
  async getOrderStatus(@Param('orderId') orderId: string) {
    return this.cjMainService.getOrderStatus(orderId);
  }

  @Post('orders/sync')
  @ApiOperation({ summary: 'Synchroniser les statuts des commandes CJ' })
  @ApiResponse({ status: 200, description: 'Synchronisation des commandes effectuée' })
  async syncOrderStatuses() {
    return this.cjMainService.syncOrderStatuses();
  }

  // ===== LOGISTIQUE =====

  @Post('logistics/calculate')
  @ApiOperation({ summary: 'Calculer les frais de port' })
  @ApiResponse({ status: 200, description: 'Frais de port calculés' })
  async calculateShipping(@Body() data: any) {
    return this.cjMainService.calculateShipping(data);
  }

  @Get('logistics/tracking/:trackNumber')
  @ApiOperation({ summary: 'Obtenir le tracking d\'un colis' })
  @ApiResponse({ status: 200, description: 'Informations de tracking' })
  async getTracking(@Param('trackNumber') trackNumber: string) {
    return this.cjMainService.getTracking(trackNumber);
  }

  // ===== WEBHOOKS =====

  @Get('webhooks')
  @ApiOperation({ summary: 'Endpoint de test pour CJ Dropshipping (vérification URL)' })
  @ApiResponse({ status: 200, description: 'Endpoint accessible' })
  async testWebhookEndpoint(@Req() request: Request) {
    this.logger.log('✅ Test endpoint webhook appelé par CJ Dropshipping');
    return {
      code: 200,
      result: true,
      message: 'Webhook endpoint is accessible',
      data: {
        endpoint: '/api/cj-dropshipping/webhooks',
        method: 'POST',
        status: 'ready'
      },
      requestId: 'test-' + Date.now()
    };
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.OK) // ✅ Réponse 200 OK requise par CJ
  @ApiOperation({ summary: 'Recevoir les webhooks CJ Dropshipping' })
  // ✅ Headers explicites pour garantir le Content-Type
  @ApiResponse({ 
    status: 200,
    description: 'Webhook reçu et traité',
    headers: {
      'Content-Type': {
        description: 'application/json',
        schema: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook reçu et traité (format conforme CJ)',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        result: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Success' },
        data: { type: 'object' },
        requestId: { type: 'string' }
      }
    }
  })
  async handleWebhook(@Body() dto: any, @Req() request: Request) {
    const startTime = Date.now();
    
    // ✅ Gérer les requêtes de test de CJ Dropshipping (sans body ou body vide)
    // CJ teste l'endpoint avant de le configurer - doit répondre IMMÉDIATEMENT (< 3s)
    if (!dto || Object.keys(dto).length === 0 || !dto.messageId) {
      this.logger.log('✅ Test de connexion webhook par CJ Dropshipping');
      // Réponse IMMÉDIATE sans traitement
      return {
        code: 200,
        result: true,
        message: 'Success',
        data: {
          endpoint: '/api/cj-dropshipping/webhooks',
          status: 'ready',
          timestamp: new Date().toISOString()
        },
        requestId: 'test-' + Date.now()
      };
    }
    
    // ✅ VALIDATION HTTPS STRICTE (mais permettre ngrok en développement)
    const isHttps = request.protocol === 'https' || 
                    request.headers['x-forwarded-proto'] === 'https' ||
                    request.headers['x-forwarded-ssl'] === 'on';
    
    if (process.env.NODE_ENV === 'production' && !isHttps) {
      this.logger.error('❌ Webhook reçu en HTTP (HTTPS requis)');
      return {
        code: 200,
        result: false,
        message: 'HTTPS required in production',
        data: null,
        requestId: dto.messageId || 'unknown'
      };
    }

    try {
      // Cast le type en CJWebhookPayload
      const payload: CJWebhookPayload = {
        messageId: dto.messageId,
        type: dto.type as any,
        params: dto.params
      };

      // ✅ Traitement ASYNCHRONE pour répondre rapidement (< 3s)
      // Le traitement lourd se fait en arrière-plan
      const processPromise = this.cjWebhookService.processWebhook(payload);
      
      // ✅ Répondre IMMÉDIATEMENT avec un timeout de sécurité
      type QuickResponse = 
        | { success: true; result: WebhookProcessingResult }
        | { success: false; timeout: true };
      
      const quickResponse: QuickResponse = await Promise.race([
        processPromise.then(result => ({ success: true as const, result })),
        new Promise<QuickResponse>(resolve => 
          setTimeout(() => resolve({ success: false as const, timeout: true }), 2500)
        )
      ]);

      const processingTime = Date.now() - startTime;

      if (quickResponse.success === false) {
        // TypeScript sait maintenant que c'est { success: false; timeout: true }
        this.logger.warn(`⚠️  Webhook prend trop de temps, réponse rapide envoyée`);
        // Traitement continue en arrière-plan
        processPromise.catch(err => this.logger.error('Erreur traitement asynchrone:', err));
        
        return {
          code: 200,
          result: true,
          message: 'Success',
          data: {
            messageId: payload.messageId,
            type: payload.type,
            processingTimeMs: processingTime,
            processed: true,
            note: 'Processing in background'
          },
          requestId: payload.messageId
        };
      }

      // TypeScript sait maintenant que quickResponse.success === true
      this.logger.log(`✅ Webhook traité en ${processingTime}ms`);

      // ✅ FORMAT CONFORME À LA DOC CJ
      return {
        code: 200,
        result: true,
        message: 'Success',
        data: {
          messageId: payload.messageId,
          type: payload.type,
          processingTimeMs: processingTime,
          processed: true,
          details: quickResponse.result
        },
        requestId: payload.messageId
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error('❌ Erreur traitement webhook:', error);

      // ✅ TOUJOURS RETOURNER 200 OK (requis par CJ)
      return {
        code: 200,
        result: false,
        message: error.message || 'Processing error',
        data: {
          messageId: dto.messageId,
          type: dto.type,
          processingTimeMs: processingTime,
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        requestId: dto.messageId
      };
    }
  }

  @Post('webhooks/configure')
  @ApiOperation({ 
    summary: 'Configurer les webhooks CJ Dropshipping',
    description: 'Active ou désactive les webhooks avec l\'URL de callback. Conforme à la doc CJ : POST /webhook/set'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        enable: { 
          type: 'boolean', 
          description: 'Activer (true) ou désactiver (false) les webhooks',
          example: true
        },
        callbackUrl: { 
          type: 'string', 
          description: 'URL de callback HTTPS pour recevoir les webhooks',
          example: 'https://votre-domaine.com/api/cj-dropshipping/webhooks'
        },
        types: { 
          type: 'array', 
          items: { type: 'string', enum: ['product', 'stock', 'order', 'logistics'] },
          description: 'Types de webhooks à configurer (optionnel, tous par défaut)',
          example: ['product', 'stock', 'order', 'logistics']
        }
      },
      required: ['enable', 'callbackUrl']
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhooks configurés avec succès',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        result: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Webhooks configured successfully' },
        data: { type: 'object' },
        requestId: { type: 'string' }
      }
    }
  })
  async configureWebhooks(
    @Body() config: { 
      enable: boolean; 
      callbackUrl?: string;
      types?: ('product' | 'stock' | 'order' | 'logistics')[];
    }
  ) {
    // Validation de l'URL : HTTPS obligatoire (même en local, CJ Dropshipping exige HTTPS)
    // Pour tester en local, utilisez un tunnel HTTPS (ngrok, Cloudflare Tunnel, etc.)
    if (config.enable) {
      if (!config.callbackUrl) {
        return {
          code: 200,
          result: false,
          message: 'Callback URL is required when enabling webhooks',
          data: {
            error: 'Callback URL is required',
            suggestion: 'Please provide a callbackUrl in the request body'
          },
          requestId: 'config-validation-' + Date.now()
        };
      }
      if (!config.callbackUrl.startsWith('https://')) {
        return {
          code: 200,
          result: false,
          message: 'Callback URL must use HTTPS protocol. CJ Dropshipping requires HTTPS even for local testing. Use ngrok or similar tunnel.',
          data: {
            error: 'HTTPS required by CJ Dropshipping API',
            suggestion: 'For local testing, use ngrok: ngrok http 3001'
          },
          requestId: 'config-validation-' + Date.now()
        };
      }
    }

    return this.cjWebhookService.configureWebhooks(
      config.enable,
      config.callbackUrl || '',
      config.types
    );
  }

  @Get('webhooks/status')
  @ApiOperation({ 
    summary: 'Obtenir le statut de configuration des webhooks',
    description: 'Récupère le statut actuel des webhooks (activé/désactivé, URL, types)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Statut des webhooks',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        result: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Webhook status retrieved' },
        data: { 
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            configured: { type: 'boolean' },
            callbackUrl: { type: 'string' },
            types: { type: 'array', items: { type: 'string' } },
            lastUpdated: { type: 'string', format: 'date-time' }
          }
        },
        requestId: { type: 'string' }
      }
    }
  })
  async getWebhookStatus() {
    return this.cjWebhookService.getWebhookStatus();
  }

  @Get('webhooks/logs')
  @ApiOperation({ 
    summary: 'Obtenir les logs des webhooks reçus',
    description: 'Liste tous les webhooks reçus avec leur statut de traitement'
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filtrer par type (PRODUCT, VARIANT, STOCK, ORDER, etc.)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (RECEIVED, PROCESSED, ERROR)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de résultats (défaut: 100)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset pour pagination (défaut: 0)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Logs des webhooks',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'number', example: 200 },
        result: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Webhook logs retrieved' },
        data: { 
          type: 'object',
          properties: {
            logs: { type: 'array', items: { type: 'object' } },
            total: { type: 'number' },
            limit: { type: 'number' },
            offset: { type: 'number' }
          }
        },
        requestId: { type: 'string' }
      }
    }
  })
  async getWebhookLogs(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    return this.cjWebhookService.getWebhookLogs({
      type,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    });
  }

  // ===== STATISTIQUES =====

  @Get('stats')
  @ApiOperation({ summary: 'Obtenir les statistiques CJ Dropshipping' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées' })
  async getStats() {
    return this.cjMainService.getStats();
  }

  @Post('sync-favorites')
  @ApiOperation({ summary: 'Synchroniser les favoris CJ avec KAMRI' })
  @ApiResponse({ status: 200, description: 'Favoris synchronisés avec succès' })
  async syncFavorites() {
    try {
      const result = await this.cjMainService.syncFavorites();
      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur synchronisation favoris: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      return {
        success: false,
        synced: 0,
        failed: 0,
        total: 0,
        errors: [],
        message: `Erreur lors de la synchronisation des favoris: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Synchroniser les favoris CJ avec progression en temps réel (SSE)
   * @returns Observable d'événements de progression
   */
  @Sse('sync-favorites-progress')
  @ApiOperation({ summary: 'Synchroniser les favoris CJ avec progression en temps réel (SSE)' })
  @ApiResponse({ status: 200, description: 'Stream d\'événements de progression' })
  async syncFavoritesWithProgress(): Promise<Observable<MessageEvent>> {
    this.logger.log('📡 === DÉBUT SSE SYNC FAVORIS CJ ===');
    
    return new Observable((observer) => {
      // Accéder au service via CJMainService
      const favoriteService = (this.cjMainService as any).cjFavoriteService;
      
      favoriteService.syncFavoritesWithProgress((event: CJSyncProgressEvent) => {
        // Envoyer l'événement de progression au client
        observer.next({
          data: event
        } as MessageEvent);
      })
      .then((result: CJSyncResult) => {
        // Envoyer le résultat final
        observer.next({
          data: result
        } as MessageEvent);
        
        this.logger.log('✅ SSE sync favoris terminé avec succès');
        observer.complete();
      })
      .catch((error) => {
        this.logger.error('❌ Erreur SSE sync favoris:', error);
        
        observer.next({
          data: {
            done: true,
            success: false,
            synced: 0,
            failed: 0,
            total: 0,
            duration: 0,
            message: `Erreur: ${error instanceof Error ? error.message : String(error)}`
          } as CJSyncResult
        } as MessageEvent);
        
        observer.error(error);
      });
    });
  }

  @Get('favorites/status')
  @ApiOperation({ summary: 'Vérifier le statut des favoris CJ' })
  @ApiResponse({ status: 200, description: 'Statut des favoris récupéré' })
  async getFavoritesStatus() {
    try {
      this.logger.log('🔍 Vérification du statut des favoris CJ...');
      
      // Récupérer les favoris depuis la base de données (requête SQL directe)
      const favorites = await this.prisma.$queryRaw`
        SELECT * FROM cj_product_store 
        WHERE isFavorite = 1 
        ORDER BY createdAt DESC
      `;
      
      const favoritesArray = favorites as any[];
      this.logger.log(`✅ ${favoritesArray.length} favoris trouvés en base`);
      
      return {
        success: true,
        count: favoritesArray.length,
        favorites: favoritesArray.map(fav => ({
          id: fav.id,
          name: fav.name,
          cjProductId: fav.cjProductId,
          status: fav.status,
          createdAt: fav.createdAt
        }))
      };
    } catch (error) {
      this.logger.error(`❌ Erreur vérification favoris: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        count: 0,
        favorites: []
      };
    }
  }


  @Get('products/imported-favorites')
  @ApiOperation({ summary: 'Récupérer les produits CJ favoris importés' })
  @ApiResponse({ status: 200, description: 'Produits favoris importés récupérés' })
  async getImportedFavorites() {
    try {
      const products = await this.cjMainService.getImportedProducts({ isFavorite: true });
      return products;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération produits favoris: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      return [];
    }
  }

  @Get('stats/products')
  @ApiOperation({ summary: 'Statistiques des produits' })
  @ApiResponse({ status: 200, description: 'Statistiques produits' })
  async getProductStats() {
    return this.cjMainService.getProductStats();
  }

  @Get('stats/orders')
  @ApiOperation({ summary: 'Statistiques des commandes' })
  @ApiResponse({ status: 200, description: 'Statistiques commandes' })
  async getOrderStats() {
    return this.cjMainService.getOrderStats();
  }

  @Get('stats/webhooks')
  @ApiOperation({ summary: 'Statistiques des webhooks' })
  @ApiResponse({ status: 200, description: 'Statistiques webhooks' })
  async getWebhookStats() {
    return this.cjMainService.getWebhookStats();
  }

  @Get('stores/:storeId/products')
  @ApiOperation({ summary: 'Récupérer les produits d\'un magasin CJ depuis la base de données' })
  @ApiResponse({ status: 200, description: 'Produits du magasin récupérés' })
  async getStoreProducts(@Param('storeId') storeId: string, @Query() query: any) {
    try {
      this.logger.log(`🔍 Récupération des produits du magasin ${storeId} depuis la base de données...`);
      
      // Construire les filtres
      const whereClause: any = {};
      
      // Filtre par statut
      if (query.status && query.status !== 'all') {
        whereClause.status = query.status;
      }
      
      // Filtre par catégorie
      if (query.category && query.category !== 'all') {
        whereClause.category = { contains: query.category };
      }
      
      // Filtre par recherche
      if (query.search) {
        whereClause.OR = [
          { name: { contains: query.search } },
          { description: { contains: query.search } },
          { category: { contains: query.search } }
        ];
      }
      
      // Récupérer les produits depuis la base de données
      const products = await this.prisma.cJProductStore.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });
      
      // Récupérer les catégories uniques
      const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
      
      this.logger.log(`✅ ${products.length} produits récupérés depuis la base de données`);
      
      return {
        products: products.map(product => ({
          id: product.id,
          cjProductId: product.cjProductId,
          name: product.name,
          description: product.description || '',
          price: product.price,
          originalPrice: product.originalPrice,
          image: product.image,
          category: product.category,
          status: product.status,
          // ✅ Champs détaillés
          productSku: product.productSku,
          productWeight: product.productWeight,
          packingWeight: product.packingWeight,
          productType: product.productType,
          productUnit: product.productUnit,
          productKeyEn: product.productKeyEn,
          materialNameEn: product.materialNameEn,
          packingNameEn: product.packingNameEn,
          suggestSellPrice: product.suggestSellPrice,
          listedNum: product.listedNum,
          supplierName: product.supplierName,
          createrTime: product.createrTime,
          variants: product.variants,
          reviews: product.reviews,
          dimensions: product.dimensions,
          brand: product.brand,
          tags: product.tags,
          // ✅ Informations de livraison
          deliveryCycle: product.deliveryCycle,
          isFreeShipping: product.isFreeShipping,
          freeShippingCountries: product.freeShippingCountries,
          defaultShippingMethod: product.defaultShippingMethod,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        })),
        categories
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération produits magasin: ${error instanceof Error ? error.message : String(error)}`);
      return {
        products: [],
        categories: []
      };
    }
  }

  // ===== CATÉGORIES =====

  @Get('categories')
  @ApiOperation({ summary: 'Obtenir toutes les catégories CJ' })
  @ApiResponse({ status: 200, description: 'Liste des catégories' })
  async getCategories() {
    return this.cjMainService.getCategories();
  }

  @Get('categories/tree')
  @ApiOperation({ summary: 'Obtenir l\'arbre des catégories CJ' })
  @ApiResponse({ status: 200, description: 'Arbre des catégories' })
  async getCategoriesTree() {
    return this.cjMainService.getCategoriesTree();
  }

  @Post('categories/sync')
  @ApiOperation({ summary: 'Synchroniser les catégories CJ' })
  @ApiResponse({ status: 200, description: 'Synchronisation des catégories effectuée' })
  async syncCategories() {
    return this.cjMainService.syncCategories();
  }

  // ===== CATÉGORIES AVANCÉES =====

  @Get('categories/search')
  @ApiOperation({ summary: 'Recherche avancée de catégories avec filtres et pagination' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche de catégories' })
  async searchCategories(@Query() query: any) {
    this.logger.log('🔍 === DÉBUT CONTROLLER searchCategories ===');
    this.logger.log('📝 Paramètres:', query);
    
    try {
      const result = await this.cjMainService.searchCategories(query);
      this.logger.log('✅ Controller searchCategories terminé avec succès');
      return result;
    } catch (error) {
      this.logger.error('❌ === ERREUR CONTROLLER searchCategories ===');
      this.logger.error('💥 Erreur:', error);
      throw error;
    }
  }

  @Get('categories/popular')
  @ApiOperation({ summary: 'Obtenir les catégories populaires' })
  @ApiResponse({ status: 200, description: 'Liste des catégories populaires' })
  async getPopularCategories(@Query('limit') limit?: number) {
    this.logger.log(`🔥 Récupération des catégories populaires (limit: ${limit || 10})`);
    
    try {
      const result = await this.cjMainService.getPopularCategories(limit || 10);
      this.logger.log('✅ Catégories populaires récupérées');
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur catégories populaires:', error);
      throw error;
    }
  }

  @Get('categories/:parentId/subcategories')
  @ApiOperation({ summary: 'Obtenir les sous-catégories d\'une catégorie parent' })
  @ApiResponse({ status: 200, description: 'Liste des sous-catégories' })
  async getSubCategories(@Param('parentId') parentId: string) {
    this.logger.log(`📂 Récupération des sous-catégories pour ${parentId}`);
    
    try {
      const result = await this.cjMainService.getSubCategories(parentId);
      this.logger.log('✅ Sous-catégories récupérées');
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur sous-catégories:', error);
      throw error;
    }
  }

  @Get('categories/:categoryId/path')
  @ApiOperation({ summary: 'Obtenir le chemin complet d\'une catégorie (breadcrumb)' })
  @ApiResponse({ status: 200, description: 'Chemin de la catégorie' })
  async getCategoryPath(@Param('categoryId') categoryId: string) {
    this.logger.log(`🗂️ Récupération du chemin pour la catégorie ${categoryId}`);
    
    try {
      const result = await this.cjMainService.getCategoryPath(categoryId);
      this.logger.log('✅ Chemin de catégorie récupéré');
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur chemin catégorie:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRODUCT SOURCING ENDPOINTS
  // ============================================================================

  /**
   * Créer une demande de sourcing
   * POST /api/cj-dropshipping/sourcing
   */
  @Post('sourcing')
  @ApiOperation({ summary: 'Créer une demande de sourcing produit' })
  @ApiResponse({ status: 200, description: 'Demande de sourcing créée avec succès' })
  async createSourcingRequest(@Body() data: CJSourcingCreateRequest) {
    this.logger.log(`📡 === ENDPOINT CREATE SOURCING ===`);
    this.logger.log(`📦 Produit: ${data.productName}`);
    
    try {
      const result = await this.cjMainService.cjSourcingService.createSourcingRequest(data);
      
      return {
        success: true,
        message: 'Demande de sourcing créée avec succès',
        data: result
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur création sourcing:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur création demande sourcing',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupérer toutes les demandes
   * GET /api/cj-dropshipping/sourcing
   */
  @Get('sourcing')
  @ApiOperation({ summary: 'Récupérer toutes les demandes de sourcing' })
  @ApiResponse({ status: 200, description: 'Liste des demandes de sourcing' })
  async getAllSourcingRequests() {
    this.logger.log(`📡 Récupération toutes les demandes sourcing`);
    
    try {
      const requests = await this.cjMainService.cjSourcingService.getAllRequests();
      
      return {
        success: true,
        data: requests,
        total: requests.length
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur récupération demandes:', error);
      throw new HttpException(
        'Erreur récupération demandes',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupérer les demandes en attente
   * GET /api/cj-dropshipping/sourcing/pending
   */
  @Get('sourcing/pending')
  @ApiOperation({ summary: 'Récupérer les demandes de sourcing en attente' })
  @ApiResponse({ status: 200, description: 'Liste des demandes en attente' })
  async getPendingSourcingRequests() {
    this.logger.log(`📡 Récupération demandes en attente`);
    
    try {
      const requests = await this.cjMainService.cjSourcingService.getPendingRequests();
      
      return {
        success: true,
        data: requests,
        total: requests.length
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur récupération demandes en attente:', error);
      throw new HttpException(
        'Erreur récupération demandes en attente',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Mettre à jour le statut d'une demande
   * POST /api/cj-dropshipping/sourcing/:id/update-status
   */
  @Post('sourcing/:id/update-status')
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une demande de sourcing' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  async updateSourcingStatus(@Param('id') id: string) {
    this.logger.log(`📡 Mise à jour statut: ${id}`);
    
    try {
      const result = await this.cjMainService.cjSourcingService.updateRequestStatus(id);
      
      return {
        success: true,
        message: result.statusChanged ? 'Statut mis à jour' : 'Aucun changement',
        data: result
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur mise à jour statut:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur mise à jour statut',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Mettre à jour toutes les demandes en attente
   * POST /api/cj-dropshipping/sourcing/update-all
   */
  @Post('sourcing/update-all')
  @ApiOperation({ summary: 'Mettre à jour toutes les demandes de sourcing en attente' })
  @ApiResponse({ status: 200, description: 'Mise à jour globale effectuée' })
  async updateAllPendingSourcing() {
    this.logger.log(`📡 Mise à jour toutes les demandes en attente`);
    
    try {
      const result = await this.cjMainService.cjSourcingService.updateAllPendingRequests();
      
      return {
        success: true,
        message: `${result.updated} demandes mises à jour, ${result.found} produits trouvés`,
        data: result
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur mise à jour globale:', error);
      throw new HttpException(
        'Erreur mise à jour globale',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Marquer comme importé
   * POST /api/cj-dropshipping/sourcing/:id/mark-imported
   */
  @Post('sourcing/:id/mark-imported')
  @ApiOperation({ summary: 'Marquer une demande de sourcing comme importée' })
  @ApiResponse({ status: 200, description: 'Demande marquée comme importée' })
  async markSourcingAsImported(
    @Param('id') id: string,
    @Body('importedProductId') importedProductId: string
  ) {
    this.logger.log(`📡 Marquer comme importé: ${id}`);
    
    try {
      const result = await this.cjMainService.cjSourcingService.markAsImported(id, importedProductId);
      
      return {
        success: true,
        message: 'Demande marquée comme importée',
        data: result
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur marquage importé:', error);
      throw new HttpException(
        'Erreur marquage importé',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('migrate-variants')
  @ApiOperation({ summary: 'Migrer les variants JSON vers la table ProductVariant pour tous les produits CJ' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Forcer la recréation même si les variants existent' })
  @ApiResponse({ status: 200, description: 'Migration effectuée avec succès' })
  async migrateVariants(@Query('force') force?: string) {
    try {
      const forceRecreate = force === 'true';
      this.logger.log(`🔄 Démarrage migration variants JSON → ProductVariant (force: ${forceRecreate})...`);
      const result = await this.cjProductService.migrateAllVariantsToDatabase(forceRecreate);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error('❌ Erreur migration variants:', error);
      throw new HttpException(
        'Erreur lors de la migration des variants',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('stores/sync-stocks')
  @ApiOperation({ summary: 'Synchroniser les stocks de tous les produits du magasin CJ depuis l\'API' })
  @ApiResponse({ status: 200, description: 'Stocks synchronisés avec succès' })
  async syncStoreStocks() {
    try {
      this.logger.log('🔄 Synchronisation des stocks du magasin CJ...');
      const result = await this.cjMainService.syncStoreStocks();
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur synchronisation stocks:', error);
      throw new HttpException(
        'Erreur lors de la synchronisation des stocks',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

