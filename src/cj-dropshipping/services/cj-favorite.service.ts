import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DuplicatePreventionService } from '../../common/services/duplicate-prevention.service';
import { CJAPIClient } from '../cj-api-client';
import { CJSyncProgressEvent, CJSyncResult } from '../interfaces/cj-sync-progress.interface';

@Injectable()
export class CJFavoriteService {
  private readonly logger = new Logger(CJFavoriteService.name);

  constructor(
    private prisma: PrismaService,
    private cjApiClient: CJAPIClient,
    private duplicateService: DuplicatePreventionService
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
   * Suivre les catégories non mappées
   */
  private async trackUnmappedCategory(category: string): Promise<void> {
    try {
      // Trouver le fournisseur CJ
      const supplier = await this.prisma.supplier.findFirst({
        where: { name: 'CJ Dropshipping' }
      });
      
      if (!supplier) {
        this.logger.warn('⚠️ Fournisseur CJ Dropshipping introuvable');
        return;
      }
      
      // Vérifier si la catégorie est déjà mappée
      const mapping = await this.prisma.categoryMapping.findFirst({
        where: {
          supplierId: supplier.id,
          externalCategory: category
        }
      });
      
      if (mapping) {
        // Catégorie déjà mappée, ne rien faire
        return;
      }
      
      // Compter les produits avec cette catégorie
      const productCount = await this.prisma.cJProductStore.count({
        where: { category }
      });
      
      // Créer ou mettre à jour l'enregistrement unmappedExternalCategory
      await this.prisma.unmappedExternalCategory.upsert({
        where: {
          supplierId_externalCategory: {
            supplierId: supplier.id,
            externalCategory: category
          }
        },
        create: {
          supplierId: supplier.id,
          externalCategory: category,
          productCount
        },
        update: {
          productCount
          // updatedAt est géré automatiquement par Prisma (@updatedAt)
        }
      });
      
      this.logger.log(`📊 Catégorie non mappée enregistrée: ${category} (${productCount} produits)`);
    } catch (error) {
      this.logger.error(`❌ Erreur tracking catégorie non mappée:`, error);
      // Ne pas bloquer l'import si cette opération échoue
    }
  }

  /**
   * Récupère la liste de mes produits (favoris CJ) avec pagination complète
   */
  async getMyProducts(params: {
    keyword?: string;
    categoryId?: string;
    startAt?: string;
    endAt?: string;
    isListed?: number;
    visiable?: number;
    hasPacked?: number;
    hasVirPacked?: number;
  } = {}): Promise<{ success: boolean; products: any[]; total: number }> {
    this.logger.log('📦 === DÉBUT RÉCUPÉRATION FAVORIS CJ (AVEC PAGINATION) ===');
    this.logger.log('📝 Paramètres de recherche:', JSON.stringify(params, null, 2));
    
    try {
      const client = await this.initializeClient();
      this.logger.log('🔗 Client CJ initialisé, appel API avec pagination complète...');
      
      // ✅ Récupération de TOUS les favoris (toutes les pages)
      this.logger.log('📡 Récupération de tous les favoris CJ (toutes les pages)...');
      const myProducts = await client.getMyProducts({
        keyword: params.keyword,
        categoryId: params.categoryId,
        startAt: params.startAt,
        endAt: params.endAt,
        isListed: params.isListed,
        visiable: params.visiable,
        hasPacked: params.hasPacked,
        hasVirPacked: params.hasVirPacked,
        pageSize: 100 // Max par page
      });
      
      if (!myProducts || myProducts.length === 0) {
        this.logger.log('ℹ️ Aucun favori trouvé');
        return {
          success: true,
          products: [],
          total: 0
        };
      }
      
      this.logger.log(`📦 ${myProducts.length} favoris récupérés depuis CJ (toutes les pages)`);
      
      // Transformer les données selon la structure CJ (myProduct/query API)
      const transformedProducts = myProducts.map((product: any) => {
        return {
          pid: product.productId,
          productId: product.productId, // ✅ Garder productId pour dédoublonnage
          productName: product.nameEn || product.productName,
          productNameEn: product.nameEn || product.productName,
          productSku: product.sku || product.productSku,
          sellPrice: product.sellPrice,
          productImage: product.bigImage || product.productImage,
          categoryName: product.defaultArea || product.categoryName || 'CJ Dropshipping',
          description: this.cleanDescription(product.description || ''),
          variants: product.variants || [],
          rating: product.rating || 0,
          totalReviews: product.totalReviews || product.reviews?.length || 0,
          weight: product.weight || product.productWeight || 0,
          dimensions: product.dimensions || '',
          brand: product.brand || '',
          tags: product.tags || [],
          reviews: product.reviews || [],
          // Informations supplémentaires
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
          status: product.status
        };
      });
      
      this.logger.log(`✅ ${transformedProducts.length} favoris transformés`);
      
      return {
        success: true,
        products: transformedProducts,
        total: transformedProducts.length
      };
    } catch (error) {
      this.logger.error('❌ === ERREUR RÉCUPÉRATION FAVORIS ===');
      this.logger.error(`💥 Erreur: ${error instanceof Error ? error.message : String(error)}`);
      this.logger.error(`📊 Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
      this.logger.error('🔍 === FIN ERREUR RÉCUPÉRATION FAVORIS ===');
      throw error;
    }
  }

  /**
   * Synchroniser les favoris CJ avec KAMRI (avec pagination complète)
   */
  async syncFavorites(): Promise<{ success: boolean; synced: number; failed: number; total: number; errors: Array<{ pid: string; name: string; error: string }>; message: string }> {
    this.logger.log('🔄 === DÉBUT SYNCHRONISATION FAVORIS CJ (AVEC PAGINATION) ===');
    
    try {
      // Initialisation du client
      const client = await this.initializeClient();
      
      // ✅ Récupération de TOUS les favoris (toutes les pages)
      this.logger.log('📡 Récupération de tous les favoris CJ...');
      const myProducts = await client.getMyProducts({
        pageSize: 100 // Max par page
      });
      
      if (!myProducts || myProducts.length === 0) {
        return {
          success: true,
          synced: 0,
          failed: 0,
          total: 0,
          errors: [],
          message: 'Aucun favori trouvé sur CJ'
        };
      }
      
      this.logger.log(`📦 ${myProducts.length} favoris récupérés depuis CJ`);
      
      // Dédoublonnage par productId (au lieu de pid)
      const uniqueProducts = Array.from(
        new Map(myProducts.map(p => [p.productId || p.pid, p])).values()
      );
      
      this.logger.log(`🔍 ${uniqueProducts.length} favoris uniques après dédoublonnage`);
      
      // Import avec progression
      const total = uniqueProducts.length;
      let synced = 0;
      let failed = 0;
      const errors: Array<{ pid: string; name: string; error: string }> = [];
      
      // Obtenir le tier pour le délai
      const config = await this.prisma.cJConfig.findFirst();
      const tier = config?.tier || 'free';
      const delay = this.getTierDelay(tier);
      
      for (let i = 0; i < uniqueProducts.length; i++) {
        const product = uniqueProducts[i];
        const pid = product.productId || product.pid;
        const progress = Math.round(((i + 1) / total) * 100);
        
        this.logger.log(`🔄 [${i + 1}/${total}] (${progress}%) - Import ${product.nameEn || product.productNameEn || pid}...`);
        
        try {
          await this.importProduct(pid, undefined, 0, true);
          synced++;
          this.logger.log(`✅ [${i + 1}/${total}] Import réussi`);
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            pid: pid,
            name: product.nameEn || product.productNameEn || pid,
            error: errorMessage
          });
          this.logger.error(`❌ [${i + 1}/${total}] Échec: ${errorMessage}`);
        }
        
        // Rate limiting adapté selon le tier
        if (i < uniqueProducts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      this.logger.log('🎉 === FIN SYNCHRONISATION FAVORIS CJ ===');
      this.logger.log(`📊 Résultat final : ${synced} réussis, ${failed} échecs sur ${total} total`);
      
      if (errors.length > 0) {
        this.logger.error(`❌ ${errors.length} erreurs détaillées:`, JSON.stringify(errors, null, 2));
      }
      
      return {
        success: failed === 0,
        synced,
        failed,
        total,
        errors,
        message: `${synced}/${total} favoris synchronisés${failed > 0 ? ` (${failed} échecs)` : ''}`
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur synchronisation favoris:', error);
      throw error;
    }
  }

  /**
   * Helper pour obtenir le délai selon le tier
   */
  private getTierDelay(tier: string): number {
    const delays: { [key: string]: number } = {
      'advanced': 500,   // 0.5s
      'prime': 1000,     // 1s
      'plus': 1500,      // 1.5s
      'free': 3000       // 3s
    };
    
    return delays[tier] || 3000;
  }

  /**
   * Synchroniser les favoris CJ avec callback de progression
   * @param onProgress Fonction callback pour envoyer la progression
   */
  async syncFavoritesWithProgress(
    onProgress: (event: CJSyncProgressEvent) => void
  ): Promise<CJSyncResult> {
    this.logger.log('🔄 === DÉBUT SYNCHRONISATION FAVORIS CJ (AVEC PROGRESSION) ===');
    
    const startTime = Date.now();
    
    try {
      // ===== ÉTAPE 1 : RÉCUPÉRATION =====
      onProgress({
        stage: 'fetching',
        current: 0,
        total: 0,
        percentage: 0,
        productName: 'Récupération de vos favoris CJ...',
        synced: 0,
        failed: 0,
        estimatedTimeRemaining: 0,
        speed: 0
      });
      
      // Initialisation du client
      const client = await this.initializeClient();
      
      // Récupération de TOUS les favoris (toutes les pages)
      this.logger.log('📡 Récupération de tous les favoris CJ...');
      const myProducts = await client.getMyProducts({
        pageSize: 100
      });
      
      if (!myProducts || myProducts.length === 0) {
        const result: CJSyncResult = {
          done: true,
          success: false,
          synced: 0,
          failed: 0,
          total: 0,
          duration: (Date.now() - startTime) / 1000,
          message: 'Aucun favori trouvé sur CJ'
        };
        return result;
      }
      
      this.logger.log(`📦 ${myProducts.length} favoris récupérés depuis CJ`);
      
      // Dédoublonnage
      const uniqueProducts = Array.from(
        new Map(myProducts.map(p => [p.productId || p.pid, p])).values()
      );
      
      this.logger.log(`🔍 ${uniqueProducts.length} favoris uniques après dédoublonnage`);
      
      // ===== ÉTAPE 2 : IMPORT =====
      const total = uniqueProducts.length;
      let synced = 0;
      let failed = 0;
      const errors: Array<{ pid: string; name: string; error: string }> = [];
      
      // Obtenir le tier pour le délai
      const config = await this.prisma.cJConfig.findFirst();
      const tier = config?.tier || 'free';
      const delay = this.getTierDelay(tier);
      
      // Import avec progression
      for (let i = 0; i < uniqueProducts.length; i++) {
        const product = uniqueProducts[i];
        const pid = product.productId || product.pid;
        const productName = product.nameEn || product.productNameEn || pid;
        
        // Calcul du temps écoulé et estimation
        const elapsed = Date.now() - startTime;
        const avgTimePerProduct = elapsed / (i + 1);
        const remainingProducts = total - i - 1;
        const estimatedTimeRemaining = Math.round((remainingProducts * avgTimePerProduct) / 1000);
        const speed = (i + 1) / (elapsed / 1000); // produits par seconde
        const percentage = Math.round(((i + 1) / total) * 100);
        
        // Envoyer la progression AVANT l'import
        onProgress({
          stage: 'importing',
          current: i + 1,
          total: total,
          percentage: percentage,
          productName: productName,
          synced: synced,
          failed: failed,
          estimatedTimeRemaining: estimatedTimeRemaining,
          speed: parseFloat(speed.toFixed(2))
        });
        
        this.logger.log(`🔄 [${i + 1}/${total}] (${percentage}%) - Import ${productName}...`);
        
        // Import du produit
        try {
          await this.importProduct(pid, undefined, 0, true);
          synced++;
          this.logger.log(`✅ [${i + 1}/${total}] Import réussi`);
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            pid: pid,
            name: productName,
            error: errorMessage
          });
          this.logger.error(`❌ [${i + 1}/${total}] Échec: ${errorMessage}`);
        }
        
        // Rate limiting (sauf pour le dernier)
        if (i < uniqueProducts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // ===== RÉSULTAT FINAL =====
      const duration = (Date.now() - startTime) / 1000;
      
      this.logger.log('🎉 === FIN SYNCHRONISATION FAVORIS CJ ===');
      this.logger.log(`📊 Résultat final : ${synced} réussis, ${failed} échecs sur ${total} total`);
      this.logger.log(`⏱️ Durée totale : ${Math.round(duration)}s`);
      
      if (errors.length > 0) {
        this.logger.error(`❌ ${errors.length} erreurs détaillées:`, JSON.stringify(errors, null, 2));
      }
      
      const result: CJSyncResult = {
        done: true,
        success: failed === 0,
        synced,
        failed,
        total,
        duration: Math.round(duration),
        errors: errors.length > 0 ? errors : undefined,
        message: `${synced}/${total} favoris synchronisés${failed > 0 ? ` (${failed} échecs)` : ''} en ${Math.round(duration)}s`
      };
      
      return result;
      
    } catch (error) {
      this.logger.error('❌ Erreur synchronisation favoris:', error);
      
      const duration = (Date.now() - startTime) / 1000;
      const result: CJSyncResult = {
        done: true,
        success: false,
        synced: 0,
        failed: 0,
        total: 0,
        duration: Math.round(duration),
        message: `Erreur de synchronisation: ${error instanceof Error ? error.message : String(error)}`
      };
      
      return result;
    }
  }

  /**
   * Importer un produit CJ vers KAMRI
   */
  async importProduct(pid: string, categoryId?: string, margin: number = 0, isFavorite: boolean = false): Promise<any> {
    this.logger.log('🔍 === DÉBUT IMPORT PRODUIT CJ ===');
    this.logger.log('📝 Paramètres:', { pid, categoryId, margin, isFavorite });
    
    // 🚨 VALIDATION : Rejeter les PID invalides
    if (!pid || 
        pid === 'undefined' || 
        pid === 'null' || 
        pid === 'imported' || 
        pid === 'available' || 
        pid === 'selected' || 
        pid === 'pending' ||
        pid.trim() === '') {
      this.logger.error(`❌ PID invalide reçu: "${pid}" - Ignoré pour éviter les appels API inutiles`);
      this.logger.error('🔍 Stack trace:', new Error().stack);
      return {
        success: false,
        message: `PID invalide: "${pid}" - Ce n'est pas un ID de produit CJ valide`,
        product: null
      };
    }
    
    try {
      this.logger.log('🔗 Initialisation du client CJ...');
      const client = await this.initializeClient();
      
      this.logger.log('📦 Récupération des détails du produit CJ...');
      
      // 🔧 UTILISER getProductDetails avec vidéos incluses
      const cjProduct = await client.getProductDetails(pid, true); // true = inclure les vidéos
      
      // Vérifier que le produit est valide
      if (!cjProduct || !cjProduct.pid) {
        this.logger.error(`❌ Produit ${pid} non trouvé dans l'API CJ (retour null ou sans pid)`);
        throw new Error(`Produit ${pid} non trouvé dans l'API CJ Dropshipping`);
      }
      
      this.logger.log('📦 Produit CJ récupéré:', {
        name: (cjProduct as any).productNameEn || (cjProduct as any).productName,
        price: (cjProduct as any).sellPrice,
        category: (cjProduct as any).categoryName,
        hasImage: !!(cjProduct as any).productImage
      });
      
      // Créer le produit KAMRI
      // 🔧 CORRECTION : Gérer les prix avec plage (ex: "2.4-12.81")
      let originalPrice = 0;
      const priceStr = String((cjProduct as any).sellPrice || '');
      console.log(`💰 Prix brut reçu: "${priceStr}" (type: ${typeof (cjProduct as any).sellPrice})`);
      
      if (priceStr.includes('-')) {
        // Prendre le prix minimum de la plage
        const priceRange = priceStr.split('-');
        originalPrice = Number(priceRange[0]) || 0;
        console.log(`💰 Prix plage détectée: ${priceRange[0]} → ${originalPrice}`);
      } else {
        originalPrice = Number(priceStr) || 0;
        console.log(`💰 Prix simple: ${priceStr} → ${originalPrice}`);
      }
      const sellingPrice = originalPrice; // Utiliser le prix original de CJ
      
      this.logger.log('💰 Prix calculés:', {
        originalPrice,
        sellingPrice
      });
      
      // ✅ SAUVEGARDER SEULEMENT LA CATÉGORIE EXTERNE (comme les produits statiques)
      this.logger.log('🔍 Catégorie externe CJ:', (cjProduct as any).categoryName);
      
      this.logger.log('💾 Sauvegarde dans la base de données...');
      
      // ✅ NOUVELLE APPROCHE ANTI-DOUBLONS : Vérifier d'abord les doublons
      this.logger.log('🔍 Vérification des doublons...');
      const isDuplicateStore = await this.duplicateService.checkCJStoreDuplicate(pid);
      
      if (isDuplicateStore) {
        this.logger.log(`⚠️ Produit ${pid} déjà dans le magasin CJ - Mise à jour au lieu de création`);
      }
      
      // ✅ UTILISER UPSERT INTELLIGENT pour le magasin CJ
      // 🧹 NETTOYAGE AUTOMATIQUE (Niveau 1)
      const cleanedName = this.cleanProductName((cjProduct as any).productNameEn || (cjProduct as any).productName);
      const cleanedDescription = this.cleanProductDescription((cjProduct as any).description);
      
      // ✅ Récupérer TOUS les champs disponibles depuis l'API CJ selon la doc
      const storeProductData = {
        cjProductId: pid,
        name: cleanedName,
        description: cleanedDescription,
        price: sellingPrice,
        originalPrice: originalPrice,
        image: Array.isArray((cjProduct as any).productImage) ? (cjProduct as any).productImage[0] : (cjProduct as any).productImage,
        category: (cjProduct as any).categoryName,
        status: 'available',
        isFavorite: isFavorite,
        // ✅ Champs de base
        productSku: (cjProduct as any).productSku,
        productWeight: (cjProduct as any).productWeight,
        packingWeight: (cjProduct as any).packingWeight || (cjProduct as any).packWeight,
        productType: (cjProduct as any).productType,
        productUnit: (cjProduct as any).productUnit,
        productKeyEn: (cjProduct as any).productKeyEn,
        materialNameEn: (cjProduct as any).materialNameEn,
        packingNameEn: (cjProduct as any).packingNameEn,
        suggestSellPrice: (cjProduct as any).suggestSellPrice,
        listedNum: (cjProduct as any).listedNum,
        supplierName: (cjProduct as any).supplierName,
        supplierId: (cjProduct as any).supplierId,
        createrTime: (cjProduct as any).createrTime,
        // ✅ Champs douaniers (essentiels pour l'export)
        categoryId: (cjProduct as any).categoryId,
        entryCode: (cjProduct as any).entryCode,
        entryName: (cjProduct as any).entryName,
        entryNameEn: (cjProduct as any).entryNameEn,
        // ✅ Matériau/Emballage complets
        materialName: (cjProduct as any).materialName,
        materialKey: (cjProduct as any).materialKey,
        packingName: (cjProduct as any).packingName,
        packingKey: (cjProduct as any).packingKey,
        // ✅ Attributs produit complets
        productKey: (cjProduct as any).productKey,
        productProSet: (cjProduct as any).productProSet 
          ? JSON.stringify((cjProduct as any).productProSet) 
          : null,
        productProEnSet: (cjProduct as any).productProEnSet 
          ? JSON.stringify((cjProduct as any).productProEnSet) 
          : null,
        // ✅ Personnalisation (POD)
        customizationVersion: (cjProduct as any).customizationVersion,
        customizationJson1: (cjProduct as any).customizationJson1,
        customizationJson2: (cjProduct as any).customizationJson2,
        customizationJson3: (cjProduct as any).customizationJson3,
        customizationJson4: (cjProduct as any).customizationJson4,
        // ✅ Média (si features=enable_video)
        productVideo: (cjProduct as any).productVideo 
          ? JSON.stringify((cjProduct as any).productVideo) 
          : null,
        // ✅ Variants et reviews (JSON complets avec TOUS les champs)
        variants: JSON.stringify((cjProduct as any).variants || []),
        reviews: JSON.stringify((cjProduct as any).reviews || []),
        dimensions: (cjProduct as any).dimensions,
        brand: (cjProduct as any).brand,
        tags: JSON.stringify((cjProduct as any).tags || []),
        // ✅ Informations de livraison (selon doc API CJ)
        // addMarkStatus: 0=not Free, 1=Free (dans la doc API)
        isFreeShipping: (cjProduct as any).addMarkStatus === 1 || (cjProduct as any).addMarkStatus === true || (cjProduct as any).isFreeShipping === 1,
        // deliveryCycle peut être disponible dans les résultats de recherche mais pas toujours dans /product/query
        deliveryCycle: (cjProduct as any).deliveryCycle || null,
        // Ces champs ne sont PAS dans l'API - nécessitent un appel séparé à /logistics/calculateFreight
        freeShippingCountries: null, // Nécessite un appel API séparé avec pays de destination
        defaultShippingMethod: null, // Nécessite un appel API séparé
      };
      
      // ✅ Log pour vérifier que tous les champs sont bien récupérés
      this.logger.log('📋 Champs API récupérés:', {
        hasProductSku: !!storeProductData.productSku,
        hasProductWeight: !!storeProductData.productWeight,
        hasPackingWeight: !!storeProductData.packingWeight,
        hasProductType: !!storeProductData.productType,
        hasProductUnit: !!storeProductData.productUnit,
        hasProductKeyEn: !!storeProductData.productKeyEn,
        hasMaterialNameEn: !!storeProductData.materialNameEn,
        hasPackingNameEn: !!storeProductData.packingNameEn,
        hasSuggestSellPrice: !!storeProductData.suggestSellPrice,
        hasListedNum: !!storeProductData.listedNum,
        hasSupplierName: !!storeProductData.supplierName,
        hasSupplierId: !!storeProductData.supplierId,
        hasCreaterTime: !!storeProductData.createrTime,
        variantsCount: (cjProduct as any).variants?.length || 0,
        hasVariants: !!(cjProduct as any).variants && (cjProduct as any).variants.length > 0,
        // ✅ Champs douaniers
        hasCategoryId: !!storeProductData.categoryId,
        hasEntryCode: !!storeProductData.entryCode,
        // ✅ Matériau/Emballage
        hasMaterialKey: !!storeProductData.materialKey,
        hasPackingKey: !!storeProductData.packingKey,
        // ✅ Attributs produit
        hasProductKey: !!storeProductData.productKey,
        hasProductProSet: !!storeProductData.productProSet,
        hasProductProEnSet: !!storeProductData.productProEnSet,
        // ✅ Personnalisation
        hasCustomizationVersion: storeProductData.customizationVersion !== undefined,
        // ✅ Média
        hasProductVideo: !!storeProductData.productVideo,
        // ✅ Informations de livraison
        hasDeliveryCycle: !!storeProductData.deliveryCycle,
        hasIsFreeShipping: storeProductData.isFreeShipping !== undefined,
        addMarkStatus: (cjProduct as any).addMarkStatus // Champ original de l'API
      });
      
      const storeResult = await this.duplicateService.upsertCJStoreProduct(storeProductData);
      
      this.logger.log(`✅ Produit ${storeResult.isNew ? 'ajouté' : 'mis à jour'} dans le magasin CJ:`, {
        id: storeResult.productId,
        name: storeProductData.name,
        isFavorite: storeProductData.isFavorite,
        status: storeProductData.status,
        action: storeResult.isNew ? 'NOUVEAU' : 'MISE_À_JOUR'
      });

      // ✅ Enregistrer la catégorie non mappée si nécessaire
      if (storeProductData.category) {
        await this.trackUnmappedCategory(storeProductData.category);
      }

      // ===================================================================
      // ✅ ENRICHIR LES VARIANTS AVEC LEUR STOCK (OBLIGATOIRE)
      // ===================================================================
      this.logger.log('📦 === ENRICHISSEMENT VARIANTS AVEC STOCK ===');

      // ✅ RETRY AUTOMATIQUE : 3 tentatives avec délai croissant
      let variantsWithStock = null;
      let lastError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          this.logger.log(`🔄 Tentative ${attempt}/3 - Récupération des stocks...`);
          
          variantsWithStock = await client.getProductVariantsWithStock(pid);
          
          if (variantsWithStock && variantsWithStock.length > 0) {
            const totalStock = variantsWithStock.reduce((sum, v) => sum + (v.stock || 0), 0);
            this.logger.log(`✅ ${variantsWithStock.length} variants récupérés - Stock total: ${totalStock}`);
            break; // Succès, sortir de la boucle
          } else {
            throw new Error('Aucun variant retourné par l\'API');
          }
          
        } catch (error) {
          lastError = error;
          this.logger.warn(`⚠️ Tentative ${attempt}/3 échouée: ${error instanceof Error ? error.message : String(error)}`);
          
          if (attempt < 3) {
            const delay = attempt * 2000; // 2s, 4s
            this.logger.log(`⏳ Attente de ${delay}ms avant retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // ❌ Si toutes les tentatives ont échoué, FAIL l'import
      if (!variantsWithStock || variantsWithStock.length === 0) {
        this.logger.error('❌ === ÉCHEC RÉCUPÉRATION STOCKS ===');
        this.logger.error(`💥 Impossible de récupérer les stocks après 3 tentatives`);
        this.logger.error(`📊 Dernière erreur: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
        
        throw new Error(`Impossible de récupérer les stocks du produit ${pid}. L'API CJ pourrait être indisponible ou le produit a été retiré. Réessayez plus tard.`);
      }

      // ✅ Stocks récupérés avec succès, continuer l'import
      this.logger.log(`✅ Stocks récupérés avec succès !`);
      
      // 1. Mettre à jour le champ variants JSON avec les données enrichies
      await this.prisma.cJProductStore.update({
        where: { cjProductId: pid },
        data: {
          variants: JSON.stringify(variantsWithStock)
        }
      });
      
      this.logger.log('✅ Champ variants mis à jour avec stock dans CJProductStore');
      
      // 2. Créer/mettre à jour les ProductVariant structurés dans la base
      let variantsSaved = 0;
      let variantsFailed = 0;
      
      // Récupérer le produit KAMRI associé (s'il existe)
      const kamriProduct = await this.prisma.product.findFirst({
        where: { cjProductId: pid }
      });
      
      if (kamriProduct) {
        this.logger.log(`📦 Produit KAMRI trouvé, création des ProductVariant...`);
        
        for (const variant of variantsWithStock) {
          try {
            // Parser variantKey si c'est un JSON string
            let parsedKey = variant.variantKey;
            try {
              if (parsedKey && parsedKey.startsWith('[')) {
                const parsed = JSON.parse(parsedKey);
                parsedKey = Array.isArray(parsed) ? parsed.join('-') : parsedKey;
              }
            } catch {
              // Garder la valeur originale si parsing échoue
            }
            
            // ✅ Récupérer TOUS les champs du variant selon la doc API
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
              // ✅ Inclure TOUS les champs disponibles dans properties (selon doc API)
              properties: JSON.stringify({
                key: parsedKey,
                property: variant.variantProperty,
                standard: variant.variantStandard,
                unit: variant.variantUnit,
                // Champs supplémentaires de la doc API
                variantSugSellPrice: variant.variantSugSellPrice,
                createTime: variant.createTime,
                combineVariants: variant.combineVariants,
                // Garder tous les autres champs non mappés
                ...Object.fromEntries(
                  Object.entries(variant).filter(([key]) => 
                    !['vid', 'pid', 'variantName', 'variantNameEn', 'variantSku', 
                      'variantSellPrice', 'variantWeight', 'variantLength', 'variantWidth', 
                      'variantHeight', 'variantVolume', 'variantImage', 'variantKey', 
                      'variantProperty', 'variantStandard', 'variantUnit', 'stock', 
                      'warehouseStock'].includes(key)
                  )
                )
              }),
              status: (variant.stock || 0) > 0 ? 'available' : 'out_of_stock',
              lastSyncAt: new Date()
            };
            
            await this.prisma.productVariant.upsert({
              where: {
                cjVariantId: variant.vid
              },
              update: variantData,
              create: {
                ...variantData,
                cjVariantId: variant.vid,
                productId: kamriProduct.id
              }
            });
            
            variantsSaved++;
            
          } catch (error) {
            variantsFailed++;
            this.logger.error(`  ❌ Erreur sauvegarde variant ${variant.vid}:`, error);
          }
        }
        
        this.logger.log(`✅ ProductVariant: ${variantsSaved} créés/mis à jour, ${variantsFailed} échecs`);
        
        // ✅ METTRE À JOUR le stock total du produit
        const totalStock = variantsWithStock.reduce((sum, v) => sum + (v.stock || 0), 0);
        await this.prisma.product.update({
          where: { id: kamriProduct.id },
          data: { stock: totalStock }
        });
        this.logger.log(`✅ Product.stock mis à jour: ${totalStock} unités`);
      }
      
      this.logger.log('🎉 === FIN ENRICHISSEMENT VARIANTS ===');

      this.logger.log('🎉 Import terminé avec succès');
      this.logger.log('🔍 === FIN IMPORT PRODUIT CJ ===');
      
      return {
        success: true,
        message: storeResult.isNew ? 'Produit ajouté au magasin CJ' : 'Produit mis à jour dans le magasin CJ',
        product: storeResult.productId,
        action: storeResult.isNew ? 'CREATED' : 'UPDATED',
        isDuplicate: !storeResult.isNew
      };
    } catch (error) {
      this.logger.error('❌ === ERREUR IMPORT PRODUIT ===');
      this.logger.error(`💥 Erreur import produit ${pid}: ${error instanceof Error ? error.message : String(error)}`);
      this.logger.error(`📊 Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
      this.logger.error('🔍 === FIN ERREUR IMPORT PRODUIT ===');
      
      // ✅ Gérer spécifiquement le cas où le produit a été retiré des étagères
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('removed from shelves')) {
        return {
          success: false,
          message: `Ce produit a été retiré des étagères de CJ Dropshipping (PID: ${pid}). Il n'est plus disponible à l'import.`,
          product: null,
          errorCode: 'PRODUCT_REMOVED'
        };
      }
      
      // ✅ Retourner une erreur gracieuse au lieu de lancer une exception
      return {
        success: false,
        message: errorMessage || 'Erreur lors de l\'import du produit',
        product: null
      };
    }
  }

  /**
   * Synchroniser les stocks de tous les produits du magasin CJ
   */
  async syncAllStocks(): Promise<any> {
    this.logger.log('🔄 === SYNCHRONISATION STOCKS MAGASIN CJ ===');
    
    try {
      // Récupérer tous les produits du magasin
      const storeProducts = await this.prisma.cJProductStore.findMany({
        select: {
          id: true,
          cjProductId: true,
          name: true,
          variants: true
        }
      });

      this.logger.log(`📦 ${storeProducts.length} produits trouvés dans le magasin`);

      const client = await this.initializeClient();
      let updated = 0;
      let failed = 0;

      for (const storeProduct of storeProducts) {
        try {
          this.logger.log(`\n🔄 Sync ${storeProduct.name}...`);
          
          // Récupérer les variants avec stock depuis l'API CJ
          const variantsWithStock = await client.getProductVariantsWithStock(storeProduct.cjProductId);
          
          if (variantsWithStock && variantsWithStock.length > 0) {
            const totalStock = variantsWithStock.reduce((sum, v) => sum + (v.stock || 0), 0);
            this.logger.log(`  ✅ ${variantsWithStock.length} variants, stock total: ${totalStock}`);
            
            // Mettre à jour le JSON variants avec les stocks
            await this.prisma.cJProductStore.update({
              where: { id: storeProduct.id },
              data: {
                variants: JSON.stringify(variantsWithStock)
              }
            });
            
            // Si le produit est importé dans Product, mettre à jour les ProductVariant
            const kamriProduct = await this.prisma.product.findFirst({
              where: { cjProductId: storeProduct.cjProductId }
            });
            
            if (kamriProduct) {
              this.logger.log(`  📦 Produit trouvé dans Product, mise à jour des ProductVariant...`);
              
              for (const variant of variantsWithStock) {
                try {
                  let parsedKey = variant.variantKey;
                  if (parsedKey && parsedKey.startsWith('[')) {
                    try {
                      const parsed = JSON.parse(parsedKey);
                      parsedKey = Array.isArray(parsed) ? parsed.join('-') : parsedKey;
                    } catch {}
                  }
                  
                  await this.prisma.productVariant.upsert({
                    where: { cjVariantId: variant.vid },
                    update: {
                      stock: variant.stock || 0,
                      status: (variant.stock || 0) > 0 ? 'available' : 'out_of_stock',
                      lastSyncAt: new Date()
                    },
                    create: {
                      productId: kamriProduct.id,
                      cjVariantId: variant.vid,
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
                      isActive: true,
                      lastSyncAt: new Date()
                    }
                  });
                } catch (err) {
                  this.logger.error(`    ❌ Erreur variant ${variant.vid}:`, err instanceof Error ? err.message : String(err));
                }
              }
            }
            
            updated++;
          } else {
            this.logger.warn(`  ⚠️ Aucun variant trouvé`);
          }
          
        } catch (error) {
          failed++;
          this.logger.error(`  ❌ Erreur: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      this.logger.log(`\n✅ === SYNCHRONISATION TERMINÉE ===`);
      this.logger.log(`📊 ${updated} produits mis à jour, ${failed} échecs`);

      return {
        success: true,
        total: storeProducts.length,
        updated,
        failed,
        message: `${updated} produits synchronisés avec succès`
      };

    } catch (error) {
      this.logger.error('❌ Erreur synchronisation stocks:', error);
      throw error;
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

  /**
   * Nettoyer le nom d'un produit (Niveau 1 - Automatique)
   */
  private cleanProductName(name: string): string {
    if (!name) return '';
    return name
      .trim()
      .replace(/\s+/g, ' ') // Espaces multiples
      .replace(/[^\w\s-]/gi, '') // Caractères spéciaux (sauf tirets)
      .substring(0, 200); // Limite de longueur
  }

  /**
   * Nettoyer la description d'un produit (Niveau 1 - Automatique)
   */
  private cleanProductDescription(description: string): string {
    if (!description) return '';
    
    // Supprimer les balises HTML
    let cleaned = description
      .replace(/<[^>]*>/g, '') // Supprimer toutes les balises HTML
      .replace(/&nbsp;/g, ' ') // Remplacer &nbsp; par des espaces
      .replace(/&amp;/g, '&') // Remplacer &amp; par &
      .replace(/&lt;/g, '<') // Remplacer &lt; par <
      .replace(/&gt;/g, '>') // Remplacer &gt; par >
      .replace(/&quot;/g, '"') // Remplacer &quot; par "
      .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul
      .trim();
    
    // ✅ NETTOYAGE AGRESSIF : Supprimer TOUT le CSS (même mal formaté)
    // Supprimer les blocs CSS complets (y compris ceux avec des accolades imbriquées)
    let cssRemoved = cleaned;
    let previousLength = 0;
    // Répéter jusqu'à ce qu'il n'y ait plus de CSS
    while (cssRemoved.length !== previousLength) {
      previousLength = cssRemoved.length;
      cssRemoved = cssRemoved
        .replace(/#[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '') // CSS avec accolades imbriquées
        .replace(/\.[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
        .replace(/@media[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
        .replace(/[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '') // Tout sélecteur CSS
        .replace(/\{[^{}]*\}/g, '') // Accolades isolées
        .trim();
    }
    cleaned = cssRemoved;
    
    // ✅ Supprimer le markdown et caractères spéciaux mal formatés
    cleaned = cleaned
      .replace(/###\s*[^\n]+/g, '') // ### titres
      .replace(/##\s*[^\n]+/g, '') // ## titres
      .replace(/#\s*[^\n]+/g, '') // # titres
      .replace(/\*\*[^\*]+\*\*/g, '') // **bold**
      .replace(/\*[^\*]+\*/g, '') // *italic*
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // [text](url)
      .replace(/⚠️\s*NOTES\s*IMPORTANTES[^\n]*/gi, '') // Notes importantes
      .replace(/\*\*\s*##\s*⚠️[^\n]*/gi, '') // Combinaisons markdown
      .replace(/🎨\s*Couleurs\s*disponibles[^\n]*/gi, '') // Emojis + texte
      .replace(/🎯\s*Tailles\s*disponibles[^\n]*/gi, '')
      .trim();
    
    // ✅ Supprimer les séquences de caractères CSS/markdown mal formatées
    cleaned = cleaned
      .replace(/[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, '') // Sélecteurs CSS restants
      .replace(/\{[^}]*\}/g, '') // Accolades restantes
      .replace(/[a-zA-Z0-9_-]+:\s*[^;]+;/g, '') // Propriétés CSS : value;
      .replace(/[a-zA-Z0-9_-]+\s*-\s*[a-zA-Z0-9_-]+\s*-\s*[a-zA-Z0-9_-]+/g, '') // Patterns CSS-like
      .trim();
    
    // ✅ Supprimer la section "Technical Details" complète (déjà dans les champs structurés)
    // Cette section commence souvent par "Technical Details" ou "Technical Specifications"
    // Chercher "Technical Details" même sans saut de ligne avant
    const technicalDetailsPattern = /(?:Technical\s+Details?|Technical\s+Specifications?|Specifications?)[\s\S]*$/i;
    cleaned = cleaned.replace(technicalDetailsPattern, '');
    
    // ✅ Aussi supprimer si "Technical Details" apparaît au milieu (sans saut de ligne)
    cleaned = cleaned.replace(/(?:Technical\s+Details?|Technical\s+Specifications?)[\s\S]*$/i, '');
    
    // ✅ Supprimer les lignes de spécifications techniques individuelles
    // Format: "Label: Value" (ex: "Bike Type: Electric Bike")
    const specPatterns = [
      /Bike\s+Type:\s*[^\n]+/gi,
      /Age\s+Range[^\n]+/gi,
      /Number\s+of\s+Speeds?:\s*[^\n]+/gi,
      /Wheel\s+Size:\s*[^\n]+/gi,
      /Frame\s+Material:\s*[^\n]+/gi,
      /Suspension\s+Type:\s*[^\n]+/gi,
      /Accessories?:\s*[^\n]+/gi,
      /Included\s+Components?:\s*[^\n]+/gi,
      /Brake\s+Style:\s*[^\n]+/gi,
      /Cartoon\s+Character:\s*[^\n]+/gi,
      /Wheel\s+Width:\s*[^\n]+/gi,
      /Specific\s+Uses?\s+For\s+Product:\s*[^\n]+/gi,
      /Voltage:\s*[^\n]+/gi,
      /Theme:\s*[^\n]+/gi,
      /Style:\s*[^\n]+/gi,
      /Power\s+Source:\s*[^\n]+/gi,
      /Wattage:\s*[^\n]+/gi,
      /Wheel\s+Material:\s*[^\n]+/gi,
      /Lithium\s+Battery\s+Energy\s+Content:\s*[^\n]+/gi,
      /Seat\s+Material\s+Type:\s*[^\n]+/gi,
      /Warranty\s+Type:\s*[^\n]+/gi,
      /Maximum\s+Weight:\s*[^\n]+/gi,
      /Assembly\s+Required:\s*[^\n]+/gi,
      /Bicycle\s+Gear\s+Shifter\s+Type:\s*[^\n]+/gi,
      /Number\s+of\s+Handles?:\s*[^\n]+/gi,
      /Item\s+Package\s+Dimensions?[^\n]+/gi,
      /Package\s+Weight:\s*[^\n]+/gi,
      /Item\s+Dimensions?[^\n]+/gi,
      /Material:\s*[^\n]+/gi,
      /Suggested\s+Users?:\s*[^\n]+/gi,
      /Part\s+Number:\s*[^\n]+/gi,
    ];
    
    specPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // ✅ Supprimer les informations techniques souvent fausses
    cleaned = cleaned
      .replace(/Weight:\s*[^\n.,]+[kg|g|lb]?[^\n.]*/gi, '')
      .replace(/Poids:\s*[^\n.,]+[kg|g|lb]?[^\n.]*/gi, '')
      .replace(/Dimensions?:\s*[^\n.,]+[cm|mm|m|inch]?[^\n.]*/gi, '')
      .replace(/Size:\s*[^\n.,]*×[^\n.,]*/gi, '')
      .replace(/Package\s+Weight:\s*[^\n.,]+/gi, '')
      .replace(/Shipping\s+Weight:\s*[^\n.,]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // ✅ Nettoyer les espaces et sauts de ligne
    cleaned = cleaned
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // Triples sauts de ligne
      .replace(/\s{3,}/g, ' ') // Espaces multiples
      .replace(/\s+-\s+/g, ' - ') // Espaces autour des tirets
      .trim();
    
    // ✅ Supprimer les lignes qui ne contiennent que des caractères spéciaux ou CSS
    const lines = cleaned.split('\n');
    const cleanLines = lines.filter(line => {
      const trimmed = line.trim();
      // Supprimer les lignes qui sont principalement du CSS/markdown
      if (trimmed.length === 0) return false;
      if (/^[#@{}:;,\s-]+$/.test(trimmed)) return false; // Lignes avec seulement CSS chars
      if (/^[a-zA-Z0-9_-]+\s*\{/.test(trimmed)) return false; // Début de sélecteur CSS
      if (trimmed.includes('{') && trimmed.includes('}') && trimmed.length < 50) return false; // CSS court
      // Supprimer les lignes qui sont des spécifications techniques (format "Label: Value")
      if (/^[A-Z][a-zA-Z\s]+:\s*[A-Z]/.test(trimmed) && trimmed.length < 100) return false;
      return true;
    });
    cleaned = cleanLines.join('\n');
    
    // ✅ Limiter la longueur finale (garder seulement le texte marketing)
    if (cleaned.length > 2000) {
      cleaned = cleaned.substring(0, 2000) + '...';
    }
    
    return cleaned.trim();
  }
}

