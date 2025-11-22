import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios, { AxiosInstance } from 'axios';
import { 
  CJProductSearchOptions, 
  CJProductSearchResult,
  CJProduct,
  CJVariant,
  CJVariantStock,
  CJProductInventoryResponse,
  CJReview,
  CJReviewsResponse,
  mapCJReview
} from './interfaces/cj-product.interface';
import {
  CJSourcingCreateRequest,
  CJSourcingCreateResponse,
  CJSourcingQueryRequest,
  CJSourcingQueryResponse,
  CJSourcingDetails
} from './interfaces/cj-sourcing.interface';

export class CJAPIError extends Error {
  constructor(
    public code: number,
    message: string,
    public requestId?: string
  ) {
    super(message);
    this.name = 'CJAPIError';
  }
}

export interface CJConfig {
  email: string;
  apiKey: string;
  tier?: 'free' | 'plus' | 'prime' | 'advanced';
  platformToken?: string;
  debug?: boolean;
}

export interface CJResponse<T = any> {
  code: number;
  result: boolean;
  message: string;
  data: T;
  requestId?: string;
}

// Interfaces CJProduct, CJVariant, CJReview sont maintenant importées depuis './interfaces/cj-product.interface'

export interface CJOrder {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  totalAmount: number;
  shippingAddress: any;
  products: any[];
  trackNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CJFreightOption {
  logisticName: string;
  shippingTime: string;
  freight: number;
  currency: string;
}

@Injectable()
export class CJAPIClient {
  private readonly logger = new Logger(CJAPIClient.name);
  private readonly baseURL = 'https://developers.cjdropshipping.com/api2.0/v1';
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private lastRequestTime = 0;
  private requestCount = 0;
  private rateLimitResetTime = 0;
  private config: CJConfig | null = null;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue: boolean = false;
  public tier: 'free' | 'plus' | 'prime' | 'advanced' = 'free';
  
  // Verrou global partagé entre toutes les instances pour garantir 1 requête/seconde
  private static globalLastRequestTime = 0;
  private static globalRequestLock = false;
  private static readonly MIN_INTERVAL = 1500; // ✅ 1.5 secondes minimum entre requêtes (sécurité)
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly enableVerboseLogs = process.env.CJ_VERBOSE_LOGS === 'true'; // Optionnel pour debug

  constructor(
    private configService: ConfigService,
    private prisma?: PrismaService
  ) {
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KAMRI-CJ-Client/1.0',
      },
    });

    // Intercepteur pour gérer les erreurs
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.data) {
          const { code, message, requestId } = error.response.data;
          throw new CJAPIError(code, message, requestId);
        }
        throw error;
      }
    );
  }

  /**
   * Initialiser la configuration CJ
   */
  setConfig(config: CJConfig): void {
    this.config = config;
    this.tier = config.tier || 'free';
    this.logger.log(`Configuration CJ mise à jour - Niveau: ${this.tier}`);
  }

  /**
   * Vérifier si la configuration est disponible
   */
  private checkConfig(): void {
    if (!this.config) {
      throw new Error('Configuration CJ Dropshipping non initialisée');
    }
  }

  /**
   * Charger le token depuis la base de données
   */
  async loadTokenFromDatabase(): Promise<boolean> {
    if (!this.prisma) {
      return false;
    }
    try {
      const config = await this.prisma.cJConfig.findFirst();
      if (!config) {
        return false;
      }

      if (config.accessToken && config.refreshToken && config.tokenExpiry) {
        const expiryDate = new Date(config.tokenExpiry);
        // Vérifier si le token est encore valide (avec une marge de 1 heure)
        if (new Date() < new Date(expiryDate.getTime() - 60 * 60 * 1000)) {
          this.accessToken = config.accessToken;
          this.refreshToken = config.refreshToken;
          this.tokenExpiry = expiryDate;
          this.logger.log('✅ Token chargé depuis la base de données (valide jusqu\'à ' + expiryDate.toISOString() + ')');
          return true;
        } else {
          this.logger.log('⚠️ Token en base de données expiré, nouveau login requis');
          return false;
        }
      }
      return false;
    } catch (error) {
      this.logger.error('Erreur lors du chargement du token depuis la base de données:', error);
      return false;
    }
  }

  /**
   * Sauvegarder le token dans la base de données
   */
  private async saveTokenToDatabase(): Promise<void> {
    if (!this.prisma) {
      this.logger.warn('⚠️ PrismaService non disponible, impossible de sauvegarder le token');
      return;
    }
    try {
      const config = await this.prisma.cJConfig.findFirst();
      if (!config) {
        this.logger.warn('⚠️ Aucune configuration CJ trouvée pour sauvegarder le token');
        return;
      }

      await this.prisma.cJConfig.update({
        where: { id: config.id },
        data: {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          tokenExpiry: this.tokenExpiry,
          updatedAt: new Date()
        }
      });
      this.logger.log('✅ Token sauvegardé dans la base de données');
    } catch (error) {
      this.logger.error('Erreur lors de la sauvegarde du token dans la base de données:', error);
      // Ne pas bloquer si la sauvegarde échoue
    }
  }

  /**
   * Authentification avec l'API CJ
   */
  async login(): Promise<void> {
    try {
      this.checkConfig();
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug('🔐 Authentification CJ...');
      }
      this.logger.log('Config:', JSON.stringify(this.config, null, 2));
      
      const response = await this.axiosInstance.post('/authentication/getAccessToken', {
        email: this.config!.email,
        apiKey: this.config!.apiKey,
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      this.logger.log('Response:', JSON.stringify(response.data, null, 2));
      const { data } = response.data;
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.tokenExpiry = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 jours

      // ✅ Sauvegarder le token dans la base de données
      await this.saveTokenToDatabase();

      this.logger.log('✅ Authentification réussie et token sauvegardé');
    } catch (error) {
      this.logger.error('❌ Erreur d\'authentification:', error);
      throw error;
    }
  }

  /**
   * Rafraîchir le token d'accès
   */
  /**
   * ✅ Calcule le délai optimal basé sur le niveau utilisateur (augmenté pour sécurité)
   */
  private getOptimalDelay(): number {
    const tier = this.tier || 'free';
    
    // ✅ Délais augmentés pour éviter de dépasser les limites
    switch (tier) {
      case 'free':
        return 0; // Pas de délai supplémentaire, le MIN_INTERVAL (1.5s) suffit
      case 'plus':
        return 200;  // 0.2s supplémentaire pour Plus
      case 'prime':
        return 100;  // 0.1s supplémentaire pour Prime
      case 'advanced':
        return 50;   // 0.05s supplémentaire pour Advanced
      default:
        return 0; // Par défaut, pas de délai supplémentaire
    }
  }

  /**
   * ✅ Calcule le délai de retry après rate limit (augmenté pour sécurité)
   */
  private getRetryDelay(): number {
    const tier = this.tier || 'free';
    
    // ✅ Délais de retry augmentés pour éviter les erreurs répétées
    switch (tier) {
      case 'free':
        return 20000; // ✅ 20s pour Free (au lieu de 15s)
      case 'plus':
        return 10000; // 10s pour Plus
      case 'prime':
        return 8000;  // 8s pour Prime
      case 'advanced':
        return 5000;  // 5s pour Advanced
      default:
        return 15000; // Par défaut, Free
    }
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      // ✅ Essayer de charger le refresh token depuis la base de données
      if (!this.prisma) {
        throw new Error('Aucun refresh token disponible et PrismaService non disponible');
      }
      const config = await this.prisma.cJConfig.findFirst();
      if (config?.refreshToken) {
        this.refreshToken = config.refreshToken;
        this.logger.log('✅ Refresh token chargé depuis la base de données');
      } else {
        throw new Error('Aucun refresh token disponible');
      }
    }

    try {
      this.logger.log('🔄 Rafraîchissement du token...');
      
      const response = await this.axiosInstance.post('/authentication/refreshAccessToken', {
        refreshToken: this.refreshToken,
      });

      const { data } = response.data;
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.tokenExpiry = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

      // ✅ Sauvegarder le token rafraîchi dans la base de données
      await this.saveTokenToDatabase();

      this.logger.log('✅ Token rafraîchi avec succès et sauvegardé');
    } catch (error) {
      this.logger.error('❌ Erreur de rafraîchissement du token:', error);
      // Si le refresh échoue, on relogin (dernier recours)
      this.logger.log('🔄 Tentative de login...');
      await this.login();
    }
  }

  /**
   * Gérer la queue des requêtes pour éviter les requêtes simultanées
   */
  private async processRequestQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        // Attendre entre chaque requête
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Gérer le rate limiting selon le tier avec verrou global
   */
  private async handleRateLimit(): Promise<void> {
    // Attendre que le verrou soit libéré
    while (CJAPIClient.globalRequestLock) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Acquérir le verrou
    CJAPIClient.globalRequestLock = true;
    
    try {
      const now = Date.now();
      const timeSinceLastRequest = now - CJAPIClient.globalLastRequestTime;
      
      // ✅ Toujours respecter un minimum de 1.5 secondes entre requêtes
      // pour garantir qu'on ne dépasse jamais la limite de 1 req/s
      const minInterval = CJAPIClient.MIN_INTERVAL;

      if (timeSinceLastRequest < minInterval) {
        const waitTime = minInterval - timeSinceLastRequest;
        // ✅ Log uniquement en dev ou si verbose activé
        if (!this.isProduction || this.enableVerboseLogs) {
          this.logger.debug(`⏳ Rate limiting: attente ${waitTime}ms`);
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      CJAPIClient.globalLastRequestTime = Date.now();
      this.lastRequestTime = Date.now();
    } finally {
      // Libérer le verrou après un court délai pour garantir l'intervalle minimum
      setTimeout(() => {
        CJAPIClient.globalRequestLock = false;
      }, 100);
    }
  }

  /**
   * Effectuer une requête avec gestion automatique des tokens et rate limiting
   */
  public async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<CJResponse<T>> {
    // ✅ Logs verbeux uniquement en dev ou si explicitement activé
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug(`🔍 ${method} ${endpoint}`);
    }
    
    // Attendre que la queue soit vide avant de faire une nouvelle requête
    while (this.isProcessingQueue) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Gérer le rate limiting avec verrou global (garantit 1 requête/seconde max)
    await this.handleRateLimit();

    // ✅ Vérifier et charger le token depuis la base de données si nécessaire
    if (!this.accessToken || (this.tokenExpiry && new Date() >= this.tokenExpiry)) {
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug('🔄 Token expiré, rafraîchissement...');
      }
      
      // Essayer de charger depuis la base de données
      const loaded = await this.loadTokenFromDatabase();
      
      if (!loaded) {
        // Si le token n'est pas en base ou est expiré, essayer de le rafraîchir
        await this.refreshAccessToken();
      }
    }

    const headers: any = {
      'CJ-Access-Token': this.accessToken,
    };

    if (this.config.platformToken) {
      headers['platformToken'] = this.config.platformToken;
    }

    try {
      // ✅ Pour les requêtes GET, utiliser params au lieu de data pour les query parameters
      const requestConfig: any = {
        method,
        url: endpoint,
        headers,
      };
      
      if (method === 'GET' && data) {
        requestConfig.params = data;
      } else if (method !== 'GET' && data) {
        requestConfig.data = data;
      }
      
      const response = await this.axiosInstance.request(requestConfig);

      // ✅ Logs de succès uniquement en dev
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug(`✅ ${method} ${endpoint} - ${response.status}`);
      }
      
      // ✅ PAUSE INTELLIGENTE basée sur le niveau utilisateur
      const delay = this.getOptimalDelay();
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return response.data;
    } catch (error) {
      // ✅ Gérer l'erreur 429 (Too Many Requests) avec retry silencieux
      if (error instanceof CJAPIError && (error.code === 429 || error.code === 1600200)) {
        const retryDelay = this.getRetryDelay();
        // ✅ Log uniquement en dev ou si verbose activé
        if (!this.isProduction || this.enableVerboseLogs) {
          this.logger.warn(`⏳ Rate limit atteint, retry dans ${retryDelay}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        try {
          // ✅ Réappliquer le rate limiting avant le retry
          await this.handleRateLimit();
          
          const retryConfig: any = {
            method,
            url: endpoint,
            headers: {
              'CJ-Access-Token': this.accessToken,
              ...(this.config.platformToken && { platformToken: this.config.platformToken }),
            },
          };
          
          if (method === 'GET' && data) {
            retryConfig.params = data;
          } else if (method !== 'GET' && data) {
            retryConfig.data = data;
          }
          
          const retryResponse = await this.axiosInstance.request(retryConfig);
          if (!this.isProduction || this.enableVerboseLogs) {
            this.logger.debug('✅ Retry réussi');
          }
          return retryResponse.data;
        } catch (retryError) {
          // ✅ Log uniquement les erreurs critiques
          this.logger.error(`❌ Erreur CJ API (${endpoint}): ${retryError instanceof Error ? retryError.message : String(retryError)}`);
          throw retryError;
        }
      }
      
      // ✅ Log uniquement les erreurs critiques (pas d'authentification)
      if (!(error instanceof CJAPIError && (error.code === 401 || error.code === 1600001 || error.code === 1600003))) {
        this.logger.error(`❌ Erreur CJ API (${endpoint}): ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Gestion des erreurs d'authentification
      if (error instanceof CJAPIError && (error.code === 401 || error.code === 1600001 || error.code === 1600003)) {
        if (!this.isProduction || this.enableVerboseLogs) {
          this.logger.debug(`🔑 Auth error (${error.code}), refresh token...`);
        }
        await this.refreshAccessToken();
        
        // ✅ Réappliquer le rate limiting avant le retry
        await this.handleRateLimit();
        
        // Retry avec le nouveau token
        const retryConfig: any = {
          method,
          url: endpoint,
          headers: {
            'CJ-Access-Token': this.accessToken,
            ...(this.config.platformToken && { platformToken: this.config.platformToken }),
          },
        };
        
        if (method === 'GET' && data) {
          retryConfig.params = data;
        } else if (method !== 'GET' && data) {
          retryConfig.data = data;
        }
        
        const retryResponse = await this.axiosInstance.request(retryConfig);

        return retryResponse.data;
      }
      throw error;
    }
  }

  /**
   * Obtenir les paramètres du compte
   */
  async getSettings(): Promise<any> {
    return this.makeRequest('GET', '/user/settings');
  }

  /**
   * Obtenir le solde du compte
   */
  async getBalance(): Promise<any> {
    return this.makeRequest('GET', '/user/balance');
  }

  /**
   * Rechercher des produits (API V2 avec Elasticsearch)
   * @param keyword Mot-clé de recherche
   * @param options Options de recherche
   */
  async searchProducts(
    keyword?: string,
    options: CJProductSearchOptions = {}
  ): Promise<CJProductSearchResult> {
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug('🔍 searchProducts (V2)');
      this.logger.debug('📝 Paramètres:', { keyword, page: options.page || options.pageNum });
    }
    
    try {
      await this.handleRateLimit();

      // ✅ Construction des paramètres pour V2
      const requestParams: any = {
        page: options.page || options.pageNum || 1,                           // ✅ V2 utilise "page" au lieu de "pageNum"
        size: Math.min(options.size || options.pageSize || 10, 100),           // ✅ V2 limite à 100 maximum (pas 200)
      };

      // ✅ V2 utilise "keyWord" au lieu de "productName" + "productNameEn"
      // Priorité : options.keyWord > keyword (premier paramètre)
      if (options.keyWord) {
        requestParams.keyWord = options.keyWord;
      } else if (keyword) {
        requestParams.keyWord = keyword;
      }

      // Filtres de base
      if (options.categoryId) requestParams.categoryId = options.categoryId;
      if (options.lv2categoryList && options.lv2categoryList.length > 0) requestParams.lv2categoryList = options.lv2categoryList; // ✅ NOUVEAU
      if (options.lv3categoryList && options.lv3categoryList.length > 0) requestParams.lv3categoryList = options.lv3categoryList; // ✅ NOUVEAU
      if (options.countryCode) requestParams.countryCode = options.countryCode;
      
      // Plage de prix (noms V2)
      if (options.minPrice !== undefined) requestParams.startSellPrice = options.minPrice; // ✅ V2 utilise "startSellPrice"
      if (options.maxPrice !== undefined) requestParams.endSellPrice = options.maxPrice;   // ✅ V2 utilise "endSellPrice"
      
      // Plage d'inventaire (noms V2)
      if (options.startInventory !== undefined) requestParams.startWarehouseInventory = options.startInventory; // ✅ V2
      if (options.endInventory !== undefined) requestParams.endWarehouseInventory = options.endInventory;       // ✅ V2

      // Type de produit
      if (options.productType !== undefined) requestParams.productType = options.productType;
      
      // ✅ NOUVEAU : Product Flag (V2)
      if (options.productFlag !== undefined) requestParams.productFlag = options.productFlag;
      // 0=Trending, 1=New, 2=Video, 3=Slow-moving
      
      // Livraison
      if (options.isFreeShipping !== undefined) requestParams.addMarkStatus = options.isFreeShipping; // ✅ V2 utilise "addMarkStatus"
      if (options.isSelfPickup !== undefined) requestParams.isSelfPickup = options.isSelfPickup;
      
      // Entrepôt vérifié
      if (options.verifiedWarehouse !== undefined) requestParams.verifiedWarehouse = options.verifiedWarehouse;
      
      // ✅ NOUVEAU : Zone Platform (V2)
      if (options.zonePlatform) requestParams.zonePlatform = options.zonePlatform;
      // Ex: "shopify", "ebay", "amazon", "tiktok", "etsy"
      
      // ✅ NOUVEAU : Is Warehouse (V2)
      if (options.isWarehouse !== undefined) requestParams.isWarehouse = options.isWarehouse;
      
      // ✅ NOUVEAU : Currency (V2)
      if (options.currency) requestParams.currency = options.currency;
      // Ex: "USD", "AUD", "EUR"
      
      // ✅ NOUVEAU : Has Certification (V2)
      if (options.hasCertification !== undefined) requestParams.hasCertification = options.hasCertification;
      
      // ✅ NOUVEAU : Customization (V2)
      if (options.customization !== undefined) requestParams.customization = options.customization;
      
      // Filtres de temps
      if (options.timeStart !== undefined) requestParams.timeStart = options.timeStart;
      if (options.timeEnd !== undefined) requestParams.timeEnd = options.timeEnd;
      
      // Tri (noms V2)
      if (options.sort) requestParams.sort = options.sort;           // desc/asc
      if (options.orderBy !== undefined) requestParams.orderBy = options.orderBy; // ✅ V2 utilise des nombres
      // 0=best match, 1=listing count, 2=sell price, 3=create time, 4=inventory
      
      // ✅ NOUVEAU : Features (V2) - Retour sélectif
      if (options.features && options.features.length > 0) {
        requestParams.features = options.features;
      }
      // Ex: ['enable_description', 'enable_category', 'enable_video']
      
      // Supplier
      if (options.supplierId) requestParams.supplierId = options.supplierId;

      // Construction de l'URL
      const queryString = new URLSearchParams();
      Object.entries(requestParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            // Pour les tableaux (lv2categoryList, lv3categoryList, features)
            value.forEach(item => queryString.append(key, String(item)));
          } else {
            queryString.append(key, String(value));
          }
        }
      });

      // ✅ V2 endpoint
      const endpoint = `/product/listV2?${queryString.toString()}`;
      
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug(`📡 ${endpoint}`);
      }

      const response = await this.makeRequest('GET', endpoint);

      if (response && response.code === 200 && response.data) {
        // ✅ Parser la réponse V2 (structure différente)
        const data = response.data as any;
        
        if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
          return {
            products: [],
            total: 0,
            pageNumber: requestParams.page,
            pageSize: requestParams.size,
            totalPages: 0,
            relatedCategories: [],
            warehouses: []
          };
        }

        const contentData = data.content[0]; // Premier élément du content array
        
        // ✅ MAPPER les produits V2 vers le format attendu (V1 compatible)
        const mappedProducts = (contentData.productList || []).map((product: any) => {
          // Normaliser l'image : V2 utilise "bigImage", V1 utilise "productImage"
          let productImage = product.productImage || product.bigImage || product.image || product.productImageEn || '';
          
          // Si c'est un array, prendre la première image
          if (Array.isArray(productImage)) {
            productImage = productImage.length > 0 ? productImage[0] : '';
          }
          // Si c'est une string JSON, parser
          else if (typeof productImage === 'string' && productImage.startsWith('[')) {
            try {
              const parsed = JSON.parse(productImage);
              if (Array.isArray(parsed) && parsed.length > 0) {
                productImage = parsed[0];
              } else {
                productImage = '';
              }
            } catch (e) {
              // Si le parsing échoue, garder la valeur originale si c'est une URL valide
              if (!productImage.startsWith('http')) {
                productImage = '';
              }
            }
          }
          
          return {
            ...product,
            // ✅ Mapper les champs V2 → V1 pour compatibilité
            pid: product.id || product.pid || '',                           // id → pid
            productId: product.id || product.pid || '',                     // id → productId (compatibilité)
            productName: product.name || product.productName || product.nameEn || product.productNameEn || '',
            productNameEn: product.nameEn || product.productNameEn || product.name || product.productName || '',   // nameEn → productNameEn
            productImage: productImage || '',                               // bigImage → productImage ✅
            productSku: product.sku || product.productSku || '',           // sku → productSku
            sellPrice: parseFloat(product.sellPrice) || parseFloat(product.nowPrice) || parseFloat(product.price) || 0,
            // Garder aussi les nouveaux champs V2
            bigImage: product.bigImage || productImage,
            nameEn: product.nameEn,
            sku: product.sku,
            nowPrice: product.nowPrice,
            discountPrice: product.discountPrice,
            discountPriceRate: product.discountPriceRate,
            // Catégories V2
            categoryId: product.categoryId || product.threeCategoryId,
            categoryName: product.categoryName || product.threeCategoryName || product.category || '',
            oneCategoryId: product.oneCategoryId,
            oneCategoryName: product.oneCategoryName,
            twoCategoryId: product.twoCategoryId,
            twoCategoryName: product.twoCategoryName,
            threeCategoryId: product.threeCategoryId,
            threeCategoryName: product.threeCategoryName,
            // Autres champs V2
            listedNum: product.listedNum,
            addMarkStatus: product.addMarkStatus,
            isVideo: product.isVideo,
            videoList: product.videoList || [],
            productType: product.productType,
            supplierName: product.supplierName,
            createAt: product.createAt,
            warehouseInventoryNum: product.warehouseInventoryNum,
            verifiedWarehouse: product.verifiedWarehouse,
            customization: product.customization,
            hasCECertification: product.hasCECertification,
            isCollect: product.isCollect,
            myProduct: product.myProduct,
            currency: product.currency,
            description: product.description || '',
            deliveryCycle: product.deliveryCycle,
            // Champs V1 pour compatibilité
            variants: product.variants || [],
            weight: product.weight || product.productWeight || 0,
            dimensions: product.dimensions || '',
            brand: product.brand || '',
            tags: product.tags || [],
            reviews: product.reviews || [],
            rating: product.rating || 0,
            totalReviews: product.totalReviews || 0
          };
        });
        
        return {
          products: mappedProducts,  // ✅ Utiliser les produits mappés
          total: data.totalRecords || 0,
          pageNumber: data.pageNumber || requestParams.page,
          pageSize: data.pageSize || requestParams.size,
          totalPages: data.totalPages || 0,
          relatedCategories: contentData.relatedCategoryList || [],
          warehouses: contentData.storeList || [],
          keyWord: contentData.keyWord || keyword || options.keyWord,
          searchHit: contentData.searchHit || ''
        };
      }

      return {
        products: [],
        total: 0,
        pageNumber: requestParams.page,
        pageSize: requestParams.size,
        totalPages: 0
      };

    } catch (error: any) {
      this.logger.error('❌ Erreur recherche produits (V2):', error);
      
      // Gestion d'erreurs spécifique V2
      if (error.code === 429 || error.code === 1600200) {
        const retryDelay = this.getRetryDelay();
        this.logger.warn(`⏳ Rate limit atteint, retry dans ${retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.searchProducts(keyword, options);
      }

      if (error.code === 401 || error.code === 1600001) {
        this.logger.warn('🔄 Token expiré, rafraîchissement...');
        await this.refreshAccessToken();
        return this.searchProducts(keyword, options);
      }

      throw error;
    }
  }

  /**
   * Obtenir les détails complets d'un produit (selon doc CJ - endpoint /product/detail/{pid})
   */
  async getProductDetails(pid: string, includeVideo: boolean = true): Promise<CJProduct> {
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug('🔍 getProductDetails');
    }
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug(`📝 PID: ${pid}`);
    }
    
    try {
      // ✅ Utiliser l'endpoint /product/query qui fonctionne (pas /product/detail qui n'existe pas)
      // ✅ Ajouter features=enable_video pour récupérer les vidéos si nécessaire
      let endpoint = `/product/query?pid=${pid}`;
      if (includeVideo) {
        endpoint += '&features=enable_video';
      }
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug(`🌐 ${endpoint}`);
      }
      
      const response = await this.makeRequest('GET', endpoint);
      
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug('✅ Réponse API CJ reçue');
      }
      
      // Vérifier si l'API retourne une erreur
      if (response.code !== 200 || !response.result) {
        this.logger.error(`❌ API CJ a retourné une erreur: code=${response.code}, result=${response.result}, message=${response.message}`);
        throw new Error(response.message || `Produit ${pid} non trouvé dans l'API CJ (code: ${response.code})`);
      }
      
      // Vérifier si data est null ou undefined
      if (response.data === null || response.data === undefined) {
        this.logger.error(`❌ API CJ a retourné data null/undefined pour PID ${pid}`);
        throw new Error(`Produit ${pid} non trouvé dans l'API CJ Dropshipping`);
      }
      
      const result = response.data as any;
      
      // Vérifier si le résultat a un pid
      if (!result.pid && !result.productId) {
        this.logger.error(`❌ Produit retourné sans pid/productId`);
        throw new Error(`Structure de produit invalide retournée par l'API CJ pour ${pid}`);
      }
      
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug(`✅ Produit: ${result.productNameEn || result.productName}`);
        if (result.variants) {
          this.logger.debug(`📦 ${result.variants.length} variants`);
        }
      }
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug('✅ getProductDetails terminé');
      }
      
      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur getProductDetails (${pid}): ${error instanceof Error ? error.message : String(error)}`);
      // Log déjà fait dans le catch, pas besoin de log supplémentaire
      throw error;
    }
  }

  /**
   * Obtenir les variantes d'un produit
   */
  async getProductVariants(pid: string): Promise<CJVariant[]> {
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug(`🔍 Récupération variants pour ${pid}`);
    }
    const response = await this.makeRequest('GET', `/product/variant/query`, { params: { pid } });
    
    // makeRequest retourne response.data directement, qui peut être :
    // - La structure CJ complète : { code, result, message, data }
    // - Directement les données si déjà parsées
    
    let variants: CJVariant[] = [];
    
    // Vérifier si c'est la structure CJ complète
    if (response && typeof response === 'object' && 'code' in response) {
      // Structure CJ : { code, result, message, data }
      const cjResponse = response as CJResponse<any>;
      if (cjResponse.code === 200 && cjResponse.data) {
        const data = cjResponse.data as any;
        if (Array.isArray(data)) {
          variants = data as CJVariant[];
        } else if (data && typeof data === 'object' && 'list' in data && Array.isArray(data.list)) {
          variants = data.list as CJVariant[];
        } else if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
          variants = data.data as CJVariant[];
        } else if (data && typeof data === 'object' && 'vid' in data) {
          // Si c'est un seul variant, le mettre dans un tableau
          variants = [data as CJVariant];
        }
      }
    } else if (Array.isArray(response)) {
      // Si la réponse est directement un tableau
      variants = response as CJVariant[];
    } else if (response && typeof response === 'object') {
      const responseObj = response as any;
      if (Array.isArray(responseObj.list)) {
        // Si la réponse a une propriété list
        variants = responseObj.list as CJVariant[];
      } else if (Array.isArray(responseObj.data)) {
        // Si la réponse a une propriété data qui est un tableau
        variants = responseObj.data as CJVariant[];
      }
    }
    
    this.logger.log(`✅ ${variants.length} variant(s) récupéré(s) pour produit ${pid}`);
    if (variants.length > 0) {
      this.logger.log(`📋 VIDs trouvés: ${variants.slice(0, 5).map((v: any) => v.vid || v.variantId).join(', ')}${variants.length > 5 ? '...' : ''}`);
    }
    
    return variants;
  }

  /**
   * Obtenir les détails d'un variant par son VID (endpoint 2.2)
   * @param vid Variant ID
   */
  async getVariantById(vid: string): Promise<CJVariant> {
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug(`🔍 Récupération variant ${vid}`);
    }
    
    try {
      await this.handleRateLimit();
      
      const endpoint = `/product/variant/queryByVid?vid=${vid}`;
      const response = await this.makeRequest('GET', endpoint);
      
      if (response && response.code === 200 && response.data) {
        this.logger.log(`✅ Variant ${vid} récupéré`);
        return response.data as CJVariant;
      }
      
      throw new Error(`Variant ${vid} introuvable`);
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération variant ${vid}:`, error);
      throw error;
    }
  }

  /**
   * Obtenir le stock d'un variant par son VID (endpoint 3.1)
   * @param vid Variant ID
   * @returns Stock par entrepôt
   */
  async getVariantStock(vid: string): Promise<CJVariantStock[]> {
    this.logger.log(`📦 Récupération stock variant: ${vid}`);
    
    try {
      await this.handleRateLimit();
      
      const endpoint = `/product/stock/queryByVid?vid=${vid}`;
      const response = await this.makeRequest('GET', endpoint);
      
      if (response && response.code === 200 && response.data) {
        const stocks = Array.isArray(response.data) ? response.data : [];
        
        // Calculer le stock total
        const totalStock = stocks.reduce(
          (sum, stock) => sum + (stock.totalInventoryNum || stock.storageNum || 0), 
          0
        );
        
        this.logger.log(`✅ Stock variant ${vid}: ${totalStock} unités dans ${stocks.length} entrepôts`);
        
        return stocks;
      }
      
      return [];
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération stock variant ${vid}:`, error);
      return [];
    }
  }

  /**
   * Obtenir le stock d'un produit par SKU (endpoint 3.2)
   * @param sku SKU du produit ou variant
   * @returns Stock par entrepôt
   */
  async getProductStockBySku(sku: string): Promise<CJVariantStock[]> {
    this.logger.log(`📦 Récupération stock par SKU: ${sku}`);
    
    try {
      await this.handleRateLimit();
      
      const endpoint = `/product/stock/queryBySku?sku=${sku}`;
      const response = await this.makeRequest('GET', endpoint);
      
      if (response && response.code === 200 && response.data) {
        const stocks = Array.isArray(response.data) ? response.data : [];
        
        const totalStock = stocks.reduce(
          (sum, stock) => sum + (stock.totalInventoryNum || 0), 
          0
        );
        
        this.logger.log(`✅ Stock SKU ${sku}: ${totalStock} unités dans ${stocks.length} entrepôts`);
        
        return stocks;
      }
      
      return [];
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération stock SKU ${sku}:`, error);
      return [];
    }
  }

  /**
   * ⚡ MÉTHODE OPTIMISÉE : Obtenir le stock de TOUS les variants d'un produit en 1 requête (endpoint 3.3)
   * @param pid Product ID
   * @returns Map<vid, stock détaillé>
   */
  async getProductInventoryBulk(pid: string): Promise<Map<string, { stock: number; warehouses: CJVariantStock[] }>> {
    this.logger.log(`⚡ === RÉCUPÉRATION STOCK BULK (PID: ${pid}) ===`);
    
    try {
      await this.handleRateLimit();
      
      const endpoint = `/product/stock/getInventoryByPid?pid=${pid}`;
      const response = await this.makeRequest('GET', endpoint);
      
      // ✅ Selon la doc 3.3 : code === 200 ET (result === true OU success dans la réponse brute)
      const hasSuccess = (response as any).success === true || response.result === true;
      if (response && response.code === 200 && hasSuccess && response.data) {
        const data = response.data as CJProductInventoryResponse;
        
        if (!data.variantInventories || data.variantInventories.length === 0) {
          this.logger.warn('⚠️ Aucun stock variant trouvé');
          return new Map();
        }
        
        const stockMap = new Map<string, { stock: number; warehouses: CJVariantStock[] }>();
        
        // Parser les stocks de chaque variant
        for (const variantInv of data.variantInventories) {
          const vid = variantInv.vid;
          
          // Normaliser les noms de champs (3.3 utilise des noms différents)
          const warehouses: CJVariantStock[] = variantInv.inventory.map(inv => ({
            countryCode: inv.countryCode,
            totalInventoryNum: inv.totalInventory,      // ⚠️ Mapping
            cjInventoryNum: inv.cjInventory,            // ⚠️ Mapping
            factoryInventoryNum: inv.factoryInventory,  // ⚠️ Mapping
            totalInventory: inv.totalInventory,
            cjInventory: inv.cjInventory,
            factoryInventory: inv.factoryInventory,
            verifiedWarehouse: inv.verifiedWarehouse
          }));
          
          // Calculer le stock total
          const totalStock = warehouses.reduce(
            (sum, w) => sum + (w.totalInventory || w.totalInventoryNum || 0),
            0
          );
          
          stockMap.set(vid, {
            stock: totalStock,
            warehouses: warehouses
          });
          
          this.logger.log(`  ✅ Variant ${vid}: ${totalStock} en stock`);
        }
        
        this.logger.log(`✅ Stock de ${stockMap.size} variants récupéré en 1 requête`);
        
        return stockMap;
        
      }
      
      return new Map();
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération stock bulk:`, error);
      return new Map();
    }
  }

  /**
   * 3.1 Inventory Inquiry (GET) - Obtenir le stock d'un variant spécifique par VID
   * Endpoint: GET /product/stock/queryByVid?vid={vid}
   * @param vid Variant ID
   * @returns Liste des stocks par entrepôt pour ce variant
   */
  async getInventoryByVid(vid: string): Promise<CJVariantStock[]> {
    this.logger.log(`📦 === RÉCUPÉRATION INVENTAIRE PAR VID (VID: ${vid}) ===`);
    
    try {
      await this.handleRateLimit();
      
      const endpoint = `/product/stock/queryByVid?vid=${vid}`;
      const response = await this.makeRequest('GET', endpoint);
      
      if (response && response.code === 200 && response.result === true && response.data) {
        const data = response.data as any[];
        
        if (!Array.isArray(data) || data.length === 0) {
          this.logger.warn(`⚠️ Aucun stock trouvé pour le variant ${vid}`);
          return [];
        }
        
        // Mapper les données selon la structure de l'API
        const stocks: CJVariantStock[] = data.map((item: any) => ({
          vid: item.vid || vid,
          areaId: item.areaId,
          areaEn: item.areaEn,
          countryCode: item.countryCode,
          totalInventoryNum: item.totalInventoryNum || item.storageNum, // storageNum est déprécié
          cjInventoryNum: item.cjInventoryNum,
          factoryInventoryNum: item.factoryInventoryNum,
          storageNum: item.storageNum // Garder pour compatibilité
        }));
        
        const totalStock = stocks.reduce((sum, s) => sum + (s.totalInventoryNum || 0), 0);
        this.logger.log(`✅ ${stocks.length} entrepôt(s) trouvé(s) pour variant ${vid} - Stock total: ${totalStock}`);
        
        return stocks;
      }
      
      this.logger.warn(`⚠️ Réponse invalide pour variant ${vid}: code=${response?.code}, result=${response?.result}`);
      return [];
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération inventaire par VID ${vid}:`, error);
      return [];
    }
  }

  /**
   * 3.2 Query Inventory by SKU (GET) - Obtenir le stock par SKU
   * Endpoint: GET /product/stock/queryBySku?sku={sku}
   * @param sku SKU ou SPU
   * @returns Liste des stocks par entrepôt pour ce SKU
   */
  async getInventoryBySku(sku: string): Promise<CJVariantStock[]> {
    this.logger.log(`📦 === RÉCUPÉRATION INVENTAIRE PAR SKU (SKU: ${sku}) ===`);
    
    try {
      await this.handleRateLimit();
      
      const endpoint = `/product/stock/queryBySku?sku=${encodeURIComponent(sku)}`;
      const response = await this.makeRequest('GET', endpoint);
      
      if (response && response.code === 200 && response.result === true && response.data) {
        const data = response.data as any[];
        
        if (!Array.isArray(data) || data.length === 0) {
          this.logger.warn(`⚠️ Aucun stock trouvé pour le SKU ${sku}`);
          return [];
        }
        
        // Mapper les données selon la structure de l'API
        const stocks: CJVariantStock[] = data.map((item: any) => ({
          areaId: item.areaId,
          areaEn: item.areaEn,
          countryCode: item.countryCode,
          countryNameEn: item.countryNameEn,
          totalInventoryNum: item.totalInventoryNum,
          cjInventoryNum: item.cjInventoryNum,
          factoryInventoryNum: item.factoryInventoryNum
        }));
        
        const totalStock = stocks.reduce((sum, s) => sum + (s.totalInventoryNum || 0), 0);
        this.logger.log(`✅ ${stocks.length} entrepôt(s) trouvé(s) pour SKU ${sku} - Stock total: ${totalStock}`);
        
        return stocks;
      }
      
      this.logger.warn(`⚠️ Réponse invalide pour SKU ${sku}: code=${response?.code}, result=${response?.result}`);
      return [];
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération inventaire par SKU ${sku}:`, error);
      return [];
    }
  }

  /**
   * Obtenir les variants d'un produit AVEC leur stock (méthode optimisée utilisant bulk)
   * @param pid Product ID
   * @returns Variants enrichis avec stock
   */
  async getProductVariantsWithStock(pid: string): Promise<CJVariant[]> {
    this.logger.log(`📦 === RÉCUPÉRATION VARIANTS AVEC STOCK (PID: ${pid}) ===`);
    
    try {
      // ✅ STRATÉGIE 1 : Utiliser l'endpoint bulk inventory (le plus fiable)
      await this.handleRateLimit();
      const endpoint = `/product/stock/getInventoryByPid?pid=${pid}`;
      const response = await this.makeRequest('GET', endpoint);
      
      // ✅ Selon la doc 3.3 : code === 200 ET (result === true OU success dans la réponse brute)
      const hasSuccess = (response as any).success === true || response.result === true;
      if (response && response.code === 200 && hasSuccess && response.data) {
        const data = response.data as CJProductInventoryResponse;
        
        if (!data.variantInventories || data.variantInventories.length === 0) {
          this.logger.warn('⚠️ Aucun stock variant trouvé via inventory');
          // Fallback sur l'ancienne méthode
          return this.getVariantsWithStockFallback(pid);
        }
        
        // Maintenant récupérer les infos complètes des variants via l'endpoint details (avec vidéos)
        const productDetails = await this.getProductDetails(pid, true); // true = inclure les vidéos
        
        if (!productDetails || !productDetails.variants || productDetails.variants.length === 0) {
          this.logger.warn('⚠️ Détails produit sans variants, utilisation uniquement inventory');
          
          // Construire variants basiques depuis l'inventory
          const variants: CJVariant[] = data.variantInventories.map(variantInv => {
            const totalStock = variantInv.inventory.reduce(
              (sum, inv) => sum + (inv.totalInventory || 0),
              0
            );
            
            return {
              vid: variantInv.vid,
              pid: pid,
              variantSku: variantInv.vid, // Utiliser VID comme SKU par défaut
              variantKey: variantInv.vid,
              stock: totalStock,
              warehouseStock: variantInv.inventory.map(inv => ({
                countryCode: inv.countryCode,
                totalInventoryNum: inv.totalInventory,
                cjInventoryNum: inv.cjInventory,
                factoryInventoryNum: inv.factoryInventory,
                totalInventory: inv.totalInventory,
                cjInventory: inv.cjInventory,
                factoryInventory: inv.factoryInventory,
                verifiedWarehouse: inv.verifiedWarehouse
              }))
            } as CJVariant;
          });
          
          const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
          this.logger.log(`✅ ${variants.length} variants construits depuis inventory - Stock total: ${totalStock}`);
          
          return variants;
        }
        
        // Enrichir les variants des détails avec les stocks de l'inventory
        const stockMap = new Map<string, number>();
        const warehouseMap = new Map<string, CJVariantStock[]>();
        
        for (const variantInv of data.variantInventories) {
          const totalStock = variantInv.inventory.reduce(
            (sum, inv) => sum + (inv.totalInventory || 0),
            0
          );
          stockMap.set(variantInv.vid, totalStock);
          warehouseMap.set(variantInv.vid, variantInv.inventory.map(inv => ({
            countryCode: inv.countryCode,
            totalInventoryNum: inv.totalInventory,
            cjInventoryNum: inv.cjInventory,
            factoryInventoryNum: inv.factoryInventory,
            totalInventory: inv.totalInventory,
            cjInventory: inv.cjInventory,
            factoryInventory: inv.factoryInventory,
            verifiedWarehouse: inv.verifiedWarehouse
          })));
        }
        
        const variantsWithStock: CJVariant[] = productDetails.variants.map(variant => ({
          ...variant,
          stock: stockMap.get(variant.vid) || 0,
          warehouseStock: warehouseMap.get(variant.vid) || []
        }));
        
        const totalStock = variantsWithStock.reduce((sum, v) => sum + (v.stock || 0), 0);
        this.logger.log(`✅ ${variantsWithStock.length} variants enrichis - Stock total: ${totalStock}`);
        
        return variantsWithStock;
      }
      
      // Si l'endpoint inventory échoue, utiliser le fallback
      return this.getVariantsWithStockFallback(pid);
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération variants avec stock:`, error);
      return this.getVariantsWithStockFallback(pid);
    }
  }
  
  /**
   * Méthode fallback pour récupérer variants avec stock (ancienne méthode)
   */
  private async getVariantsWithStockFallback(pid: string): Promise<CJVariant[]> {
    this.logger.log(`🔄 Fallback: récupération variants via endpoint /product/variant/query`);
    
    try {
      const variants = await this.getProductVariants(pid);
      
      if (!variants || variants.length === 0) {
        this.logger.log('⚠️ Aucun variant trouvé via fallback');
        return [];
      }
      
      const stockMap = await this.getProductInventoryBulk(pid);
      
      const variantsWithStock: CJVariant[] = variants.map(variant => {
        const stockData = stockMap.get(variant.vid);
        return {
          ...variant,
          stock: stockData?.stock || 0,
          warehouseStock: stockData?.warehouses || []
        };
      });
      
      return variantsWithStock;
      
    } catch (error: any) {
      this.logger.error(`❌ Fallback échoué:`, error);
      return [];
    }
  }

  /**
   * Obtenir le stock d'un produit
   */
  async getProductStock(vid: string): Promise<any> {
    const response = await this.makeRequest('GET', `/produit/stock/queryByVid`, { params: { vid } });
    return response.data;
  }

  /**
   * Obtenir les avis d'un produit (nouvelle API paginée)
   * Endpoint: GET /product/productComments
   */
  async getProductReviews(
    pid: string,
    pageNum: number = 1,
    pageSize: number = 100
  ): Promise<CJReviewsResponse> {
    this.logger.log(`📝 Récupération reviews du produit: ${pid} (page ${pageNum}, size ${pageSize})`);
    
    try {
      await this.handleRateLimit();
      
      const endpoint = `/product/productComments?pid=${pid}&pageNum=${pageNum}&pageSize=${pageSize}`;
      const response = await this.makeRequest('GET', endpoint);
      
      // ✅ Selon la doc API : code === 0 pour succès, data contient { pageNum, pageSize, total, list }
      if (response && (response.code === 200 || response.code === 0) && response.data) {
        const data = response.data as any;
        
        // ✅ Vérifier que data.list existe (selon la doc, c'est dans data.list)
        if (!data.list || !Array.isArray(data.list)) {
          this.logger.warn(`⚠️ Pas de liste d'avis dans la réponse:`, JSON.stringify(data).substring(0, 200));
          return {
            pageNum: "1",
            pageSize: String(pageSize),
            total: "0",
            list: []
          };
        }
        
        // Mapper les reviews pour le frontend
        const mappedReviews = data.list.map((review: CJReview) => 
          mapCJReview(review)
        );
        
        this.logger.log(`✅ ${mappedReviews.length} reviews récupérés (total: ${data.total || 0})`);
        
        return {
          pageNum: data.pageNum || "1",
          pageSize: data.pageSize || String(pageSize),
          total: data.total || "0",
          list: mappedReviews
        };
      }
      
      // ✅ Log pour debug si pas de données
      if (response) {
        this.logger.warn(`⚠️ Réponse API reviews invalide: code=${response.code}, success=${(response as any).success}, hasData=${!!response.data}`);
        if (response.data) {
          this.logger.warn(`⚠️ Structure data:`, JSON.stringify(response.data).substring(0, 300));
        }
      }
      
      // Retour vide si pas de reviews
      return {
        pageNum: "1",
        pageSize: String(pageSize),
        total: "0",
        list: []
      };
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération reviews ${pid}:`, error);
      
      // Retour vide en cas d'erreur
      return {
        pageNum: "1",
        pageSize: String(pageSize),
        total: "0",
        list: []
      };
    }
  }

  /**
   * Obtenir TOUS les reviews d'un produit (toutes les pages)
   * Récupère automatiquement toutes les pages si plus de 100 reviews
   */
  async getAllProductReviews(pid: string): Promise<CJReview[]> {
    this.logger.log(`📝 === RÉCUPÉRATION TOUS LES REVIEWS (PID: ${pid}) ===`);
    
    try {
      // Première page pour connaître le total
      const firstPage = await this.getProductReviews(pid, 1, 100);
      
      const total = parseInt(firstPage.total || "0", 10);
      const allReviews = [...firstPage.list];
      
      if (total === 0) {
        this.logger.log('⚠️ Aucun review trouvé');
        return [];
      }
      
      this.logger.log(`📊 Total de reviews: ${total}`);
      
      // Si plus de 100 reviews, récupérer les autres pages
      if (total > 100) {
        const totalPages = Math.ceil(total / 100);
        this.logger.log(`📄 Récupération de ${totalPages} pages...`);
        
        for (let page = 2; page <= totalPages; page++) {
          this.logger.log(`🔄 Page ${page}/${totalPages}...`);
          
          const pageData = await this.getProductReviews(pid, page, 100);
          allReviews.push(...pageData.list);
          
          // Rate limiting entre les pages
          if (page < totalPages) {
            const delay = 500; // 500ms entre les pages pour éviter le rate limit
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      this.logger.log(`✅ ${allReviews.length} reviews récupérés au total`);
      
      return allReviews;
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération tous les reviews:`, error);
      return [];
    }
  }

 

  /**
   * Créer une commande (V3)
   */
  async createOrderV3(orderData: {
    orderNumber: string;
    shippingCountryCode: string;
    shippingCountry: string;
    shippingProvince?: string;
    shippingCity: string;
    shippingAddress: string;
    shippingAddress2?: string;
    shippingZip?: string;
    shippingCustomerName: string;
    shippingPhone?: string;
    email?: string;
    shopAmount?: string;
    logisticName: string;
    fromCountryCode?: string;
    platform?: string;
    products: Array<{
      vid: string;
      quantity: number;
      storeLineItemId?: string;
    }>;
  }): Promise<CJOrder> {
    // Valider les produits avant envoi
    if (!orderData.products || orderData.products.length === 0) {
      throw new Error('Aucun produit à envoyer');
    }

    // Valider chaque produit
    for (const product of orderData.products) {
      if (!product.vid || product.vid.trim() === '') {
        throw new Error(`Produit avec vid vide ou manquant: ${JSON.stringify(product)}`);
      }
      if (!product.quantity || product.quantity <= 0) {
        throw new Error(`Produit avec quantité invalide: ${JSON.stringify(product)}`);
      }
    }

    // ✅ Logs verbeux uniquement en dev ou si explicitement activé
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug(`📤 Envoi commande CJ (${orderData.products.length} produits)`);
    }
    
    const response = await this.makeRequest('POST', '/shopping/order/createOrderV3', orderData);
    
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug('📦 Réponse createOrderV3 reçue');
    }
    
    // L'API CJ retourne { code, result, message, data }
    // response est déjà response.data de makeRequest, donc on doit extraire data
    const responseAny = response as any;
    
    if (responseAny && responseAny.code === 200 && responseAny.data) {
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug('✅ Commande CJ créée');
      }
      return responseAny.data as any;
    }
    
    // Si la structure est différente, essayer directement
    if (responseAny && (responseAny.orderId || responseAny.orderNumber)) {
      if (!this.isProduction || this.enableVerboseLogs) {
        this.logger.debug('✅ Commande CJ créée');
      }
      return responseAny as any;
    }
    
    // Si code !== 200, c'est une erreur
    if (responseAny && responseAny.code !== 200) {
      this.logger.error(`❌ Erreur API CJ (code: ${responseAny.code}):`, responseAny.message);
      throw new Error(`Erreur création commande CJ: ${responseAny.message || 'Code erreur ' + responseAny.code}`);
    }
    
    this.logger.error('❌ Structure de réponse inattendue pour createOrderV3');
    throw new Error(`Erreur création commande CJ: ${responseAny?.message || 'Réponse invalide'}`);
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
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug(`🛒 Ajout ${cjOrderIdList.length} commande(s) au panier`);
    }
    const response = await this.makeRequest('POST', '/shopping/order/addCart', {
      cjOrderIdList,
    });
    
    // L'API CJ retourne { code, result, message, data }
    const responseAny = response as any;
    
    if (responseAny && responseAny.code === 200 && responseAny.data) {
      this.logger.log(`✅ ${responseAny.data.successCount || 0} commande(s) ajoutée(s) au panier`);
      return responseAny.data;
    }
    
    if (responseAny && responseAny.code !== 200) {
      this.logger.error(`❌ Erreur API CJ (code: ${responseAny.code}):`, responseAny.message);
      throw new Error(`Erreur ajout au panier CJ: ${responseAny.message || 'Code erreur ' + responseAny.code}`);
    }
    
    throw new Error(`Erreur ajout au panier CJ: Réponse invalide`);
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
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug(`✅ Confirmation ${cjOrderIdList.length} commande(s)`);
    }
    const response = await this.makeRequest('POST', '/shopping/order/addCartConfirm', {
      cjOrderIdList,
    });
    
    // L'API CJ retourne { code, result, message, data }
    const responseAny = response as any;
    
    if (responseAny && responseAny.code === 200 && responseAny.data) {
      this.logger.log(`✅ Panier confirmé: ${responseAny.data.submitSuccess ? 'Succès' : 'Échec'}`);
      return responseAny.data;
    }
    
    if (responseAny && responseAny.code !== 200) {
      this.logger.error(`❌ Erreur API CJ (code: ${responseAny.code}):`, responseAny.message);
      throw new Error(`Erreur confirmation panier CJ: ${responseAny.message || 'Code erreur ' + responseAny.code}`);
    }
    
    throw new Error(`Erreur confirmation panier CJ: Réponse invalide`);
  }

  /**
   * Obtenir le statut d'une commande
   */
  async getOrderStatus(orderId: string): Promise<CJOrder | null> {
    const response = await this.makeRequest('GET', `/order/orderStatus/${orderId}`);
    
    // ✅ Vérifier si la réponse contient des données
    if (!response.data) {
      this.logger.warn(`⚠️ Commande ${orderId} introuvable ou données nulles dans la réponse CJ`);
      return null;
    }
    
    return response.data as any;
  }

  /**
   * Obtenir la liste des commandes
   */
  async getOrders(options: {
    pageNum?: number;
    pageSize?: number;
    orderStatus?: string;
    startTime?: string;
    endTime?: string;
  } = {}): Promise<{ list: CJOrder[]; total: number }> {
    const params = {
      pageNum: options.pageNum || 1,
      pageSize: options.pageSize || 20,
      orderStatus: options.orderStatus,
      startTime: options.startTime,
      endTime: options.endTime,
    };

    const response = await this.makeRequest('GET', '/order/orderList', { params });
    return response.data as any;
  }

  /**
   * Calculer les frais de port
   * Endpoint: /logistic/freightCalculate (selon doc CJ)
   */
  async calculateFreight(
    fromCountryCode: string,
    toCountryCode: string,
    products: Array<{ vid: string; quantity: number }>
  ): Promise<CJFreightOption[]> {
    this.logger.log(`🚚 Calcul du fret: ${fromCountryCode} → ${toCountryCode} (${products.length} produit(s))`);
    
    const response = await this.makeRequest('POST', '/logistic/freightCalculate', {
      startCountryCode: fromCountryCode,
      endCountryCode: toCountryCode,
      products,
    });
    
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug(`📦 Réponse API: ${response.code}`);
    }
    this.logger.log(`📦 Structure réponse:`, JSON.stringify(response, null, 2).substring(0, 500));
    
    // La réponse de l'API CJ a la structure: { code, result, message, data: [...] }
    // data est un tableau d'options de livraison
    if (response.code === 200 && response.result === true && response.data && Array.isArray(response.data)) {
      this.logger.log(`✅ ${response.data.length} option(s) de livraison reçue(s)`);
      
      // Mapper les données de l'API vers notre interface
      // Support de 2 formats de réponse:
      // Format 1 (freightCalculate): logisticName, logisticPrice, logisticAging
      // Format 2 (freightCalculateTip): option.enName, arrivalTime, postage/wrapPostage
      const mappedOptions = response.data.map((item: any, index: number) => {
        // Extraire le nom de la logistique
        // Format 1: logisticName (freightCalculate)
        // Format 2: option.enName ou channel.enName (freightCalculateTip)
        const logisticName = item.logisticName || 
                            item.option?.enName || 
                            item.option?.cnName || 
                            item.channel?.enName || 
                            item.channel?.cnName || 
                            'Unknown';
        
        // Extraire le temps de livraison
        // Format 1: logisticAging (freightCalculate)
        // Format 2: arrivalTime ou option.arrivalTime (freightCalculateTip)
        const shippingTime = item.logisticAging || 
                            item.arrivalTime || 
                            item.option?.arrivalTime || 
                            'N/A';
        
        // Extraire le prix en USD
        // Format 1: logisticPrice (freightCalculate) - prix de base
        // Format 2: postage ou wrapPostage (freightCalculateTip) - prix avec emballage
        // Priorité: logisticPrice > wrapPostage > postage > totalPostageFee
        let freight = 0;
        
        if (item.logisticPrice !== undefined && item.logisticPrice !== null) {
          // Format 1: freightCalculate
          freight = typeof item.logisticPrice === 'string' 
            ? parseFloat(item.logisticPrice) 
            : (item.logisticPrice || 0);
        } else if (item.wrapPostage !== undefined && item.wrapPostage !== null) {
          // Format 2: freightCalculateTip - prix avec emballage (recommandé)
          freight = typeof item.wrapPostage === 'string' 
            ? parseFloat(item.wrapPostage) 
            : (item.wrapPostage || 0);
        } else if (item.postage !== undefined && item.postage !== null) {
          // Format 2: freightCalculateTip - prix de base
          freight = typeof item.postage === 'string' 
            ? parseFloat(item.postage) 
            : (item.postage || 0);
        } else if (item.totalPostageFee !== undefined && item.totalPostageFee !== null) {
          // Format alternatif: total incluant taxes et frais
          freight = typeof item.totalPostageFee === 'string' 
            ? parseFloat(item.totalPostageFee) 
            : (item.totalPostageFee || 0);
        }
        
        // Vérifier que le prix est valide
        if (isNaN(freight) || freight < 0) {
          freight = 0;
          this.logger.warn(`  ⚠️ Prix invalide pour ${logisticName}`);
          this.logger.warn(`     logisticPrice: ${item.logisticPrice}, wrapPostage: ${item.wrapPostage}, postage: ${item.postage}`);
        }
        
        this.logger.log(`  ✅ Option ${index + 1} mappée: ${logisticName} - ${shippingTime} - $${freight.toFixed(2)}`);
        
        return {
          logisticName,
          shippingTime: shippingTime || 'N/A',
          freight: freight,
          currency: 'USD',
        };
      });
      
      return mappedOptions;
    }
    
    // Si pas de données ou erreur
    if (response.code !== 200 || !response.result) {
      this.logger.warn(`⚠️ Erreur API CJ: code=${response.code}, message=${response.message}`);
    }
    
    if (!response.data || !Array.isArray(response.data)) {
      this.logger.warn(`⚠️ Pas de données dans la réponse ou format invalide`);
    }
    
    return [];
  }

  /**
   * Obtenir le tracking d'un colis
   */
  async getTracking(trackNumber: string): Promise<any> {
    const response = await this.makeRequest('GET', `/logistics/track/${trackNumber}`);
    return response.data;
  }

  /**
   * Obtenir les méthodes de livraison disponibles
   */
  async getLogisticsMethods(): Promise<any[]> {
    const response = await this.makeRequest('GET', '/logistics/logisticsList');
    return response.data as any;
  }

  /**
   * Configurer les webhooks
   */
  async configureWebhooks(webhookUrl: string, events: string[]): Promise<any> {
    const response = await this.makeRequest('POST', '/webhook/configure', {
      webhookUrl,
      events,
    });
    return response.data;
  }

  /**
   * Obtenir les logs de webhooks
   */
  async getWebhookLogs(): Promise<any[]> {
    const response = await this.makeRequest('GET', '/webhook/logs');
    return response.data as any;
  }

  /**
   * Récupérer TOUS les produits favoris (My Products) avec pagination complète
   * @param options Options de filtrage
   */
  async getMyProducts(options?: {
    keyword?: string;
    categoryId?: string;
    startAt?: string;
    endAt?: string;
    isListed?: number;
    visiable?: number;
    hasPacked?: number;
    hasVirPacked?: number;
    pageSize?: number;
  }): Promise<any[]> {
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug('📦 Récupération favoris CJ');
    }
    
    const pageSize = options?.pageSize || 100; // Max 100 par page
    let allProducts: any[] = [];
    let currentPage = 1;
    let totalPages = 1;
    
    try {
      do {
        this.logger.log(`📄 Récupération page ${currentPage}/${totalPages}...`);
        
        await this.handleRateLimit();
        
        // Construction des paramètres
        const params: any = {
          pageNumber: currentPage,
          pageSize: pageSize
        };
        
        if (options?.keyword) params.keyword = options.keyword;
        if (options?.categoryId) params.categoryId = options.categoryId;
        if (options?.startAt) params.startAt = options.startAt;
        if (options?.endAt) params.endAt = options.endAt;
        if (options?.isListed !== undefined) params.isListed = options.isListed;
        if (options?.visiable !== undefined) params.visiable = options.visiable;
        if (options?.hasPacked !== undefined) params.hasPacked = options.hasPacked;
        if (options?.hasVirPacked !== undefined) params.hasVirPacked = options.hasVirPacked;
        
        // Construction de l'URL
        const queryString = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryString.append(key, String(value));
          }
        });
        
        const endpoint = `/product/myProduct/query?${queryString.toString()}`;
        
        if (!this.isProduction || this.enableVerboseLogs) {
          this.logger.debug(`📡 ${endpoint}`);
        }
        
        const response = await this.makeRequest('GET', endpoint);
        
        if (response && response.code === 200 && response.data) {
          const data = response.data as any;
          
          // Mise à jour du total de pages
          totalPages = data.totalPages || 1;
          const totalRecords = data.totalRecords || 0;
          
          this.logger.log(`📊 Page ${currentPage}/${totalPages} - ${data.content?.length || 0} produits`);
          this.logger.log(`📊 Total disponible : ${totalRecords} favoris`);
          
          // Ajout des produits de cette page
          if (data.content && Array.isArray(data.content)) {
            allProducts = allProducts.concat(data.content);
          }
          
          currentPage++;
          
        } else {
          this.logger.warn('⚠️ Réponse vide ou invalide');
          break;
        }
        
        // Pause entre les pages
        if (currentPage <= totalPages) {
          const delay = this.getOptimalDelay();
          this.logger.log(`⏰ Pause de ${delay}ms avant page suivante...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } while (currentPage <= totalPages);
      
      this.logger.log(`✅ ${allProducts.length} favoris récupérés au total`);
      
      return allProducts;
      
    } catch (error: any) {
      this.logger.error('❌ Erreur récupération My Products:', error);
      
      // Gestion d'erreurs
      if (error.code === 429 || error.code === 1600200) {
        const retryDelay = this.getRetryDelay();
        this.logger.warn(`⏳ Rate limit atteint, retry dans ${retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.getMyProducts(options);
      }
      
      if (error.code === 401 || error.code === 1600001) {
        this.logger.warn('🔄 Token expiré, rafraîchissement...');
        await this.refreshAccessToken();
        return this.getMyProducts(options);
      }
      
      throw error;
    }
  }

  /**
   * Méthodes utilitaires
   */

  /**
   * Rechercher des produits avec gestion du stock
   */
  async searchProductsWithStock(
    keyword: string,
    options: any = {}
  ): Promise<CJProduct[]> {
    const result = await this.searchProducts(keyword, options);
    
    // ✅ V2 utilise "products" au lieu de "list"
    const products = result.products || [];
    
    // Enrichir avec les informations de stock
    const enrichedProducts = await Promise.all(
      products.map(async (product) => {
        try {
          const stockInfo = await this.getProductStock(product.variants[0]?.vid);
          return {
            ...product,
            stockInfo,
          };
        } catch (error) {
          this.logger.warn(`Impossible de récupérer le stock pour ${product.pid}:`, error);
          return product;
        }
      })
    );

    return enrichedProducts;
  }

  /**
   * Obtenir un produit complet avec toutes ses informations
   */
  async getProductWithStock(pid: string): Promise<CJProduct> {
    const product = await this.getProductDetails(pid);
    const variants = await this.getProductVariants(pid);
    const reviewsResponse = await this.getProductReviews(pid, 1, 100);
    
    return {
      ...product,
      variants,
      reviews: reviewsResponse.list || [],
    };
  }

  /**
   * Récupérer toutes les catégories
   */
  async getCategories(): Promise<any[]> {
    if (!this.isProduction || this.enableVerboseLogs) {
      this.logger.debug('🏷️ Récupération catégories CJ');
    }
    
    try {
      const response = await this.makeRequest('GET', '/product/getCategory');
      
      if (response.code === 200) {
        const categories = Array.isArray(response.data) ? response.data : [];
        this.logger.log(`✅ ${categories.length} catégories récupérées`);
        return categories;
      } else {
        throw new Error(response.message || 'Erreur lors de la récupération des catégories');
      }
    } catch (error) {
      this.logger.error('❌ Erreur récupération catégories:', error);
      throw error;
    }
  }

  /**
   * Récupérer l'arbre des catégories (utilise le même endpoint que getCategories)
   */
  async getCategoriesTree(): Promise<any[]> {
    this.logger.log('🌳 Récupération de l\'arbre des catégories CJ...');
    
    try {
      // L'endpoint /product/getCategory retourne déjà la structure hiérarchique
      const response = await this.makeRequest('GET', '/product/getCategory');
      
      if (response.code === 200) {
        const tree = Array.isArray(response.data) ? response.data : [];
        this.logger.log(`✅ Arbre des catégories récupéré`);
        return tree;
      } else {
        throw new Error(response.message || 'Erreur lors de la récupération de l\'arbre');
      }
    } catch (error) {
      this.logger.error('❌ Erreur récupération arbre:', error);
      throw error;
    }
  }

  /**
   * Recherche avancée de catégories avec filtres et pagination
   */
  async searchCategories(params: {
    parentId?: string;
    level?: number;
    keyword?: string;
    countryCode?: string;
    includeEmpty?: boolean;
    includeProductCount?: boolean;
    pageNum?: number;
    pageSize?: number;
  }): Promise<any> {
    this.logger.log('🔍 Recherche avancée de catégories CJ...', params);
    
    try {
      // Récupérer toutes les catégories d'abord
      const hierarchicalCategories = await this.getCategories();
      
      // Aplatir la structure hiérarchique
      const allCategories = this.flattenCategories(hierarchicalCategories);
      
      // Appliquer les filtres
      let filteredCategories = allCategories;
      
      // Filtrer par parent ID
      if (params.parentId) {
        filteredCategories = filteredCategories.filter(cat => 
          cat.parentId === params.parentId
        );
      }
      
      // Filtrer par niveau
      if (params.level) {
        filteredCategories = filteredCategories.filter(cat => cat.level === params.level);
      }
      
      // Filtrer par mot-clé
      if (params.keyword) {
        const keyword = params.keyword.toLowerCase();
        filteredCategories = filteredCategories.filter(cat => 
          cat.categoryName?.toLowerCase().includes(keyword) ||
          cat.categoryNameEn?.toLowerCase().includes(keyword)
        );
      }
      
      // Appliquer la pagination
      const pageNum = params.pageNum || 1;
      const pageSize = params.pageSize || 50;
      const total = filteredCategories.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (pageNum - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedCategories = filteredCategories.slice(startIndex, endIndex);
      
      this.logger.log(`✅ ${paginatedCategories.length} catégories trouvées (page ${pageNum}/${totalPages})`);
      
      return {
        code: 200,
        success: true,
        message: 'Catégories récupérées avec succès',
        data: {
          list: paginatedCategories,
          total,
          pageNum,
          pageSize,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      };
    } catch (error) {
      this.logger.error('❌ Erreur recherche catégories:', error);
      throw error;
    }
  }

  /**
   * Obtenir les catégories populaires (basé sur le nombre de produits)
   */
  async getPopularCategories(limit: number = 10): Promise<any[]> {
    this.logger.log(`🔥 Récupération des ${limit} catégories populaires...`);
    
    try {
      const categories = await this.getCategories();
      
      // Trier par nombre de produits (simulation - dans un vrai système, ceci viendrait de l'API)
      const popularCategories = categories
        .filter(cat => cat.productCount && cat.productCount > 0)
        .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
        .slice(0, limit);
      
      this.logger.log(`✅ ${popularCategories.length} catégories populaires récupérées`);
      return popularCategories;
    } catch (error) {
      this.logger.error('❌ Erreur récupération catégories populaires:', error);
      throw error;
    }
  }

  /**
   * Obtenir les sous-catégories d'une catégorie parent
   */
  async getSubCategories(parentId: string): Promise<any[]> {
    this.logger.log(`📂 Récupération des sous-catégories pour ${parentId}...`);
    
    try {
      const allCategories = await this.getCategories();
      const subCategories = this.filterCategoriesByParent(allCategories, parentId);
      
      this.logger.log(`✅ ${subCategories.length} sous-catégories trouvées`);
      return subCategories;
    } catch (error) {
      this.logger.error('❌ Erreur récupération sous-catégories:', error);
      throw error;
    }
  }

  /**
   * Méthode utilitaire pour filtrer les catégories par parent
   */
  private filterCategoriesByParent(categories: any[], parentId: string): any[] {
    return categories.filter(cat => cat.parentId === parentId || cat.parentCategoryId === parentId);
  }

  /**
   * Obtenir le chemin complet d'une catégorie (breadcrumb)
   */
  async getCategoryPath(categoryId: string): Promise<any[]> {
    this.logger.log(`🗂️ Récupération du chemin pour la catégorie ${categoryId}...`);
    
    try {
      const allCategories = await this.getCategories();
      const categoryMap = new Map();
      
      // Créer une map pour un accès rapide
      allCategories.forEach(cat => {
        categoryMap.set(cat.categoryId || cat.id, cat);
      });
      
      const path = [];
      let currentCategory = categoryMap.get(categoryId);
      
      // Remonter la hiérarchie
      while (currentCategory) {
        path.unshift(currentCategory);
        const parentId = currentCategory.parentId || currentCategory.parentCategoryId;
        currentCategory = parentId ? categoryMap.get(parentId) : null;
      }
      
      this.logger.log(`✅ Chemin de ${path.length} niveaux récupéré`);
      return path;
    } catch (error) {
      this.logger.error('❌ Erreur récupération chemin catégorie:', error);
      throw error;
    }
  }

  /**
   * Récupérer le stock des variantes d'un produit (selon doc CJ)
   */
  async getProductVariantStock(pid: string, variantId?: string, countryCode?: string): Promise<any> {
    this.logger.log('🔍 === DÉBUT getProductVariantStock ===');
    this.logger.log('📝 Paramètres:', { pid, variantId, countryCode });
    
    try {
      const params: any = { pid };
      if (variantId) params.variantId = variantId;
      if (countryCode) params.countryCode = countryCode;
      
      const queryString = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      });
      
      const endpoint = `/product/variant-stock?${queryString.toString()}`;
      this.logger.log('🌐 Endpoint:', endpoint);
      
      const response = await this.makeRequest('GET', endpoint);
      
      this.logger.log('✅ Stock variante récupéré');
      this.logger.log('📊 Structure:', {
        hasData: !!response.data,
        dataType: typeof response.data,
      });
      
      this.logger.log('🔍 === FIN getProductVariantStock ===');
      return response.data;
    } catch (error) {
      this.logger.error('❌ === ERREUR getProductVariantStock ===');
      this.logger.error('💥 Erreur:', error);
      this.logger.error('🔍 === FIN ERREUR getProductVariantStock ===');
      throw error;
    }
  }

  /**
   * Convertir la structure hiérarchique des catégories en liste plate
   */
  private flattenCategories(categories: any[], level: number = 1, parentId: string = ''): any[] {
    const flatCategories: any[] = [];
    
    for (const category of categories) {
      // Ajouter la catégorie actuelle avec informations de niveau
      const flatCategory = {
        ...category,
        level,
        parentId: parentId || null,
        path: parentId ? `${parentId}/${category.categoryId}` : category.categoryId
      };
      
      flatCategories.push(flatCategory);
      
      // Ajouter récursivement les sous-catégories
      if (category.subCategories && category.subCategories.length > 0) {
        const subCategories = this.flattenCategories(
          category.subCategories, 
          level + 1, 
          category.categoryId
        );
        flatCategories.push(...subCategories);
      }
    }
    
    return flatCategories;
  }

  /**
   * Déconnexion
   */
  async logout(): Promise<void> {
    try {
      await this.makeRequest('POST', '/user/logout');
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      this.logger.log('Déconnexion réussie');
    } catch (error) {
      this.logger.warn('Erreur lors de la déconnexion:', error);
    }
  }

  /**
   * Vérifier si le client est connecté
   */
  isConnected(): boolean {
    return !!this.accessToken && 
           (!this.tokenExpiry || new Date() < this.tokenExpiry);
  }

  /**
   * Obtenir les informations de connexion
   */
  getConnectionInfo(): {
    connected: boolean;
    tokenExpiry?: Date;
    tier: string;
  } {
    return {
      connected: this.isConnected(),
      tokenExpiry: this.tokenExpiry || undefined,
      tier: this.config.tier || 'free',
    };
  }

  // ============================================================================
  // PRODUCT SOURCING
  // ============================================================================

  /**
   * Créer une demande de sourcing produit
   * Endpoint: POST /product/sourcing/create
   * 
   * @param request Données de la demande
   * @returns Réponse avec cjSourcingId
   */
  async createSourcingRequest(request: CJSourcingCreateRequest): Promise<CJSourcingCreateResponse> {
    this.logger.log(`📝 === CRÉATION DEMANDE SOURCING ===`);
    this.logger.log(`📦 Produit: ${request.productName}`);
    
    try {
      await this.handleRateLimit();
      
      const endpoint = '/product/sourcing/create';
      const response = await this.makeRequest('POST', endpoint, {
        data: request
      });
      
      if (response && response.code === 0 && response.data) {
        const data = response.data as any;
        this.logger.log(`✅ Demande créée: ${data.cjSourcingId}`);
        
        return {
          success: true,
          code: response.code,
          message: response.message,
          data: {
            cjSourcingId: data.cjSourcingId,
            result: data.result || 'success'
          },
          requestId: response.requestId || ''
        };
      }
      
      throw new Error(response?.message || 'Erreur création demande sourcing');
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur création sourcing:`, error);
      throw error;
    }
  }

  /**
   * Vérifier le statut d'une ou plusieurs demandes de sourcing
   * Endpoint: POST /product/sourcing/query
   * 
   * @param sourceIds Liste des IDs de demandes
   * @returns Détails des demandes
   */
  async querySourcingRequests(sourceIds: string[]): Promise<CJSourcingDetails[]> {
    this.logger.log(`🔍 === VÉRIFICATION STATUT SOURCING ===`);
    this.logger.log(`📋 ${sourceIds.length} demande(s) à vérifier`);
    
    try {
      await this.handleRateLimit();
      
      const endpoint = '/product/sourcing/query';
      const response = await this.makeRequest('POST', endpoint, {
        data: {
          sourceIds: sourceIds
        }
      });
      
      if (response && response.code === 0 && response.data) {
        // L'API peut retourner un objet ou un array
        const data = Array.isArray(response.data) ? response.data : [response.data];
        
        this.logger.log(`✅ ${data.length} résultat(s) récupéré(s)`);
        
        // Logger les statuts
        data.forEach((item: CJSourcingDetails) => {
          this.logger.log(`   - ${item.sourceId}: ${item.sourceStatusStr}`);
          if (item.cjProductId) {
            this.logger.log(`     ✅ Produit trouvé: ${item.cjProductId}`);
          }
        });
        
        return data;
      }
      
      return [];
      
    } catch (error: any) {
      this.logger.error(`❌ Erreur vérification sourcing:`, error);
      return [];
    }
  }

  /**
   * Vérifier le statut d'une seule demande
   * 
   * @param sourceId ID de la demande
   * @returns Détails de la demande ou null
   */
  async querySingleSourcingRequest(sourceId: string): Promise<CJSourcingDetails | null> {
    const results = await this.querySourcingRequests([sourceId]);
    return results.length > 0 ? results[0] : null;
  }
}

