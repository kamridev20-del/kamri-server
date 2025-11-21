import { Injectable, Logger } from '@nestjs/common';
import { DuplicatePreventionService } from '../../common/services/duplicate-prevention.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CJAPIClient } from '../cj-api-client';
import { CJProductSearchDto } from '../dto/cj-product-search.dto';
import { CJProduct, CJProductSearchOptions, CJProductSearchResult, calculateReviewStats, CJVariantStock } from '../interfaces/cj-product.interface';

@Injectable()
export class CJProductService {
  private readonly logger = new Logger(CJProductService.name);

  constructor(
    private prisma: PrismaService,
    private cjApiClient: CJAPIClient,
    private duplicateService: DuplicatePreventionService
  ) {}

  // ✅ AMÉLIORATION : Cache multi-niveaux avec TTL configurable
  private defaultProductsCache: { data: CJProduct[]; timestamp: number } | null = null;
  
  private readonly searchCache = new Map<string, { 
    data: CJProduct[]; 
    timestamp: number; 
    ttl: number;
    searchParams: any;
  }>();
  
  private readonly detailsCache = new Map<string, { 
    data: any; 
    timestamp: number; 
    ttl: number;
  }>();
  
  private readonly stockCache = new Map<string, { 
    data: any; 
    timestamp: number; 
    ttl: number;
  }>();
  
  private readonly categoriesCache = new Map<string, { 
    data: any; 
    timestamp: number; 
    ttl: number;
  }>();
  
  // Configuration des TTL (Time To Live) en millisecondes
  private readonly CACHE_TTL = {
    SEARCH: 5 * 60 * 1000,      // 5 minutes pour les recherches
    DETAILS: 15 * 60 * 1000,    // 15 minutes pour les détails
    STOCK: 2 * 60 * 1000,       // 2 minutes pour le stock (plus volatile)
    CATEGORIES: 60 * 60 * 1000,  // 1 heure pour les catégories
  };
  
  // Statistiques de cache
  private cacheStats = {
    searchHits: 0,
    searchMisses: 0,
    detailsHits: 0,
    detailsMisses: 0,
    stockHits: 0,
    stockMisses: 0,
    categoriesHits: 0,
    categoriesMisses: 0,
  };

  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (legacy)

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
   * Obtenir les produits par défaut (sans filtre)
   * Retourne maintenant les informations de pagination
   * ⚠️ IMPORTANT : Utilise toujours l'API CJ pour avoir les produits à jour, pas la BD locale
   */
  async getDefaultProducts(query: { pageNum?: number; pageSize?: number; countryCode?: string; useCache?: boolean }): Promise<{
    products: CJProduct[];
    total: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
  }> {
    this.logger.log('🔍 === DÉBUT getDefaultProducts ===');
    this.logger.log('📝 Paramètres:', JSON.stringify(query, null, 2));
    
    // ⚠️ Par défaut, utiliser l'API CJ pour avoir les produits à jour
    // La BD locale (cJProductStore) est utilisée uniquement si useCache=true explicitement
    const useCache = query.useCache === true;
    
    if (useCache) {
      // 🚨 OPTION : Utiliser la base de données locale si demandé explicitement
      const hasToken = this.cjApiClient['accessToken'];
      const tokenExpiry = this.cjApiClient['tokenExpiry'];
      const isTokenValid = hasToken && tokenExpiry && new Date() < tokenExpiry;
      
      if (isTokenValid) {
        this.logger.log('✅ Token CJ valide - Utilisation de la base de données locale (useCache=true)');
        const existingProducts = await this.prisma.cJProductStore.count();
        
        if (existingProducts > 0) {
          this.logger.log(`📦 ${existingProducts} produits en base - Utilisation du cache local`);
          const pageSize = Number(query.pageSize) || 100;
          const pageNum = Number(query.pageNum) || 1;
          const skip = (pageNum - 1) * pageSize;
          
          const [cachedProducts, total] = await Promise.all([
            this.prisma.cJProductStore.findMany({
              skip,
              take: pageSize,
              orderBy: { createdAt: 'desc' }
            }),
            this.prisma.cJProductStore.count()
          ]);
          
          // Transformer en format CJProduct
          const products = cachedProducts.map(product => ({
            pid: product.cjProductId,
            productName: product.name,
            productNameEn: product.name,
            productSku: (product as any).productSku || product.cjProductId,
            sellPrice: Number(product.price) || Number(product.originalPrice) || 0,
            productImage: product.image,
            categoryName: product.category,
            description: product.description,
            variants: [],
            rating: 0,
            totalReviews: 0,
            weight: 0,
            dimensions: '',
            brand: '',
            tags: [],
            reviews: []
          }));
          
          return {
            products,
            total,
            pageNumber: pageNum,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
          };
        } else {
          this.logger.log('📦 Aucun produit en base - Appel API CJ nécessaire');
        }
      } else {
        this.logger.log('🔑 Token CJ invalide ou expiré - Appel API CJ nécessaire');
      }
    } else {
      this.logger.log('🌐 Utilisation de l\'API CJ pour obtenir les produits à jour (useCache=false par défaut)');
    }
    
    // Vérifier le cache pour la première page uniquement
    if (query.pageNum === 1 && this.defaultProductsCache && 
        (Date.now() - this.defaultProductsCache.timestamp) < this.CACHE_DURATION) {
      this.logger.log('📦 Utilisation du cache pour les produits par défaut');
      // Pour le cache, on doit faire un appel API pour obtenir le total réel
      // Mais pour éviter un appel supplémentaire, on utilise une estimation basée sur la taille de la page
      const pageSize = query.pageSize || 100;
      const estimatedTotal = this.defaultProductsCache.data.length >= pageSize ? pageSize * 10 : this.defaultProductsCache.data.length;
      return {
        products: this.defaultProductsCache.data,
        total: estimatedTotal, // Estimation - sera remplacé par la vraie valeur au prochain appel
        pageNumber: 1,
        pageSize,
        totalPages: Math.ceil(estimatedTotal / pageSize)
      };
    }
    
    try {
      this.logger.log('🚀 Initialisation du client CJ...');
      const client = await this.initializeClient();
      this.logger.log('✅ Client CJ initialisé avec succès');

      this.logger.log('📡 Appel API CJ getDefaultProducts (V2)...');
      const result = await client.searchProducts(undefined, {
        page: query.pageNum || 1,
        size: query.pageSize || 100,
        countryCode: query.countryCode,
        sort: 'desc',
        orderBy: 0, // Best match
      });

      this.logger.log('📊 Résultat API CJ V2 brut:', JSON.stringify({
        total: result.total,
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        productsLength: result.products?.length || 0
      }, null, 2));

      const products = result.products || [];
      
      // Mettre en cache pour la première page
      if (query.pageNum === 1) {
        this.defaultProductsCache = {
          data: products,
          timestamp: Date.now()
        };
        this.logger.log('📦 Produits mis en cache pour 5 minutes');
      }
      
      // Calculer totalPages si non fourni par l'API
      const pageSize = result.pageSize || query.pageSize || 100;
      const total = result.total || 0;
      let totalPages = result.totalPages;
      
      // Si totalPages n'est pas fourni, le calculer
      if (!totalPages || totalPages === 0) {
        if (total > 0) {
          totalPages = Math.ceil(total / pageSize);
        } else {
          // Si total est 0 mais qu'on a des produits, estimer à partir du nombre de produits
          totalPages = products.length >= pageSize ? 2 : 1;
        }
      }
      
      this.logger.log(`🎉 getDefaultProducts terminé avec succès:`);
      this.logger.log(`   - Produits: ${products.length}`);
      this.logger.log(`   - Total: ${total}`);
      this.logger.log(`   - PageSize: ${pageSize}`);
      this.logger.log(`   - TotalPages: ${totalPages}`);
      this.logger.log(`   - PageNumber: ${result.pageNumber || query.pageNum || 1}`);
      this.logger.log('🔍 === FIN getDefaultProducts ===');
      
      return {
        products,
        total: total || products.length, // Utiliser le nombre de produits si total est 0
        pageNumber: result.pageNumber || query.pageNum || 1,
        pageSize,
        totalPages: totalPages || 1 // Au minimum 1 page
      };
    } catch (error) {
      this.logger.error('❌ === ERREUR getDefaultProducts ===');
      this.logger.error('💥 Erreur détaillée:', error);
      this.logger.error('📊 Type d\'erreur:', typeof error);
      this.logger.error('📊 Message d\'erreur:', error instanceof Error ? error.message : String(error));
      this.logger.error('📊 Stack trace:', error instanceof Error ? error.stack : 'N/A');
      this.logger.error('🔍 === FIN ERREUR getDefaultProducts ===');
      throw error;
    }
  }

  /**
   * Rechercher des produits avec cache amélioré (API V2)
   */
  async searchProducts(query: CJProductSearchDto): Promise<CJProductSearchResult> {
    this.logger.log('🔍 === DÉBUT RECHERCHE PRODUITS CJ ===');
    this.logger.log('📝 Paramètres de recherche:', JSON.stringify(query, null, 2));
    
    // Créer une clé de cache basée sur les paramètres de recherche
    const cacheKey = `search_v2_${JSON.stringify(query)}`;
    
    // Vérifier le cache d'abord
    const cachedResult = this.getCachedSearchResult(cacheKey);
    if (cachedResult) {
      this.logger.log('🔍 === FIN RECHERCHE PRODUITS CJ (CACHE) ===');
      return cachedResult;
    }
    
    try {
      this.logger.log('🔄 Initialisation du client CJ...');
      const client = await this.initializeClient();
      this.logger.log('✅ Client CJ initialisé avec succès');

      // ✅ CORRECTION: Recherche simple sans trop de filtres
      this.logger.log('� Appel API CJ avec paramètres minimaux...');
      
      // ✅ Mapper les paramètres DTO vers CJProductSearchOptions (V2)
      const searchOptions: CJProductSearchOptions = {
        page: query.pageNum || 1,                    // ✅ Renommer pageNum → page
        size: Math.min(query.pageSize || 10, 100),   // ✅ Limite à 100 (pas 200)
        keyWord: query.keyword || query.productNameEn, // ✅ Utiliser keyWord en priorité
        categoryId: query.categoryId,
        lv2categoryList: query.lv2categoryList,      // ✅ NOUVEAU
        lv3categoryList: query.lv3categoryList,      // ✅ NOUVEAU
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        countryCode: query.countryCode,
        productType: query.productType ? Number(query.productType) : undefined,
        productFlag: query.productFlag,              // ✅ NOUVEAU
        startInventory: query.startInventory,
        endInventory: query.endInventory,
        verifiedWarehouse: query.verifiedWarehouse,
        timeStart: query.timeStart,
        timeEnd: query.timeEnd,
        zonePlatform: query.zonePlatform,            // ✅ NOUVEAU
        isWarehouse: query.isWarehouse,              // ✅ NOUVEAU
        currency: query.currency,                     // ✅ NOUVEAU
        isFreeShipping: query.isFreeShipping,
        isSelfPickup: query.isSelfPickup,
        hasCertification: query.hasCertification,     // ✅ NOUVEAU
        customization: query.customization,          // ✅ NOUVEAU
        sort: (query.sort as 'asc' | 'desc') || 'desc',
        orderBy: this.mapOrderByToV2(query.orderBy), // ✅ Mapper vers nombres V2
        supplierId: query.supplierId,
        features: query.features || ['enable_category'], // ✅ NOUVEAU V2 : Retourner catégories par défaut
        // Legacy support
        pageNum: query.pageNum,
        pageSize: query.pageSize,
        productName: query.productNameEn,
        productNameEn: query.productNameEn
      };

      // ✅ Appel API V2 avec les options typées
      const result = await client.searchProducts(undefined, searchOptions);
      
      // ✅ Mapper les produits pour normaliser les images (V2 peut retourner différentes structures)
      const mappedProducts = (result.products || [])
        .map((product: any) => {
        // Normaliser productImage depuis différentes structures possibles (V2 utilise bigImage)
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
        
        // ✅ Normaliser le PID (peut être dans différents champs selon V2)
        const normalizedPid = product.pid || product.productId || product.id || '';
        
        // ✅ VALIDATION : Ne pas inclure les produits sans PID valide
        if (!normalizedPid || normalizedPid === 'undefined' || normalizedPid === 'null') {
          this.logger.warn(`⚠️ Produit sans PID valide ignoré:`, {
            productName: product.productName || product.productNameEn,
            availableFields: Object.keys(product)
          });
          return null; // Retourner null pour filtrer ce produit
        }
        
        return {
          ...product,
          productImage: productImage || '', // Toujours définir productImage (même si vide)
          // S'assurer que tous les champs requis sont présents
          pid: normalizedPid,
          productId: normalizedPid, // Ajouter aussi productId pour compatibilité
          productName: product.productName || product.productNameEn || '',
          productNameEn: product.productNameEn || product.productName || '',
          productSku: product.productSku || product.sku || '',
          sellPrice: product.sellPrice || product.price || 0,
          categoryName: product.categoryName || product.category || '',
          description: product.description || '',
          variants: product.variants || [],
          weight: product.weight || product.productWeight || 0,
          dimensions: product.dimensions || '',
          brand: product.brand || '',
          tags: product.tags || [],
          reviews: product.reviews || [],
          rating: product.rating || 0,
          totalReviews: product.totalReviews || 0
        };
        })
        .filter((product: any) => product !== null); // ✅ Filtrer les produits sans PID valide
      
      // ✅ Format de réponse V2
      const response: CJProductSearchResult = {
        products: mappedProducts,
        total: result.total || 0,
        pageNumber: result.pageNumber || query.pageNum || 1,
        pageSize: result.pageSize || query.pageSize || 10,
        totalPages: result.totalPages || 0,
        relatedCategories: result.relatedCategories || [],
        warehouses: result.warehouses || [],
        keyWord: result.keyWord || query.keyword || query.productNameEn,
        searchHit: result.searchHit || ''
      };
      
      // Mettre en cache les résultats
      this.setCachedSearchResult(cacheKey, response, query);
      
      this.logger.log(`📈 Résultat API CJ V2 : ${response.products.length} produits reçus`);
      this.logger.log(`📊 Total disponible : ${response.total} produits`);
      this.logger.log(`📄 Page ${response.pageNumber}/${response.totalPages || 1}`);
      this.logger.log('🎉 Recherche terminée avec succès');
      this.logger.log('🔍 === FIN RECHERCHE PRODUITS CJ (V2) ===');
      
      return response;
    } catch (error) {
      this.logger.error('❌ === ERREUR RECHERCHE PRODUITS CJ (V2) ===');
      this.logger.error('💥 Erreur détaillée:', error);
      this.logger.error('📊 Type d\'erreur:', typeof error);
      this.logger.error('📊 Message d\'erreur:', error instanceof Error ? error.message : String(error));
      this.logger.error('📊 Stack trace:', error instanceof Error ? error.stack : 'N/A');
      this.logger.error('🔍 === FIN ERREUR RECHERCHE PRODUITS CJ (V2) ===');
      throw error;
    }
  }

  /**
   * Mapper orderBy string vers nombres V2
   */
  private mapOrderByToV2(orderBy?: string | number): number {
    if (typeof orderBy === 'number') {
      return orderBy;
    }
    
    const mapping: { [key: string]: number } = {
      'createAt': 3,      // Create time
      'listedNum': 1,     // Listing count
      'sellPrice': 2,     // Sell price
      'inventory': 4,      // Inventory
      'default': 0         // Best match
    };
    
    return mapping[orderBy || 'default'] || 0;
  }

  /**
   * Récupérer toutes les catégories depuis l'API CJ
   */
  async getCategories(): Promise<any[]> {
    this.logger.log('🏷️ === RÉCUPÉRATION DES CATÉGORIES CJ ===');
    
    try {
      const client = await this.initializeClient();
      const categories = await client.getCategories();
      
      this.logger.log(`✅ ${categories.length} catégories récupérées`);
      
      return categories;
    } catch (error) {
      this.logger.error('❌ Erreur lors de la récupération des catégories:', error);
      throw error;
    }
  }

  /**
   * Récupérer l'arbre des catégories
   */
  async getCategoriesTree(): Promise<any[]> {
    this.logger.log('🌳 === RÉCUPÉRATION DE L\'ARBRE DES CATÉGORIES ===');
    
    try {
      const client = await this.initializeClient();
      const tree = await client.getCategoriesTree();
      
      this.logger.log(`✅ Arbre des catégories récupéré`);
      
      return tree;
    } catch (error) {
      this.logger.error('❌ Erreur lors de la récupération de l\'arbre:', error);
      throw error;
    }
  }

  /**
   * Synchroniser les catégories CJ
   */
  async syncCategories(): Promise<any> {
    try {
      const client = await this.initializeClient();
      const categories = await client.getCategories();
      
      // Ici, vous pouvez ajouter une logique pour sauvegarder les catégories
      // dans votre base de données si nécessaire
      
      return {
        success: true,
        message: 'Catégories synchronisées avec succès',
        categories: categories
      };
    } catch (error) {
      this.logger.error('Erreur lors de la synchronisation des catégories:', error);
      throw error;
    }
  }

  // ===== MÉTHODES AVANCÉES POUR LES CATÉGORIES =====

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
    this.logger.log('🔍 === DÉBUT RECHERCHE CATÉGORIES AVANCÉE ===');
    this.logger.log('📝 Paramètres:', params);
    
    // Vérifier le cache d'abord
    const cacheKey = `categories_search_${JSON.stringify(params)}`;
    const cached = this.categoriesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL.CATEGORIES) {
      this.cacheStats.categoriesHits++;
      this.logger.log(`📦 Cache HIT pour recherche catégories: ${cacheKey}`);
      return cached.data;
    } else {
      this.cacheStats.categoriesMisses++;
    }

    try {
      const client = await this.initializeClient();
      const result = await client.searchCategories(params);
      
      // Mettre en cache
      this.categoriesCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL.CATEGORIES
      });
      
      this.logger.log('🎉 Recherche catégories terminée avec succès');
      this.logger.log('🔍 === FIN RECHERCHE CATÉGORIES AVANCÉE ===');
      
      return result;
    } catch (error) {
      this.logger.error('❌ === ERREUR RECHERCHE CATÉGORIES ===');
      this.logger.error('💥 Erreur:', error);
      this.logger.error('🔍 === FIN ERREUR RECHERCHE CATÉGORIES ===');
      throw error;
    }
  }

  /**
   * Obtenir les catégories populaires
   */
  async getPopularCategories(limit: number = 10): Promise<any[]> {
    this.logger.log(`🔥 Récupération des ${limit} catégories populaires...`);
    
    const cacheKey = `popular_categories_${limit}`;
    const cached = this.categoriesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL.CATEGORIES) {
      this.cacheStats.categoriesHits++;
      return cached.data;
    } else {
      this.cacheStats.categoriesMisses++;
    }

    try {
      const client = await this.initializeClient();
      const categories = await client.getPopularCategories(limit);
      
      // Mettre en cache
      this.categoriesCache.set(cacheKey, {
        data: categories,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL.CATEGORIES
      });
      
      this.logger.log(`✅ ${categories.length} catégories populaires récupérées`);
      return categories;
    } catch (error) {
      this.logger.error('❌ Erreur récupération catégories populaires:', error);
      throw error;
    }
  }

  /**
   * Obtenir les sous-catégories d'une catégorie
   */
  async getSubCategories(parentId: string): Promise<any[]> {
    this.logger.log(`📂 Récupération des sous-catégories pour ${parentId}...`);
    
    const cacheKey = `sub_categories_${parentId}`;
    const cached = this.categoriesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL.CATEGORIES) {
      this.cacheStats.categoriesHits++;
      return cached.data;
    } else {
      this.cacheStats.categoriesMisses++;
    }

    try {
      const client = await this.initializeClient();
      const subCategories = await client.getSubCategories(parentId);
      
      // Mettre en cache
      this.categoriesCache.set(cacheKey, {
        data: subCategories,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL.CATEGORIES
      });
      
      this.logger.log(`✅ ${subCategories.length} sous-catégories trouvées`);
      return subCategories;
    } catch (error) {
      this.logger.error('❌ Erreur récupération sous-catégories:', error);
      throw error;
    }
  }

  /**
   * Obtenir le chemin d'une catégorie (breadcrumb)
   */
  async getCategoryPath(categoryId: string): Promise<any[]> {
    this.logger.log(`🗂️ Récupération du chemin pour la catégorie ${categoryId}...`);
    
    const cacheKey = `category_path_${categoryId}`;
    const cached = this.categoriesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL.CATEGORIES) {
      this.cacheStats.categoriesHits++;
      return cached.data;
    } else {
      this.cacheStats.categoriesMisses++;
    }

    try {
      const client = await this.initializeClient();
      const path = await client.getCategoryPath(categoryId);
      
      // Mettre en cache
      this.categoriesCache.set(cacheKey, {
        data: path,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL.CATEGORIES
      });
      
      this.logger.log(`✅ Chemin de ${path.length} niveaux récupéré`);
      return path;
    } catch (error) {
      this.logger.error('❌ Erreur récupération chemin catégorie:', error);
      throw error;
    }
  }

  /**
   * Obtenir les détails d'un produit CJ avec cache (priorité: cache → base locale → API CJ)
   */
  async getProductDetails(productId: string): Promise<any> {
    try {
      this.logger.log(`📦 Récupération des détails du produit CJ: ${productId}`);
      
      // 1️⃣ Vérifier le cache d'abord
      const cachedDetails = this.getCachedDetails(productId);
      if (cachedDetails) {
        return cachedDetails;
      }
      
      // 2️⃣ Essayer de trouver le produit dans la base locale
      let localProduct = null;
      
      // Essayer par cjProductId 
      localProduct = await this.prisma.cJProductStore.findFirst({
        where: { cjProductId: productId }
      });
      
      // Si pas trouvé, essayer par productSku
      if (!localProduct) {
        localProduct = await this.prisma.cJProductStore.findFirst({
          where: { productSku: productId }
        });
      }
      
      // Si trouvé en local, utiliser ces données (plus rapide et fiable)
      if (localProduct) {
        this.logger.log(`✅ Produit trouvé en local: ${localProduct.name}`);
        const details = this.mapLocalProductToDetails(localProduct);
        
        // Mettre en cache les détails locaux
        this.setCachedDetails(productId, details);
        
        return details;
      }
      
      // 3️⃣ Si pas en local, faire l'appel API vers CJ avec l'endpoint correct
      this.logger.log(`🌐 Produit non trouvé en local, appel API CJ...`);
      
      const client = await this.initializeClient();
      // ✅ Récupérer TOUS les champs avec vidéos incluses
      const cjProduct: any = await client.getProductDetails(productId, true); // true = inclure les vidéos
      
      // Vérifier si le produit est null ou vide
      if (!cjProduct) {
        this.logger.error(`❌ Produit ${productId} non trouvé dans l'API CJ (retour null)`);
        throw new Error(`Produit ${productId} non trouvé dans l'API CJ Dropshipping`);
      }
      
      // Vérifier si c'est une liste au lieu d'un objet unique
      if (Array.isArray(cjProduct) && cjProduct.length > 0) {
        this.logger.log(`⚠️ L'API a retourné une liste, utilisation du premier élément`);
        const details = this.mapApiProductToDetails(cjProduct[0]);
        this.setCachedDetails(productId, details);
        return details;
      }
      
      // Vérifier si c'est un objet avec une propriété data
      if (cjProduct.data && typeof cjProduct.data === 'object') {
        this.logger.log(`⚠️ L'API a retourné un objet avec propriété data`);
        const details = this.mapApiProductToDetails(cjProduct.data);
        this.setCachedDetails(productId, details);
        return details;
      }
      
      // Vérifier si le produit a un pid (structure attendue)
      if (!cjProduct.pid && !cjProduct.productId) {
        this.logger.error(`❌ Structure de produit invalide:`, JSON.stringify(cjProduct).substring(0, 200));
        throw new Error(`Structure de produit invalide retournée par l'API CJ pour ${productId}`);
      }
      
      const details = this.mapApiProductToDetails(cjProduct);
      
      // Mettre en cache les détails API
      this.setCachedDetails(productId, details);
      
      this.logger.log(`✅ Détails récupérés depuis l'API CJ pour ${productId}`);
      
      return details;
      
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des détails du produit ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Obtenir les détails d'un produit CJ avec tous ses reviews
   */
  async getProductDetailsWithReviews(pid: string) {
    this.logger.log(`📦 === RÉCUPÉRATION PRODUIT + REVIEWS (PID: ${pid}) ===`);
    
    try {
      // 1. Récupérer les détails du produit
      const productDetails = await this.getProductDetails(pid);
      
      if (!productDetails) {
        throw new Error('Produit introuvable');
      }
      
      // 2. Récupérer tous les reviews
      const client = await this.initializeClient();
      const reviews = await client.getAllProductReviews(pid);
      
      // 3. Calculer les statistiques
      const stats = calculateReviewStats(reviews);
      
      this.logger.log(`✅ Produit récupéré avec ${reviews.length} reviews`);
      this.logger.log(`📊 Note moyenne: ${stats.averageRating}/5`);
      
      return {
        ...productDetails,
        reviews: reviews,
        rating: stats.averageRating,
        totalReviews: stats.totalReviews,
        reviewStats: stats
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur récupération produit avec reviews:', error);
      throw error;
    }
  }

  /**
   * Récupérer le stock des variantes d'un produit avec cache (selon doc CJ)
   */
  async getProductVariantStock(pid: string, variantId?: string, countryCode?: string): Promise<any> {
    try {
      this.logger.log(`📦 Récupération du stock des variantes: ${pid}`);
      this.logger.log(`📝 Paramètres: variantId=${variantId}, countryCode=${countryCode}`);
      
      // Créer une clé de cache incluant tous les paramètres
      const stockKey = `stock_${pid}_${variantId || 'all'}_${countryCode || 'default'}`;
      
      // Vérifier le cache d'abord
      const cachedStock = this.getCachedStock(stockKey);
      if (cachedStock) {
        return cachedStock;
      }
      
      const client = await this.initializeClient();
      const stockData = await client.getProductVariantStock(pid, variantId, countryCode);
      
      // Mettre en cache les données de stock
      this.setCachedStock(stockKey, stockData);
      
      this.logger.log(`✅ Stock des variantes récupéré pour ${pid}`);
      
      return stockData;
      
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération du stock des variantes ${pid}:`, error);
      throw error;
    }
  }

  /**
   * Mapper un produit local vers la structure de détails
   */
  private mapLocalProductToDetails(localProduct: any): any {
    // Parser les variants JSON si c'est une string
    let variants = [];
    try {
      variants = typeof localProduct.variants === 'string' 
        ? JSON.parse(localProduct.variants) 
        : (localProduct.variants || []);
    } catch (e) {
      this.logger.warn('Erreur parsing variants:', e);
      variants = [];
    }

    return {
      pid: localProduct.cjProductId,
      productName: localProduct.name,
      productNameEn: localProduct.name,
      productSku: localProduct.productSku || localProduct.cjProductId,
      sellPrice: localProduct.price,
      productImage: this.extractFirstImage(localProduct.image),
      images: this.parseImageArray(localProduct.image),
      categoryName: localProduct.category,
      description: this.cleanDescription(localProduct.description || ''),
      variants: variants,
      rating: 0, // Pas de données de review locales
      totalReviews: 0,
      weight: localProduct.productWeight || 0,
      dimensions: localProduct.dimensions || '',
      brand: localProduct.brand || '',
      tags: localProduct.tags ? (typeof localProduct.tags === 'string' ? JSON.parse(localProduct.tags) : localProduct.tags) : [],
      reviews: [],
      
      // Champs supplémentaires de l'API disponibles en local
      productWeight: localProduct.productWeight,
      productUnit: localProduct.productUnit,
      productType: localProduct.productType,
      categoryId: localProduct.categoryId,
      // ✅ Champs douaniers (maintenant stockés)
      entryCode: localProduct.entryCode,
      entryName: localProduct.entryName,
      entryNameEn: localProduct.entryNameEn,
      // ✅ Matériau/Emballage complets (maintenant stockés)
      materialName: localProduct.materialName,
      materialNameEn: this.parseJsonField(localProduct.materialNameEn),
      materialKey: localProduct.materialKey,
      packingWeight: localProduct.packingWeight,
      packingName: localProduct.packingName,
      packingNameEn: this.parseJsonField(localProduct.packingNameEn),
      packingKey: localProduct.packingKey,
      // ✅ Attributs produit complets (maintenant stockés)
      productKey: localProduct.productKey,
      productKeyEn: localProduct.productKeyEn,
      productProSet: localProduct.productProSet 
        ? (typeof localProduct.productProSet === 'string' 
            ? JSON.parse(localProduct.productProSet) 
            : localProduct.productProSet)
        : null,
      productProEnSet: localProduct.productProEnSet 
        ? (typeof localProduct.productProEnSet === 'string' 
            ? JSON.parse(localProduct.productProEnSet) 
            : localProduct.productProEnSet)
        : null,
      addMarkStatus: localProduct.isFreeShipping ? 1 : 0,
      isFreeShipping: localProduct.isFreeShipping,
      suggestSellPrice: localProduct.suggestSellPrice,
      listedNum: localProduct.listedNum,
      status: '3', // Produit disponible
      supplierName: localProduct.supplierName || 'CJ Dropshipping',
      supplierId: localProduct.supplierId,
      // ✅ Personnalisation (maintenant stockée)
      customizationVersion: localProduct.customizationVersion,
      customizationJson1: localProduct.customizationJson1,
      customizationJson2: localProduct.customizationJson2,
      customizationJson3: localProduct.customizationJson3,
      customizationJson4: localProduct.customizationJson4,
      createrTime: localProduct.createrTime,
      // ✅ Média (maintenant stocké)
      productVideo: localProduct.productVideo 
        ? (typeof localProduct.productVideo === 'string' 
            ? JSON.parse(localProduct.productVideo) 
            : localProduct.productVideo)
        : null,
      // ✅ Informations de livraison (selon doc API CJ)
      // deliveryCycle peut être disponible dans les résultats de recherche
      deliveryCycle: localProduct.deliveryCycle || null,
      // Ces champs nécessitent un appel API séparé à /logistics/calculateFreight
      freeShippingCountries: null,
      defaultShippingMethod: null
    };
  }

  /**
   * Mapper un produit de l'API CJ vers la structure de détails  
   */
  private mapApiProductToDetails(cjProduct: any): any {
    // Vérifier que le produit n'est pas null
    if (!cjProduct) {
      this.logger.error('❌ mapApiProductToDetails: cjProduct est null');
      throw new Error('Produit null reçu de l\'API CJ');
    }
    
    // Utiliser productId si pid n'existe pas
    const pid = cjProduct.pid || cjProduct.productId || null;
    if (!pid) {
      this.logger.error('❌ mapApiProductToDetails: pid et productId sont absents', cjProduct);
      throw new Error('Produit sans ID (pid ou productId) reçu de l\'API CJ');
    }
    
    return {
      pid: pid,
      productName: cjProduct.productNameEn || cjProduct.productName,
      productNameEn: cjProduct.productNameEn || cjProduct.productName,
      productSku: cjProduct.productSku,
      sellPrice: cjProduct.sellPrice,
      productImage: Array.isArray(cjProduct.productImage) ? cjProduct.productImage[0] : cjProduct.productImage,
      images: Array.isArray(cjProduct.productImage) ? cjProduct.productImage : [cjProduct.productImage],
      categoryName: cjProduct.categoryName,
      description: this.cleanDescription(cjProduct.description || ''),
      variants: cjProduct.variants || [],
      rating: cjProduct.rating || 0,
      totalReviews: cjProduct.totalReviews || (cjProduct.reviews?.length || 0),
      weight: cjProduct.productWeight || cjProduct.weight || 0,
      dimensions: cjProduct.dimensions || '',
      brand: cjProduct.brand || '',
      tags: cjProduct.tags || [],
      reviews: [], // Les reviews seront récupérés séparément via getAllProductReviews()
      
      // Champs supplémentaires de l'API
      productWeight: cjProduct.productWeight,
      productUnit: cjProduct.productUnit,
      productType: cjProduct.productType,
      categoryId: cjProduct.categoryId,
      entryCode: cjProduct.entryCode,
      entryName: cjProduct.entryName,
      entryNameEn: cjProduct.entryNameEn,
      materialName: cjProduct.materialName,
      materialNameEn: cjProduct.materialNameEn,
      materialKey: cjProduct.materialKey,
      packingWeight: cjProduct.packingWeight,
      packingName: cjProduct.packingName,
      packingNameEn: cjProduct.packingNameEn,
      packingKey: cjProduct.packingKey,
      productKey: cjProduct.productKey,
      productKeyEn: cjProduct.productKeyEn,
      productProSet: cjProduct.productProSet,
      productProEnSet: cjProduct.productProEnSet,
      addMarkStatus: cjProduct.addMarkStatus,
      isFreeShipping: cjProduct.addMarkStatus === 1, // Mapper addMarkStatus → isFreeShipping
      suggestSellPrice: cjProduct.suggestSellPrice,
      listedNum: cjProduct.listedNum,
      status: cjProduct.status,
      supplierName: cjProduct.supplierName,
      supplierId: cjProduct.supplierId,
      customizationVersion: cjProduct.customizationVersion,
      customizationJson1: cjProduct.customizationJson1,
      customizationJson2: cjProduct.customizationJson2,
      customizationJson3: cjProduct.customizationJson3,
      customizationJson4: cjProduct.customizationJson4,
      createrTime: cjProduct.createrTime,
      productVideo: cjProduct.productVideo,
      // ✅ Informations de livraison (selon doc API CJ)
      // deliveryCycle peut être disponible dans les résultats de recherche mais pas toujours dans /product/query
      deliveryCycle: cjProduct.deliveryCycle || null,
      // Ces champs nécessitent un appel API séparé à /logistics/calculateFreight
      freeShippingCountries: null,
      defaultShippingMethod: null
    };
  }

  /**
   * Récupérer les produits CJ importés dans KAMRI
   */
  async getImportedProducts(filters?: { isFavorite?: boolean }): Promise<any[]> {
    try {
      this.logger.log('📦 Récupération des produits CJ importés...');
      
      // Construire la clause WHERE si des filtres sont fournis
      const whereClause: any = {};
      if (filters?.isFavorite !== undefined) {
        whereClause.isFavorite = filters.isFavorite;
      }
      
      // Récupérer tous les produits du magasin CJ
      const cjProducts = await this.prisma.cJProductStore.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });
      
      this.logger.log(`✅ ${cjProducts.length} produits CJ importés trouvés`);
      
      // Transformer les données pour l'interface
      return cjProducts.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        // Utiliser les vraies données stockées
        pid: product.cjProductId,
        productName: product.name,
        productNameEn: product.name,
        productSku: (product as any).productSku || product.cjProductId,
        productImage: product.image,
        sellPrice: product.price,
        categoryName: product.category,
        // Ajouter toutes les données détaillées
        weight: (product as any).productWeight || 0,
        dimensions: (product as any).dimensions || '',
        brand: (product as any).brand || '',
        tags: (product as any).tags ? JSON.parse((product as any).tags) : [],
        reviews: (product as any).reviews ? JSON.parse((product as any).reviews) : [],
        rating: 0,
        totalReviews: (product as any).reviews ? JSON.parse((product as any).reviews).length : 0,
        variants: (product as any).variants ? JSON.parse((product as any).variants) : [],
        status: product.status,
        isFavorite: product.isFavorite || false,
        cjProductId: product.cjProductId,
        // Ajouter les champs techniques
        productWeight: (product as any).productWeight,
        packingWeight: (product as any).packingWeight,
        productType: (product as any).productType,
        productUnit: (product as any).productUnit,
        productKeyEn: (product as any).productKeyEn,
        materialNameEn: (product as any).materialNameEn,
        packingNameEn: (product as any).packingNameEn,
        suggestSellPrice: (product as any).suggestSellPrice,
        listedNum: (product as any).listedNum,
        supplierName: (product as any).supplierName,
        createrTime: (product as any).createrTime,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }));
    } catch (error) {
      this.logger.error(`❌ Erreur récupération produits importés: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      this.logger.error('🔍 Détails de l\'erreur:', error);
      return [];
    }
  }

  /**
   * Fonction pour nettoyer le HTML de la description
   */
  private cleanDescription(htmlDescription: string): string {
    if (!htmlDescription) return 'N/A';
    
    // Supprimer les balises HTML
    let cleaned = htmlDescription
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
    
    // Limiter à 200 caractères pour l'affichage
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 200) + '...';
    }
    
    return cleaned;
  }

  // ===== MÉTHODES DE SYNCHRONISATION =====
  
  async syncProducts(filters?: any): Promise<{ synced: number; errors: number }> {
    // TODO: Implémenter la synchronisation des produits
    return { synced: 0, errors: 0 };
  }

  /**
   * 3.1 Inventory Inquiry - Obtenir le stock d'un variant par VID
   */
  async getInventory(vid: string): Promise<{ success: boolean; stock: CJVariantStock[] }> {
    this.logger.log(`📦 Récupération inventaire pour variant: ${vid}`);
    
    try {
      const client = await this.initializeClient();
      const stocks = await client.getInventoryByVid(vid);
      
      return {
        success: true,
        stock: stocks
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération inventaire ${vid}:`, error);
      return {
        success: false,
        stock: []
      };
    }
  }

  /**
   * 3.2 Query Inventory by SKU - Obtenir le stock par SKU
   */
  async getInventoryBySku(sku: string): Promise<{ success: boolean; stock: CJVariantStock[] }> {
    this.logger.log(`📦 Récupération inventaire pour SKU: ${sku}`);
    
    try {
      const client = await this.initializeClient();
      const stocks = await client.getInventoryBySku(sku);
      
      return {
        success: true,
        stock: stocks
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération inventaire SKU ${sku}:`, error);
      return {
        success: false,
        stock: []
      };
    }
  }

  async syncInventory(productIds: string[]): Promise<{ updated: number; errors: number }> {
    // TODO: Implémenter la synchronisation de l'inventaire
    return { updated: 0, errors: 0 };
  }

  /**
   * Extraire la première image d'un champ image (peut être string JSON ou URL simple)
   */
  private extractFirstImage(imageField: any): string {
    if (!imageField) return '';
    
    // Si c'est déjà un array
    if (Array.isArray(imageField)) {
      return imageField[0] || '';
    }
    
    // Si c'est une string qui ressemble à du JSON
    if (typeof imageField === 'string') {
      if (imageField.startsWith('[')) {
        try {
          const parsed = JSON.parse(imageField);
          return Array.isArray(parsed) ? (parsed[0] || '') : imageField;
        } catch (e) {
          return imageField;
        }
      }
      return imageField;
    }
    
    return String(imageField);
  }

  /**
   * Parser le champ image en array d'URLs
   */
  private parseImageArray(imageField: any): string[] {
    if (!imageField) return [];
    
    // Si c'est déjà un array
    if (Array.isArray(imageField)) {
      return imageField;
    }
    
    // Si c'est une string qui ressemble à du JSON
    if (typeof imageField === 'string') {
      if (imageField.startsWith('[')) {
        try {
          const parsed = JSON.parse(imageField);
          return Array.isArray(parsed) ? parsed : [imageField];
        } catch (e) {
          return [imageField];
        }
      }
      return [imageField];
    }
    
    return [String(imageField)];
  }

  /**
   * Parser les champs JSON qui peuvent être des chaînes
   */
  private parseJsonField(field: any): any {
    if (!field) return null;
    
    if (typeof field === 'string' && field.startsWith('[')) {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed.join(', ') : parsed;
      } catch (e) {
        return field;
      }
    }
    
    return field;
  }

  // ✅ NOUVELLES MÉTHODES DE CACHE AMÉLIORÉES

  /**
   * Obtenir une entrée du cache de recherche
   */
  private getCachedSearch(cacheKey: string): CJProduct[] | null {
    const cached = this.searchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      this.cacheStats.searchHits++;
      this.logger.log(`📦 Cache HIT pour recherche: ${cacheKey}`);
      return cached.data;
    }
    
    if (cached) {
      this.searchCache.delete(cacheKey); // Nettoyer le cache expiré
    }
    
    this.cacheStats.searchMisses++;
    this.logger.log(`❌ Cache MISS pour recherche: ${cacheKey}`);
    return null;
  }

  /**
   * Mettre en cache une recherche
   */
  private setCachedSearch(cacheKey: string, products: CJProduct[], searchParams: any): void {
    this.searchCache.set(cacheKey, {
      data: products,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL.SEARCH,
      searchParams
    });
    this.logger.log(`💾 Mise en cache recherche: ${cacheKey} (${products.length} produits)`);
  }

  /**
   * Obtenir un résultat de recherche V2 depuis le cache
   */
  private getCachedSearchResult(cacheKey: string): CJProductSearchResult | null {
    const cached = this.searchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      // Convertir les données du cache en CJProductSearchResult
      const products = cached.data as CJProduct[];
      this.cacheStats.searchHits++;
      this.logger.log(`📦 Cache HIT pour recherche V2: ${cacheKey}`);
      return {
        products: products,
        total: cached.searchParams?.total || products.length, // ✅ Utiliser le total stocké dans searchParams
        pageNumber: cached.searchParams?.pageNumber || cached.searchParams?.pageNum || 1,
        pageSize: cached.searchParams?.pageSize || 10,
        totalPages: cached.searchParams?.totalPages || 0,
        relatedCategories: cached.searchParams?.relatedCategories || [],
        warehouses: cached.searchParams?.warehouses || [],
        keyWord: cached.searchParams?.keyWord || cached.searchParams?.keyword || cached.searchParams?.productNameEn,
        searchHit: cached.searchParams?.searchHit || ''
      };
    }
    
    if (cached) {
      this.searchCache.delete(cacheKey);
    }
    
    this.cacheStats.searchMisses++;
    this.logger.log(`❌ Cache MISS pour recherche V2: ${cacheKey}`);
    return null;
  }

  /**
   * Mettre en cache un résultat de recherche V2
   */
  private setCachedSearchResult(cacheKey: string, result: CJProductSearchResult, searchParams: any): void {
    // Stocker les produits dans le cache
    this.searchCache.set(cacheKey, {
      data: result.products,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL.SEARCH,
      searchParams: {
        ...searchParams,
        total: result.total,
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        relatedCategories: result.relatedCategories,
        warehouses: result.warehouses,
        keyWord: result.keyWord,
        searchHit: result.searchHit
      }
    });
    this.logger.log(`💾 Mise en cache recherche V2: ${cacheKey} (${result.products.length} produits, total: ${result.total})`);
  }

  /**
   * Obtenir les détails d'un produit depuis le cache
   */
  private getCachedDetails(pid: string): any | null {
    const cached = this.detailsCache.get(pid);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      this.cacheStats.detailsHits++;
      this.logger.log(`📦 Cache HIT pour détails: ${pid}`);
      return cached.data;
    }
    
    if (cached) {
      this.detailsCache.delete(pid);
    }
    
    this.cacheStats.detailsMisses++;
    return null;
  }

  /**
   * Mettre en cache les détails d'un produit
   */
  private setCachedDetails(pid: string, details: any): void {
    this.detailsCache.set(pid, {
      data: details,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL.DETAILS
    });
    this.logger.log(`💾 Mise en cache détails: ${pid}`);
  }

  /**
   * Obtenir le stock depuis le cache
   */
  private getCachedStock(stockKey: string): any | null {
    const cached = this.stockCache.get(stockKey);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      this.cacheStats.stockHits++;
      this.logger.log(`📦 Cache HIT pour stock: ${stockKey}`);
      return cached.data;
    }
    
    if (cached) {
      this.stockCache.delete(stockKey);
    }
    
    this.cacheStats.stockMisses++;
    return null;
  }

  /**
   * Mettre en cache le stock
   */
  private setCachedStock(stockKey: string, stock: any): void {
    this.stockCache.set(stockKey, {
      data: stock,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL.STOCK
    });
    this.logger.log(`💾 Mise en cache stock: ${stockKey}`);
  }

  /**
   * Nettoyer tous les caches expirés
   */
  public cleanExpiredCache(): void {
    const now = Date.now();
    
    // Nettoyer le cache de recherche
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.searchCache.delete(key);
      }
    }
    
    // Nettoyer le cache des détails
    for (const [key, value] of this.detailsCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.detailsCache.delete(key);
      }
    }
    
    // Nettoyer le cache du stock
    for (const [key, value] of this.stockCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.stockCache.delete(key);
      }
    }
    
    // Nettoyer le cache des catégories
    for (const [key, value] of this.categoriesCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.categoriesCache.delete(key);
      }
    }
    
    this.logger.log('🧹 Nettoyage des caches expirés terminé');
  }

  /**
   * Obtenir les statistiques du cache
   */
  public getCacheStats(): any {
    return {
      ...this.cacheStats,
      cacheSizes: {
        search: this.searchCache.size,
        details: this.detailsCache.size,
        stock: this.stockCache.size,
        categories: this.categoriesCache.size
      },
      hitRates: {
        search: this.cacheStats.searchHits / (this.cacheStats.searchHits + this.cacheStats.searchMisses) * 100,
        details: this.cacheStats.detailsHits / (this.cacheStats.detailsHits + this.cacheStats.detailsMisses) * 100,
        stock: this.cacheStats.stockHits / (this.cacheStats.stockHits + this.cacheStats.stockMisses) * 100,
        categories: this.cacheStats.categoriesHits / (this.cacheStats.categoriesHits + this.cacheStats.categoriesMisses) * 100,
      }
    };
  }

  /**
   * Synchroniser le stock de tous les variants d'un produit
   * @param productId ID du produit KAMRI (Product ou CJProductStore)
   */
  async syncProductVariantsStock(productId: string) {
    this.logger.log(`🔄 === SYNCHRONISATION STOCK VARIANTS (Product: ${productId}) ===`);
    
    try {
      // Essayer d'abord de trouver dans Product (table principale)
      let product = await this.prisma.product.findUnique({
        where: { id: productId }
      });
      
      let cjProductId: string | null = null;
      let productName = '';
      
      if (product && product.cjProductId) {
        // Produit trouvé dans Product
        cjProductId = product.cjProductId;
        productName = product.name;
        this.logger.log(`📦 Produit trouvé dans Product: ${productName} (CJ PID: ${cjProductId})`);
      } else {
        // Essayer dans CJProductStore
        const cjStoreProduct = await this.prisma.cJProductStore.findUnique({
          where: { id: productId }
        });
        
        if (cjStoreProduct && cjStoreProduct.cjProductId) {
          cjProductId = cjStoreProduct.cjProductId;
          productName = cjStoreProduct.name;
          this.logger.log(`📦 Produit trouvé dans CJProductStore: ${productName} (CJ PID: ${cjProductId})`);
          
          // Trouver le produit KAMRI associé
          product = await this.prisma.product.findFirst({
            where: { cjProductId: cjProductId }
          });
        }
      }
      
      if (!cjProductId) {
        throw new Error('Produit introuvable ou sans ID CJ');
      }
      
      // Initialiser le client CJ
      const client = await this.initializeClient();
      
      // Récupérer les variants avec stock depuis CJ (méthode optimisée)
      const variantsWithStock = await client.getProductVariantsWithStock(cjProductId);
      
      if (!variantsWithStock || variantsWithStock.length === 0) {
        this.logger.warn('⚠️ Aucun variant trouvé sur CJ');
        return { 
          success: false, 
          message: 'Aucun variant trouvé',
          updated: 0,
          failed: 0,
          total: 0
        };
      }
      
      this.logger.log(`📊 ${variantsWithStock.length} variants trouvés sur CJ`);
      
      let updated = 0;
      let failed = 0;
      
      // Si pas de produit KAMRI, on ne peut pas créer les variants
      if (!product) {
        this.logger.warn('⚠️ Produit KAMRI non trouvé - les variants ne peuvent pas être créés dans Product');
        return {
          success: false,
          message: 'Produit KAMRI non trouvé. Importez d\'abord le produit dans Product.',
          updated: 0,
          failed: 0,
          total: variantsWithStock.length
        };
      }
      
      // Mettre à jour chaque variant
      for (const variant of variantsWithStock) {
        try {
          // Parser variantKey
          let parsedKey = variant.variantKey;
          try {
            if (parsedKey && parsedKey.startsWith('[')) {
              const parsed = JSON.parse(parsedKey);
              parsedKey = Array.isArray(parsed) ? parsed.join('-') : parsedKey;
            }
          } catch {
            // Garder la valeur originale
          }
          
          const variantData = {
            name: variant.variantNameEn || variant.variantName || `Variant ${variant.variantSku}`,
            sku: variant.variantSku,
            price: variant.variantSellPrice,
            weight: variant.variantWeight,
            dimensions: variant.variantLength && variant.variantWidth && variant.variantHeight
              ? JSON.stringify({
                  length: variant.variantLength,
                  width: variant.variantWidth,
                  height: variant.variantHeight,
                  volume: variant.variantVolume
                })
              : null,
            image: variant.variantImage,
            stock: variant.stock || 0,
            properties: JSON.stringify({
              key: parsedKey,
              property: variant.variantProperty,
              standard: variant.variantStandard,
              unit: variant.variantUnit
            }),
            status: (variant.stock || 0) > 0 ? 'available' : 'out_of_stock',
            lastSyncAt: new Date()
          };
          
          // Créer/mettre à jour le variant dans ProductVariant
          await this.prisma.productVariant.upsert({
            where: {
              cjVariantId: variant.vid
            },
            update: variantData,
            create: {
              ...variantData,
              cjVariantId: variant.vid,
              productId: product.id
            }
          });
          
          // Mettre à jour le champ variants JSON dans Product (si présent)
          if (product.variants) {
            try {
              const currentVariants = typeof product.variants === 'string' 
                ? JSON.parse(product.variants) 
                : product.variants;
              const updatedVariants = Array.isArray(currentVariants) 
                ? currentVariants.map((v: any) => 
                    v.vid === variant.vid ? { ...v, stock: variant.stock, warehouseStock: variant.warehouseStock } : v
                  )
                : currentVariants;
              
              await this.prisma.product.update({
                where: { id: product.id },
                data: {
                  variants: JSON.stringify(updatedVariants)
                }
              });
            } catch (e) {
              // Ignorer les erreurs de parsing
            }
          }
          
          updated++;
          this.logger.log(`  ✅ Variant ${variant.vid}: stock ${variant.stock}, prix ${variant.variantSellPrice}`);
          
        } catch (error) {
          failed++;
          this.logger.error(`  ❌ Erreur MAJ variant ${variant.vid}:`, error);
        }
      }
      
      this.logger.log(`🎉 Synchronisation terminée: ${updated} réussis, ${failed} échecs sur ${variantsWithStock.length} total`);
      
      return {
        success: failed === 0,
        updated,
        failed,
        total: variantsWithStock.length,
        message: `${updated} variants synchronisés${failed > 0 ? `, ${failed} échecs` : ''}`
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur synchronisation stock variants:', error);
      throw error;
    }
  }

  /**
   * Migrer les variants JSON vers la table ProductVariant pour tous les produits
   * Utile pour les produits importés avant la mise en place de ProductVariant
   * @param force Si true, recrée les variants même s'ils existent déjà
   */
  async migrateAllVariantsToDatabase(force: boolean = false) {
    this.logger.log('🔄 === MIGRATION VARIANTS JSON → ProductVariant ===');
    
    try {
      // Récupérer tous les produits CJ qui ont des variants JSON
      const productsWithVariants = await this.prisma.product.findMany({
        where: {
          AND: [
            { source: 'cj-dropshipping' },
            { variants: { not: null } }
          ]
        },
        select: {
          id: true,
          name: true,
          cjProductId: true,
          variants: true,
          productVariants: {
            select: { id: true }
          }
        }
      });

      this.logger.log(`📦 ${productsWithVariants.length} produits CJ trouvés avec variants JSON`);

      let migratedProducts = 0;
      let migratedVariants = 0;
      let skippedProducts = 0;

      for (const product of productsWithVariants) {
        try {
          // Vérifier si le produit a déjà des productVariants
          if (product.productVariants && product.productVariants.length > 0 && !force) {
            this.logger.log(`⏭️  Produit "${product.name}" a déjà ${product.productVariants.length} variants, skip (utilisez force=true pour recréer)`);
            skippedProducts++;
            continue;
          }

          // Parser les variants JSON
          let variants = [];
          try {
            variants = JSON.parse(product.variants);
            if (!Array.isArray(variants)) {
              this.logger.warn(`⚠️  Variants non-array pour "${product.name}", skip`);
              continue;
            }
          } catch (e) {
            this.logger.warn(`❌ Erreur parsing JSON variants pour "${product.name}", skip`);
            continue;
          }

          if (variants.length === 0) {
            this.logger.log(`⏭️  Aucun variant dans JSON pour "${product.name}", skip`);
            continue;
          }

          this.logger.log(`\n📦 Migration de ${variants.length} variants pour "${product.name}"...`);

          let createdCount = 0;
          for (const variant of variants) {
            try {
              // Parser variantKey
              let parsedKey = variant.variantKey || variant.variantProperty;
              try {
                if (parsedKey && typeof parsedKey === 'string' && parsedKey.startsWith('[')) {
                  const parsed = JSON.parse(parsedKey);
                  parsedKey = Array.isArray(parsed) ? parsed.join('-') : parsedKey;
                }
              } catch {
                // Garder la valeur originale
              }

              const variantData = {
                productId: product.id,
                cjVariantId: variant.vid || variant.variantId || null,
                name: variant.variantNameEn || variant.variantName || variant.name || `Variant ${variant.variantSku || createdCount + 1}`,
                sku: variant.variantSku || variant.sku,
                price: parseFloat(variant.variantSellPrice || variant.price || 0),
                weight: parseFloat(variant.variantWeight || variant.weight || 0),
                dimensions: variant.variantLength && variant.variantWidth && variant.variantHeight
                  ? JSON.stringify({
                      length: variant.variantLength,
                      width: variant.variantWidth,
                      height: variant.variantHeight,
                      volume: variant.variantVolume
                    })
                  : null,
                image: variant.variantImage || variant.image,
                stock: parseInt(variant.stock || variant.variantStock || 0, 10), // ✅ Stock en premier !
                properties: JSON.stringify({
                  key: parsedKey,
                  property: variant.variantProperty,
                  standard: variant.variantStandard,
                  unit: variant.variantUnit
                }),
                status: (variant.stock || variant.variantStock || 0) > 0 ? 'available' : 'out_of_stock', // ✅ Stock en premier !
                isActive: true,
                lastSyncAt: new Date()
              };

              // Créer ou mettre à jour le variant
              if (variant.vid || variant.variantId) {
                await this.prisma.productVariant.upsert({
                  where: {
                    cjVariantId: variant.vid || variant.variantId
                  },
                  update: variantData,
                  create: variantData
                });
              } else {
                // Pas de vid, créer directement
                await this.prisma.productVariant.create({
                  data: variantData
                });
              }

              createdCount++;
            } catch (e) {
              this.logger.error(`❌ Erreur création variant pour "${product.name}":`, e instanceof Error ? e.message : String(e));
            }
          }

          if (createdCount > 0) {
            this.logger.log(`✅ ${createdCount} variants créés pour "${product.name}"`);
            migratedProducts++;
            migratedVariants += createdCount;
          }

        } catch (e) {
          this.logger.error(`❌ Erreur migration produit "${product.name}":`, e instanceof Error ? e.message : String(e));
        }
      }

      const summary = {
        totalProducts: productsWithVariants.length,
        migratedProducts,
        migratedVariants,
        skippedProducts,
        message: `✅ Migration terminée : ${migratedVariants} variants créés pour ${migratedProducts} produits`
      };

      this.logger.log('\n🎉 === MIGRATION TERMINÉE ===');
      this.logger.log(`📊 Résumé:`);
      this.logger.log(`   - Produits traités: ${productsWithVariants.length}`);
      this.logger.log(`   - Produits migrés: ${migratedProducts}`);
      this.logger.log(`   - Variants créés: ${migratedVariants}`);
      this.logger.log(`   - Produits ignorés: ${skippedProducts}`);

      return summary;

    } catch (error) {
      this.logger.error('❌ Erreur migration variants:', error);
      throw error;
    }
  }
}

