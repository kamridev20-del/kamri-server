import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CJAPIClient } from '../cj-dropshipping/cj-api-client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { EditProductDto } from './dto/edit-product.dto';
import { PrepareProductDto } from './dto/prepare-product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private cjClient: CJAPIClient | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private cjApiClient: CJAPIClient
  ) {}

  // ✅ Fonction utilitaire pour calculer le rating moyen depuis les reviews CJ
  private calculateRatingFromReviews(reviews: any[]): { rating: number; count: number } {
    if (!reviews || reviews.length === 0) {
      return { rating: 0, count: 0 };
    }

    const totalScore = reviews.reduce((sum, review) => {
      const score = parseFloat(review.score || review.rating || '0');
      return sum + score;
    }, 0);

    const averageRating = totalScore / reviews.length;
    
    return {
      rating: Math.round(averageRating * 10) / 10, // Arrondir à 1 décimale
      count: reviews.length
    };
  }

  // ✅ Synchroniser les reviews CJ en arrière-plan après l'import
  private syncProductReviewsInBackground(productId: string, cjProductId: string): void {
    // ✅ OPTIMISATION : Vérifier si la synchronisation est activée
    const enableReviewSync = process.env.ENABLE_REVIEW_SYNC === 'true';
    
    if (!enableReviewSync) {
      // ✅ Utiliser debug au lieu de warn pour éviter de polluer les logs
      this.logger.debug(`⚠️ Synchronisation reviews désactivée pour produit ${productId} - ENABLE_REVIEW_SYNC !== true`);
      return;
    }
    
    // Lancer en arrière-plan sans bloquer avec setTimeout
    setTimeout(async () => {
      try {
        this.logger.log(`🔄 [REVIEWS-SYNC] Démarrage pour produit ${productId} (CJ: ${cjProductId})`);
        
        // Récupérer les reviews depuis l'API CJ via getProductReviews
        const reviewsResponse = await this.cjApiClient.getProductReviews(cjProductId, 1, 100);
        const reviews = reviewsResponse?.list || [];
        
        if (reviews && reviews.length > 0) {
          const { rating, count } = this.calculateRatingFromReviews(reviews);
          
          // Mettre à jour le produit avec les reviews
          await this.prisma.product.update({
            where: { id: productId },
            data: {
              cjReviews: JSON.stringify(reviews),
              rating: rating,
              reviewsCount: count
            }
          });
          
          this.logger.log(`✅ [REVIEWS-SYNC] ${count} avis synchronisés pour ${productId} - Rating: ${rating}/5`);
        } else {
          this.logger.log(`ℹ️ [REVIEWS-SYNC] Aucun avis disponible pour ${productId}`);
          
          // Mettre à jour avec 0 avis pour éviter de retenter
          await this.prisma.product.update({
            where: { id: productId },
            data: {
              cjReviews: '[]',
              rating: 0,
              reviewsCount: 0
            }
          });
        }
      } catch (error) {
        this.logger.error(`❌ [REVIEWS-SYNC] Erreur pour ${productId}:`, error.message);
      }
    }, 2000); // Attendre 2 secondes après la création du produit
  }

  // ✅ Fonction utilitaire pour transformer un produit selon la langue
  private transformProductForLanguage(product: any, lang: 'fr' | 'en' = 'fr') {
    // Utiliser les champs multilingues si disponibles, sinon fallback sur name/description
    const name = lang === 'fr' 
      ? (product.name_fr || product.name) 
      : (product.name_en || product.name);
      
    const description = lang === 'fr'
      ? (product.description_fr || product.description)
      : (product.description_en || product.description);

    // Retourner le produit avec les champs traduits
    return {
      ...product,
      name,        // Remplacer par la version traduite
      description  // Remplacer par la version traduite
    };
  }

  // ✅ Fonction utilitaire pour traiter les images et formater la description
  private processProductImages(product: any) {
    let imageUrls: string[] = [];
    let mainImage: string | null = null;

    if (product.images && product.images.length > 0) {
      // Images depuis la relation Prisma
      imageUrls = product.images.map(img => img.url);
      mainImage = imageUrls[0];
    } else if (product.image) {
      // Image stockée comme chaîne JSON ou URL simple
      try {
        if (typeof product.image === 'string' && product.image.startsWith('[')) {
          // Chaîne JSON
          const parsed = JSON.parse(product.image);
          if (Array.isArray(parsed)) {
            imageUrls = parsed;
            mainImage = parsed[0];
          }
        } else {
          // URL simple
          mainImage = product.image;
          imageUrls = [product.image];
        }
      } catch (e) {
        // Si le parsing échoue, utiliser l'image telle quelle
        mainImage = product.image;
        imageUrls = [product.image];
      }
    }

    // ✅ Formater la description avec une structure claire
    let formattedDescription = product.description;
    if (formattedDescription) {
      formattedDescription = this.formatProductDescription(formattedDescription);
    }

    // ✅ Calculer le rating et reviews depuis cjReviews si pas déjà présent
    let rating = product.rating;
    let reviews = product.reviewsCount;
    
    // Si pas de reviews dans notre table Review, utiliser cjReviews en fallback
    if ((!rating || rating === 0 || !reviews || reviews === 0) && product.cjReviews) {
      try {
        const cjReviewsData = JSON.parse(product.cjReviews);
        if (Array.isArray(cjReviewsData) && cjReviewsData.length > 0) {
          const calculated = this.calculateRatingFromReviews(cjReviewsData);
          // Utiliser cjReviews seulement si on a vraiment rien d'autre
          if (!rating || rating === 0) rating = calculated.rating;
          if (!reviews || reviews === 0) reviews = calculated.count;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return {
      ...product,
      image: mainImage,
      images: imageUrls,
      description: formattedDescription,
      rating: rating || 0,
      reviews: reviews || 0,
    };
  }

  async create(createProductDto: CreateProductDto) {
    return this.prisma.product.create({
      data: createProductDto,
      include: {
        category: true,
        images: true,
      },
    });
  }

  async findAll(lang: 'fr' | 'en' = 'fr') {
    const products = await this.prisma.product.findMany({
      where: {
        status: 'active' // Seuls les produits validés
      },
      include: {
        category: true,
        supplier: true, // ✅ Ajouter la relation supplier
        images: true,
        productVariants: {
          // ✅ Inclure TOUS les champs nécessaires des variants pour la création de commandes
          select: {
            id: true,
            productId: true,
            cjVariantId: true,
            sku: true,
            name: true,
            price: true,
            stock: true,
            status: true,
            isActive: true, // ✅ Important pour filtrer les variants actifs
            weight: true,
            dimensions: true,
            image: true,
            properties: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // ✅ Transformer les données pour le frontend et calculer le stock total
    return products.map(product => {
      // ✅ Utiliser directement les champs rating et reviewsCount de la table Product
      // Ces champs sont synchronisés depuis CJ via scheduleReviewsSync
      const processed = this.processProductImages(product);
      
      // ✅ Appliquer la transformation multilingue
      const translated = this.transformProductForLanguage(processed, lang);
      
      // ✅ Calculer le stock total depuis les variants
      let totalStock = 0;
      if (translated.productVariants && translated.productVariants.length > 0) {
        totalStock = translated.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
      }
      
      return { 
        ...translated, 
        stock: totalStock
      };
    });
  }

  async findAllForAdmin() {
    const products = await this.prisma.product.findMany({
      include: {
        category: true,
        supplier: true, // ✅ Ajouter la relation supplier
        images: true,
        productVariants: {
          select: {
            id: true,
            cjVariantId: true,
            sku: true,
            name: true,
            price: true,
            stock: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // ✅ Transformer les données pour le frontend et calculer le stock total
    return products.map(product => {
      const processed = this.processProductImages(product);
      
      // ✅ Calculer le stock total depuis les variants
      let totalStock = 0;
      if (processed.productVariants && processed.productVariants.length > 0) {
        totalStock = processed.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
      }
      
      return { 
        ...processed, 
        stock: totalStock
      };
    });
  }

  async findOne(id: string, lang: 'fr' | 'en' = 'fr') {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true, // ✅ Ajouter la relation supplier
        images: true,
        cjMapping: true, // ✅ Inclure le mapping CJ pour récupérer cjProductId
        productVariants: {
          // ✅ Inclure TOUS les champs des variants
          select: {
            id: true,
            productId: true,
            cjVariantId: true,
            name: true,
            sku: true,
            price: true,
            weight: true,
            dimensions: true,
            image: true,
            status: true,
            properties: true,
            stock: true,
            isActive: true,
            lastSyncAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!product) return null;

    // ✅ Utiliser directement les champs rating et reviewsCount de la table Product
    const processed = this.processProductImages(product);
    
    // ✅ Appliquer la transformation multilingue
    const translated = this.transformProductForLanguage(processed, lang);
    
    // ✅ Calculer le stock total depuis les variants
    let totalStock = 0;
    if (translated.productVariants && translated.productVariants.length > 0) {
      totalStock = translated.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
    }
    
    return { 
      ...translated, 
      stock: totalStock
    };
  }

  async remove(id: string) {
    this.logger.log(`🗑️ Suppression du produit ${id}`);
    
    try {
      // Vérifier que le produit existe
      const product = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new Error('Produit non trouvé');
      }

      // Supprimer le produit (les relations seront supprimées en cascade grâce à onDelete: Cascade dans le schéma)
      // Les relations suivantes seront automatiquement supprimées :
      // - ProductVariant (onDelete: Cascade)
      // - Image (onDelete: Cascade)
      // - CartItem (onDelete: Cascade)
      // - OrderItem (si pas de commande associée)
      // - Review (onDelete: Cascade)
      // - Wishlist (onDelete: Cascade)
      // - CJProductMapping (onDelete: Cascade)
      // - ProductUpdateNotification (si existe)
      
      const deletedProduct = await this.prisma.product.delete({
        where: { id },
      });

      this.logger.log(`✅ Produit ${id} supprimé avec succès`);
      
      return deletedProduct;
    } catch (error) {
      this.logger.error(`❌ Erreur lors de la suppression du produit ${id}:`, error);
      throw error;
    }
  }

  /**
   * Supprimer plusieurs produits en masse
   */
  async bulkDelete(ids: string[]): Promise<{ deleted: number; failed: number; errors?: string[] }> {
    this.logger.log(`🗑️ Suppression en masse de ${ids.length} produit(s)`);
    
    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await this.remove(id);
        deleted++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        errors.push(`Produit ${id}: ${errorMessage}`);
        this.logger.error(`❌ Erreur suppression produit ${id}:`, errorMessage);
      }
    }

    this.logger.log(`✅ Suppression en masse terminée: ${deleted} supprimé(s), ${failed} échec(s)`);

    return {
      deleted,
      failed,
      ...(errors.length > 0 && { errors }),
    };
  }

  async approve(id: string) {
    // ✅ Unifié : utiliser publishProduct pour draft → active
    return this.publishProduct(id);
  }

  async reject(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { status: 'rejected' },
    });
  }

  async getPendingProducts() {
    // ✅ Unifié : retourner uniquement les produits draft
    const products = await this.prisma.product.findMany({
      where: { 
        status: 'draft' // ✅ Unifié : uniquement draft
      },
      include: {
        category: true,
        supplier: true,
        cjMapping: true, // ✅ Inclure le mapping CJ
        productVariants: {
          // ✅ Inclure les variants pour calculer le stock
          select: {
            id: true,
            productId: true,
            stock: true,
            isActive: true,
          },
        },
        images: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // ✅ Calculer le stock total depuis les variants
    return products.map(product => {
      const processed = this.processProductImages(product);
      
      // Calculer le stock
      let totalStock = 0;
      if (processed.productVariants && processed.productVariants.length > 0) {
        totalStock = processed.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
      }
      
      return { 
        ...processed, 
        stock: totalStock
      };
    });
  }

  async getProductsReadyForValidation(categoryId?: string) {
    // ✅ Unifié : récupérer uniquement les produits draft
    const products = await this.prisma.product.findMany({
      where: { 
        status: 'draft' // ✅ Unifié : uniquement draft
      },
      include: {
        category: true,
        supplier: {
          include: {
            categoryMappings: true
          }
        },
        cjMapping: true, // ✅ Inclure le mapping CJ
        productVariants: {
          // ✅ Inclure TOUS les champs des variants pour la page validation
          select: {
            id: true,
            productId: true,
            cjVariantId: true,
            name: true,
            sku: true,
            price: true,
            weight: true,
            dimensions: true,
            image: true,
            status: true,
            properties: true,
            stock: true,
            isActive: true,
            lastSyncAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        images: true, // ✅ Inclure aussi les images
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Récupérer tous les mappings de catégories
    const categoryMappings = await this.prisma.categoryMapping.findMany();
    
    // Filtrer pour ne garder que ceux qui ont un mapping pour leur catégorie externe
    let filteredProducts = products.filter(product => {
      if (!product.supplier || !product.externalCategory) return false;
      
      // Vérifier si ce produit a un mapping pour sa catégorie externe
      const hasMapping = categoryMappings.some(mapping => 
        mapping.supplierId === product.supplierId && 
        mapping.externalCategory === product.externalCategory
      );
      
      return hasMapping;
    });

    // Si une catégorie spécifique est demandée, filtrer par cette catégorie
    if (categoryId) {
      filteredProducts = filteredProducts.filter(product => {
        if (!product.supplier || !product.externalCategory) return false;
        
        // Trouver le mapping pour ce produit
        const mapping = categoryMappings.find(mapping => 
          mapping.supplierId === product.supplierId && 
          mapping.externalCategory === product.externalCategory
        );
        
        return mapping && mapping.internalCategory === categoryId;
      });
    }

    // ✅ Calculer le stock total depuis les variants et traiter les images
    return filteredProducts.map(product => {
      const processed = this.processProductImages(product);
      if (processed.productVariants && processed.productVariants.length > 0) {
        const totalStock = processed.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        return { ...processed, stock: totalStock };
      }
      return processed;
    });
  }

  // ✅ Nouvelle méthode pour obtenir les produits par source
  async getProductsBySource(source?: string) {
    const whereClause: any = {
      status: 'draft' // ✅ Unifié : uniquement draft
    };

    if (source) {
      whereClause.source = source;
    }

    return this.prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        supplier: true,
        cjMapping: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // ✅ Nouvelle méthode pour obtenir les statistiques de validation
  async getValidationStats() {
    // ✅ Unifié : compter uniquement les produits draft
    const draft = await this.prisma.product.count({ where: { status: 'draft' } });

    return {
      draft,
      total: draft, // ✅ Unifié : uniquement draft
    };
  }

  async findByCategory(categoryId: string, lang: 'fr' | 'en' = 'fr') {
    const products = await this.prisma.product.findMany({
      where: { 
        categoryId,
        status: 'active'
      },
      include: {
        category: true,
        supplier: true,
        images: true,
        productVariants: {
          select: {
            id: true,
            productId: true,
            cjVariantId: true,
            sku: true,
            name: true,
            price: true,
            stock: true,
            status: true,
            isActive: true,
            weight: true,
            dimensions: true,
            image: true,
            properties: true,
          },
        },
      },
    });

    // ✅ Transformer les données pour le frontend et calculer le stock total
    return products.map(product => {
      const processed = this.processProductImages(product);
      const translated = this.transformProductForLanguage(processed, lang);
      
      // ✅ Calculer le stock total depuis les variants
      let totalStock = 0;
      if (processed.productVariants && processed.productVariants.length > 0) {
        totalStock = processed.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
      }
      
      return { 
        ...translated, 
        stock: totalStock
      };
    });
  }

  // ✅ MÉTHODES CJ DROPSHIPPING
  private readonly CJ_API_BASE = 'https://api.cjdropshipping.com/api2.0/v1';
  private readonly CJ_API_KEY = process.env.CJ_API_KEY;

  /**
   * Obtenir les recherches populaires
   */
  async getPopularSearches(limit: number = 8) {
    try {
      const popularSearches = await this.prisma.searchHistory.findMany({
        orderBy: [
          { count: 'desc' },
          { lastSearchedAt: 'desc' },
        ],
        take: limit,
        select: {
          query: true,
          count: true,
        },
      });

      return popularSearches.map(s => s.query);
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des recherches populaires:', error);
      return [];
    }
  }

  /**
   * Enregistrer une recherche dans l'historique
   */
  private async recordSearch(query: string) {
    if (!query || query.trim().length < 2) return;

    const searchTerm = query.trim().toLowerCase();

    try {
      await this.prisma.searchHistory.upsert({
        where: { query: searchTerm },
        update: {
          count: { increment: 1 },
          lastSearchedAt: new Date(),
        },
        create: {
          query: searchTerm,
          count: 1,
          lastSearchedAt: new Date(),
        },
      });
    } catch (error) {
      // Ignorer les erreurs silencieusement pour ne pas bloquer la recherche
      this.logger.debug('Erreur lors de l\'enregistrement de la recherche:', error);
    }
  }

  /**
   * Rechercher des produits et catégories dans la base de données
   */
  async searchProductsAndCategories(query: string, limit: number = 10, includePopular: boolean = false, lang: 'fr' | 'en' = 'fr') {
    const searchTerm = query ? query.trim().toLowerCase() : '';

    // Si pas de query, retourner les recherches populaires si demandé
    if (!searchTerm && includePopular) {
      const popularSearches = await this.getPopularSearches(8);
      return {
        products: [],
        categories: [],
        totalProducts: 0,
        totalCategories: 0,
        popularSearches,
      };
    }

    if (!searchTerm) {
      return {
        products: [],
        categories: [],
        totalProducts: 0,
        totalCategories: 0,
        popularSearches: [],
      };
    }

    // Enregistrer la recherche dans l'historique
    await this.recordSearch(searchTerm);

    try {
      // Rechercher les produits
      const products = await this.prisma.product.findMany({
        where: {
          status: 'active',
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { brand: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          category: true,
          supplier: true,
          images: true,
          productVariants: {
            where: { isActive: true },
            select: {
              id: true,
              stock: true,
              price: true,
            },
          },
        },
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Rechercher les catégories
      const categories = await this.prisma.category.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { nameEn: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          nameEn: true,
          description: true,
          icon: true,
          imageUrl: true,
          _count: {
            select: {
              products: {
                where: {
                  status: 'active',
                },
              },
            },
          },
        },
        take: Math.min(limit, 5), // Limiter à 5 catégories max
        orderBy: {
          name: 'asc',
        },
      });

      // Compter le total de produits correspondants
      const totalProducts = await this.prisma.product.count({
        where: {
          status: 'active',
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { brand: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      });

      // Transformer les produits pour le frontend
      const processedProducts = products.map(product => {
        const processed = this.processProductImages(product);
        // ✅ Appliquer la transformation multilingue
        const translated = this.transformProductForLanguage(processed, lang);
        // Calculer le stock total depuis les variants
        if (translated.productVariants && translated.productVariants.length > 0) {
          const totalStock = translated.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
          return { ...translated, stock: totalStock };
        }
        return translated;
      });

      return {
        products: processedProducts,
        categories: categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          nameEn: cat.nameEn,
          description: cat.description,
          icon: cat.icon,
          imageUrl: cat.imageUrl,
          productCount: cat._count.products,
        })),
        totalProducts,
        totalCategories: categories.length,
        popularSearches: [],
      };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche:', error);
      return {
        products: [],
        categories: [],
        totalProducts: 0,
        totalCategories: 0,
        popularSearches: [],
      };
    }
  }

  async searchCJProducts(params: any) {
    try {
      // Construire les paramètres de recherche pour l'API CJ
      const searchParams = {
        productName: params.productName || '',
        categoryId: params.categoryId || '',
        minPrice: params.minPrice || 0,
        maxPrice: params.maxPrice || 999999,
        pageNum: params.pageNum || 1,
        pageSize: params.pageSize || 50,
        countryCode: params.countryCode || 'US',
        sort: params.sort || 'DESC',
        orderBy: params.orderBy || 'listedNum'
      };

      // Appel à l'API CJ Dropshipping
      const response = await fetch(`${this.CJ_API_BASE}/product/list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.CJ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        throw new Error(`CJ API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transformer les données pour le frontend
      return {
        success: true,
        data: {
          list: data.data?.list || [],
          total: data.data?.total || 0,
          pageNum: data.data?.pageNum || 1,
          pageSize: data.data?.pageSize || 50
        }
      };
    } catch (error) {
      console.error('Erreur recherche CJ:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: { list: [], total: 0 }
      };
    }
  }

  async getCJCategories() {
    try {
      const response = await fetch(`${this.CJ_API_BASE}/product/getCategory`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.CJ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`CJ API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || []
      };
    } catch (error) {
      console.error('Erreur récupération catégories CJ:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: []
      };
    }
  }

  async getCJProductDetails(pid: string) {
    try {
      const response = await fetch(`${this.CJ_API_BASE}/product/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.CJ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pid }),
      });

      if (!response.ok) {
        throw new Error(`CJ API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data
      };
    } catch (error) {
      console.error('Erreur détails produit CJ:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: null
      };
    }
  }

  /**
   * Initialiser le client CJ API si nécessaire
   */
  private async initializeCJClient(): Promise<CJAPIClient> {
    if (this.cjClient) {
      return this.cjClient;
    }

    this.logger.log('🚀 Initialisation du client CJ pour import produit...');
    
    // Créer le client CJ avec la configuration
    this.cjClient = new CJAPIClient(this.configService, this.prisma);
    
    // Charger la configuration depuis la base de données
    const config = await this.prisma.cJConfig.findFirst();
    if (!config?.enabled) {
      throw new Error('L\'intégration CJ Dropshipping est désactivée');
    }

    // Initialiser la configuration du client
    this.cjClient.setConfig({
      email: config.email,
      apiKey: config.apiKey,
      tier: config.tier as 'free' | 'plus' | 'prime' | 'advanced',
      platformToken: config.platformToken,
      debug: process.env.CJ_DEBUG === 'true',
    });

    // ✅ Essayer de charger le token depuis la base de données
    const tokenLoaded = await this.cjClient.loadTokenFromDatabase();
    
    if (!tokenLoaded) {
      // Si le token n'est pas en base ou est expiré, faire un login
      this.logger.log('🔑 Token non trouvé en base ou expiré - Login CJ requis');
      await this.cjClient.login();
      this.logger.log('✅ Login CJ réussi');
    } else {
      this.logger.log('✅ Token CJ chargé depuis la base de données');
    }
    
    return this.cjClient;
  }

  async importCJProduct(importData: any) {
    try {
      const { pid, variantSku, categoryId, supplierId } = importData;

      this.logger.log(`🔄 === IMPORT PRODUIT CJ (PID: ${pid}, Variant: ${variantSku}) ===`);

      // Vérifier si le produit existe déjà
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          cjProductId: pid
        }
      });

      if (existingProduct) {
        this.logger.log(`⚠️ Produit déjà importé: ${existingProduct.id}`);
        return {
          success: false,
          error: 'Ce produit CJ est déjà importé',
          data: existingProduct
        };
      }

      // Récupérer les détails du produit depuis CJ
      const cjDetails = await this.getCJProductDetails(pid);
      if (!cjDetails.success) {
        throw new Error('Impossible de récupérer les détails du produit CJ');
      }

      const cjProduct = cjDetails.data;
      const selectedVariant = cjProduct.variants?.find(v => v.variantSku === variantSku);

      if (!selectedVariant) {
        throw new Error('Variante non trouvée');
      }

      // ✅ Récupérer TOUTES les données CJ détaillées
      const productImage = Array.isArray(cjProduct.productImage) 
        ? JSON.stringify(cjProduct.productImage) 
        : (cjProduct.productImage || '[]');

      // ✅ Créer le produit avec TOUTES les données CJ
      // ✅ Copier automatiquement les données anglaises depuis CJ
      const englishName = cjProduct.productNameEn || cjProduct.productName;
      const englishDescription = cjProduct.productDescriptionEn || cjProduct.productDescription || '';
      
      // ✅ Préparer les données avec les champs multilingues
      const productData: any = {
        name: englishName, // Nom par défaut (anglais)
        description: englishDescription, // Description par défaut (anglais)
        // ✅ Copier automatiquement les données anglaises depuis CJ
        name_en: englishName, // ✅ Copier automatiquement en anglais
        name_fr: null, // ✅ À remplir par l'admin lors de l'édition
        description_en: englishDescription, // ✅ Copier automatiquement en anglais
        description_fr: null, // ✅ À remplir par l'admin lors de l'édition
        price: parseFloat(selectedVariant.variantSellPrice || selectedVariant.sellPrice || '0'),
        originalPrice: parseFloat(selectedVariant.originalPrice || selectedVariant.variantOriginalPrice || '0'),
        image: productImage,
        categoryId,
        supplierId,
        externalCategory: cjProduct.categoryName,
        source: 'cj-dropshipping',
        status: 'draft',
        stock: selectedVariant.stock || 0,
        
        // ✅ TOUTES les données CJ détaillées
        cjProductId: pid,
        productSku: cjProduct.productSku || '',
        productWeight: cjProduct.productWeight || null,
        packingWeight: cjProduct.packingWeight || null,
        productType: cjProduct.productType || null,
        productUnit: cjProduct.productUnit || null,
        productKeyEn: cjProduct.productKeyEn || null,
        materialNameEn: cjProduct.materialNameEn || null,
        packingNameEn: cjProduct.packingNameEn || null,
        suggestSellPrice: cjProduct.suggestSellPrice || null,
        listedNum: cjProduct.listedNum || null,
        supplierName: cjProduct.supplierName || null,
        createrTime: cjProduct.createrTime || null,
        variants: JSON.stringify(cjProduct.variants || []), // ✅ Sauvegarder tous les variants en JSON
        cjReviews: JSON.stringify(cjProduct.reviews || cjProduct.cjReviews || []),
        dimensions: cjProduct.dimensions || null,
        brand: cjProduct.brand || null,
        tags: JSON.stringify(cjProduct.tags || []),
        
        // ✅ Calculer et stocker le rating et le nombre d'avis
        ...(() => {
          const reviewsData = cjProduct.reviews || cjProduct.cjReviews || [];
          const { rating, count } = this.calculateRatingFromReviews(reviewsData);
          return { rating, reviewsCount: count };
        })(),
        
        // ✅ Créer le mapping CJ
        cjMapping: {
          create: {
            cjProductId: pid,
            cjSku: variantSku
          }
        }
      };
      
      const product = await this.prisma.product.create({
        data: productData,
        include: {
          category: true,
          supplier: true,
          cjMapping: true
        }
      });

      this.logger.log(`✅ Produit créé: ${product.id} - ${product.name}`);

      // ✅ Synchroniser les reviews en arrière-plan (ne bloque pas l'import)
      this.syncProductReviewsInBackground(product.id, pid);

      // ✅ Créer les ProductVariant pour TOUS les variants
      try {
        const client = await this.initializeCJClient();
        const variantsWithStock = await client.getProductVariantsWithStock(pid);

        if (variantsWithStock && variantsWithStock.length > 0) {
          this.logger.log(`📦 Création de ${variantsWithStock.length} variants dans ProductVariant...`);

          let createdCount = 0;
          let updatedCount = 0;

          for (const variant of variantsWithStock) {
            try {
              // Parser variantKey
              let parsedKey = variant.variantKey || '';
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
                price: variant.variantSellPrice || 0,
                weight: variant.variantWeight || null,
                dimensions: variant.variantLength && variant.variantWidth && variant.variantHeight
                  ? JSON.stringify({
                      length: variant.variantLength,
                      width: variant.variantWidth,
                      height: variant.variantHeight,
                      volume: variant.variantVolume
                    })
                  : null,
                image: variant.variantImage || null,
                stock: variant.stock || 0,
                properties: JSON.stringify({
                  key: parsedKey,
                  property: variant.variantProperty || '',
                  standard: variant.variantStandard || '',
                  unit: variant.variantUnit || ''
                }),
                status: (variant.stock || 0) > 0 ? 'available' : 'out_of_stock',
                lastSyncAt: new Date()
              };

              // Créer/mettre à jour le variant dans ProductVariant
              const result = await this.prisma.productVariant.upsert({
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

              if (result) {
                createdCount++;
              } else {
                updatedCount++;
              }
            } catch (variantError: any) {
              this.logger.warn(`⚠️ Erreur création variant ${variant.vid}: ${variantError.message}`);
            }
          }

          this.logger.log(`✅ Variants créés: ${createdCount}, mis à jour: ${updatedCount}`);
        } else {
          this.logger.warn('⚠️ Aucun variant avec stock trouvé depuis l\'API CJ');
          this.logger.log('🔄 Tentative de création depuis cjProduct.variants (JSON)...');
          
          // Fallback : créer les variants depuis cjProduct.variants si disponibles
          if (cjProduct.variants && Array.isArray(cjProduct.variants)) {
            this.logger.log(`📦 ${cjProduct.variants.length} variants trouvés dans le JSON`);
            let fallbackCreated = 0;
            
            for (const variant of cjProduct.variants) {
              try {
                // ✅ Parser le stock même depuis JSON
                const stockValue = parseInt(variant.stock || variant.variantStock || '0', 10);
                
                await this.prisma.productVariant.create({
                  data: {
                    productId: product.id,
                    cjVariantId: variant.vid || variant.variantId || '',
                    name: variant.variantNameEn || variant.variantName || `Variant ${variant.variantSku}`,
                    sku: variant.variantSku || '',
                    price: parseFloat(variant.variantSellPrice || variant.sellPrice || '0'),
                    stock: stockValue,
                    status: stockValue > 0 ? 'available' : 'out_of_stock',
                    isActive: true
                  }
                });
                fallbackCreated++;
              } catch (variantError: any) {
                // Ignorer les erreurs de doublons
                if (!variantError.message?.includes('Unique constraint')) {
                  this.logger.warn(`⚠️ Erreur création variant fallback: ${variantError.message}`);
                }
              }
            }
            
            this.logger.log(`✅ ${fallbackCreated} variants créés depuis JSON fallback`);
            if (fallbackCreated === 0) {
              this.logger.error('❌ AUCUN variant n\'a pu être créé - Vérifiez les données CJ');
            }
          } else {
            this.logger.error('❌ cjProduct.variants est vide ou invalide - Impossible de créer des variants');
          }
        }
      } catch (variantsError: any) {
        this.logger.error(`❌ Erreur lors de la création des variants: ${variantsError.message}`);
        // Ne pas faire échouer l'import si les variants échouent
      }

      // ✅ Retourner le produit avec les variants
      const productWithVariants = await this.prisma.product.findUnique({
        where: { id: product.id },
        include: {
          category: true,
          supplier: true,
          cjMapping: true,
          productVariants: true
        }
      });

      this.logger.log(`✅ Import terminé: ${productWithVariants?.productVariants?.length || 0} variants créés`);

      return {
        success: true,
        data: productWithVariants
      };
    } catch (error) {
      this.logger.error('❌ Erreur import produit CJ:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: null
      };
    }
  }

  async getCJProductStock(pid: string, countryCode: string = 'US') {
    try {
      const response = await fetch(`${this.CJ_API_BASE}/product/stock/getInventoryByPid`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.CJ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          pid,
          countryCode 
        }),
      });

      if (!response.ok) {
        throw new Error(`CJ API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || []
      };
    } catch (error) {
      console.error('Erreur stock produit CJ:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: []
      };
    }
  }

  // ===== NOUVELLES MÉTHODES POUR L'ÉDITION MANUELLE =====

  /**
   * Nettoyer le nom d'un produit
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
   * Nettoyer la description d'un produit
   */
  /**
   * Formater la description du produit avec une structure claire
   * Extrait et structure les informations importantes (tailles, couleurs, matériaux, etc.)
   */
  private formatProductDescription(description: string): string {
    if (!description) return '';

    // 1. Supprimer toutes les balises HTML
    let formatted = description.replace(/<[^>]*>/g, '');
    
    // 2. Remplacer les entités HTML communes
    formatted = formatted.replace(/&nbsp;/g, ' ');
    formatted = formatted.replace(/&amp;/g, '&');
    formatted = formatted.replace(/&lt;/g, '<');
    formatted = formatted.replace(/&gt;/g, '>');
    formatted = formatted.replace(/&quot;/g, '"');
    formatted = formatted.replace(/&#39;/g, "'");
    formatted = formatted.replace(/&apos;/g, "'");
    
    // 3. ✅ CORRECTION : Ajouter des espaces manquants entre les mots
    // Ex: "Asiansizesare1to2sizessmaller" → "Asian sizes are 1 to 2 sizes smaller"
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2'); // Ajouter espace entre minuscule et majuscule
    formatted = formatted.replace(/([a-z])(\d)/g, '$1 $2'); // Ajouter espace entre lettre et chiffre
    formatted = formatted.replace(/(\d)([A-Za-z])/g, '$1 $2'); // Ajouter espace entre chiffre et lettre
    formatted = formatted.replace(/([.!?])([A-Za-z])/g, '$1 $2'); // Ajouter espace après ponctuation
    
    // 4. Structurer les informations de produit (Product information:)
    formatted = formatted.replace(/Product information:/gi, '\n\n## 📋 INFORMATIONS DU PRODUIT\n');
    
    // 5. ✅ Extraire et formater les notes importantes
    // Pattern: "1.Asiansizesare..." ou "1. Asian sizes are..." ou "Note: ..."
    formatted = formatted.replace(/(\d+\.)\s*([A-Z][^.!?]*[.!?])/g, (match, num, note) => {
      const cleanNote = note.trim();
      return `\n\n**Note ${num.trim()}:** ${cleanNote}`;
    });
    
    // Pattern: "Please check..." ou "Please allow..." (notes sans numéro)
    formatted = formatted.replace(/(Please\s+[^.!?]*[.!?])/gi, (match, note) => {
      const cleanNote = note.trim();
      return `\n\n**Note:** ${cleanNote}`;
    });
    
    // Pattern: "if you don't know..." (notes conditionnelles)
    formatted = formatted.replace(/(if\s+you\s+[^.!?]*[.!?])/gi, (match, note) => {
      const cleanNote = note.trim();
      return `\n\n**Note:** ${cleanNote}`;
    });
    
    // 6. Détecter et formater les champs avec le pattern "Label: Value" (sans saut de ligne entre eux)
    // D'abord, détecter les patterns comme "Fabric name:", "Color:", "Size:" qui sont collés ensemble
    formatted = formatted.replace(/([A-Z][a-z\s]+):\s*([^A-Z\n]+?)(?=[A-Z][a-z\s]+:|$)/g, (match, label, value) => {
      // Nettoyer le label et la valeur
      const cleanLabel = label.trim();
      const cleanValue = value.trim();
      
      // Traduire les labels communs
      const labelMap: { [key: string]: string } = {
        'Fabric name': 'Nom du tissu',
        'Color': 'Couleur',
        'Size': 'Tailles disponibles',
        'Main fabric composition': 'Composition principale',
        'Applicable Gender': 'Genre applicable',
        'Style': 'Style',
        'Packing list': 'Contenu de l\'emballage',
        'Product Image': 'Image du produit',
        'Upper material': 'Matériau supérieur',
        'Sole material': 'Matériau semelle',
        'Lining composition': 'Composition doublure',
        'Inner material': 'Matériau intérieur',
        'Insole material': 'Matériau semelle intérieure',
        'Mold Cup type': 'Type de bonnet',
        'Cup type': 'Type de bonnet',
        'Applicable age group': 'Groupe d\'âge',
        'Applicable sports': 'Sports applicables',
        'Function': 'Fonctionnalités',
        'How to wear': 'Comment porter',
        'Popular element': 'Éléments populaires',
        'Heel shape': 'Forme du talon',
        'Heel height': 'Hauteur du talon',
        'Toe shape': 'Forme de la pointe',
      };
      
      const translatedLabel = labelMap[cleanLabel] || cleanLabel;
      
      // Formater les tailles (S,M,L ou 35,36,37,38,39,40,41,42)
      if (cleanLabel.toLowerCase().includes('size')) {
        const cleanSizes = cleanValue
          .replace(/\s+/g, '') // Supprimer les espaces
          .split(/[,;]/) // Séparer par virgule ou point-virgule
          .filter(s => s.trim()) // Filtrer les vides
          .map(s => s.trim())
          .join(', '); // Rejoindre avec virgule et espace
        return `\n\n### 🎯 Tailles disponibles\n${cleanSizes.split(', ').map(s => `- ${s}`).join('\n')}`;
      }
      
      // Formater les couleurs
      if (cleanLabel.toLowerCase().includes('color')) {
        const cleanColors = cleanValue
          .split(/[,;]/)
          .map(c => c.trim())
          .filter(c => c)
          .join(', ');
        return `\n\n### 🎨 Couleurs disponibles\n${cleanColors.split(', ').map(c => `- ${c}`).join('\n')}`;
      }
      
      // Formater les autres champs
      return `\n**${translatedLabel}:** ${cleanValue}`;
    });
    
    // 5. Détecter et formater les tailles (Size: S,M,L ou Size: 35,36,37,38,39,40,41,42) - Pattern alternatif
    formatted = formatted.replace(/Size:\s*([^\n]+)/gi, (match, sizes) => {
      const cleanSizes = sizes
        .replace(/\s+/g, '')
        .split(/[,;]/)
        .filter(s => s.trim())
        .map(s => s.trim())
        .join(', ');
      return `\n\n### 🎯 Tailles disponibles\n${cleanSizes.split(', ').map(s => `- ${s}`).join('\n')}`;
    });
    
    // 6. Détecter et formater les couleurs (Color: Black, white, black, gray, red) - Pattern alternatif
    formatted = formatted.replace(/Color:\s*([^\n]+)/gi, (match, colors) => {
      const cleanColors = colors
        .split(/[,;]/)
        .map(c => c.trim())
        .filter(c => c)
        .join(', ');
      return `\n\n### 🎨 Couleurs disponibles\n${cleanColors.split(', ').map(c => `- ${c}`).join('\n')}`;
    });
    
    // 7. Détecter et formater les matériaux
    const materialPatterns = [
      { pattern: /Main fabric composition:\s*([^\n]+)/gi, label: 'Composition principale' },
      { pattern: /Upper material:\s*([^\n]+)/gi, label: 'Matériau supérieur' },
      { pattern: /Sole material:\s*([^\n]+)/gi, label: 'Matériau semelle' },
      { pattern: /Lining composition:\s*([^\n]+)/gi, label: 'Composition doublure' },
      { pattern: /Inner material:\s*([^\n]+)/gi, label: 'Matériau intérieur' },
      { pattern: /Insole material:\s*([^\n]+)/gi, label: 'Matériau semelle intérieure' },
    ];
    
    materialPatterns.forEach(({ pattern, label }) => {
      formatted = formatted.replace(pattern, `\n**${label}:** $1`);
    });
    
    // 8. Détecter et formater les autres informations importantes
    const infoPatterns = [
      { pattern: /Fabric name:\s*([^\n]+)/gi, label: 'Nom du tissu' },
      { pattern: /Mold Cup type:\s*([^\n]+)/gi, label: 'Type de bonnet' },
      { pattern: /Cup type:\s*([^\n]+)/gi, label: 'Type de bonnet' },
      { pattern: /Applicable Gender:\s*([^\n]+)/gi, label: 'Genre applicable' },
      { pattern: /Applicable age group:\s*([^\n]+)/gi, label: 'Groupe d\'âge' },
      { pattern: /Applicable sports:\s*([^\n]+)/gi, label: 'Sports applicables' },
      { pattern: /Function:\s*([^\n]+)/gi, label: 'Fonctionnalités' },
      { pattern: /Style:\s*([^\n]+)/gi, label: 'Style' },
      { pattern: /How to wear:\s*([^\n]+)/gi, label: 'Comment porter' },
      { pattern: /Popular element[;:]\s*([^\n]+)/gi, label: 'Éléments populaires' },
      { pattern: /Heel shape:\s*([^\n]+)/gi, label: 'Forme du talon' },
      { pattern: /Heel height:\s*([^\n]+)/gi, label: 'Hauteur du talon' },
      { pattern: /Toe shape:\s*([^\n]+)/gi, label: 'Forme de la pointe' },
      { pattern: /Packing list:\s*([^\n]+)/gi, label: 'Contenu de l\'emballage' },
      { pattern: /Product Image:\s*([^\n]*)/gi, label: '' }, // Supprimer "Product Image:" s'il est vide
    ];
    
    infoPatterns.forEach(({ pattern, label }) => {
      if (label) {
        formatted = formatted.replace(pattern, `\n**${label}:** $1`);
      } else {
        formatted = formatted.replace(pattern, ''); // Supprimer si label vide
      }
    });
    
    // 9. ✅ Extraire et formater les notes importantes sur les tailles asiatiques
    // Pattern: "Asian sizes are 1 to 2 sizes smaller..."
    formatted = formatted.replace(/Asian\s+sizes\s+are\s+(\d+)\s+to\s+(\d+)\s+sizes\s+smaller\s+than\s+European\s+and\s+American\s+people/gi, 
      '**⚠️ Note importante:** Les tailles asiatiques sont $1 à $2 tailles plus petites que les tailles européennes et américaines');
    
    formatted = formatted.replace(/Choose\s+the\s+larger\s+size\s+if\s+your\s+size\s+between\s+two\s+sizes/gi,
      'Choisissez la taille supérieure si votre taille se situe entre deux tailles');
    
    formatted = formatted.replace(/Please\s+allow\s+(\d+)-(\d+)\s*cm\s+differences\s+due\s+to\s+manual\s+measurement/gi,
      'Veuillez prévoir $1-$2 cm de différence en raison de la mesure manuelle');
    
    formatted = formatted.replace(/Please\s+check\s+the\s+size\s+chart\s+carefully\s+before\s+you\s+buy\s+the\s+item/gi,
      '**📏 Important:** Veuillez vérifier attentivement le tableau des tailles avant d\'acheter l\'article');
    
    formatted = formatted.replace(/if\s+you\s+don'?t\s+know\s+how\s+to\s+choose\s+size/gi,
      '**💡 Conseil:** Si vous ne savez pas comment choisir la taille, contactez notre service client');
    
    // 10. Formater les notes (Note: ...)
    formatted = formatted.replace(/Note:\s*([^\n]+(?:\n[^\n]+)*)/gi, (match, note) => {
      const notes = note
        .split(/(?=\d+\.)/)
        .map(n => n.trim())
        .filter(n => n)
        .map(n => `  • ${n.trim()}`)
        .join('\n');
      return `\n\n## ⚠️ NOTES IMPORTANTES\n${notes}`;
    });
    
    // 11. Structurer les sections avec des sauts de ligne
    formatted = formatted.replace(/\n\n\*\*/g, '\n**');
    formatted = formatted.replace(/\*\*([^*]+)\*\*:\s*/g, '\n**$1:**\n');
    
    // 12. Nettoyer les espaces multiples (mais préserver les sauts de ligne)
    formatted = formatted.replace(/[ \t]+/g, ' '); // Remplacer les espaces multiples par un seul
    formatted = formatted.replace(/[ \t]+$/gm, ''); // Supprimer les espaces en fin de ligne
    
    // 13. Nettoyer les sauts de ligne multiples (garder max 2 sauts de ligne)
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    // 14. Supprimer les espaces en début de ligne (sauf pour les listes)
    formatted = formatted.split('\n').map(line => {
      // Préserver l'indentation des listes (commençant par - ou •)
      if (line.match(/^[\s]*[-•]/)) {
        return line.trimStart().replace(/^[-•]/, '-');
      }
      return line.trim();
    }).join('\n');
    
    // 15. Supprimer les lignes vides en début et fin
    formatted = formatted.trim();
    
    // 16. Remplacer les crochets chinois par des sauts de ligne
    formatted = formatted.replace(/【/g, '\n\n🌸 ');
    formatted = formatted.replace(/】/g, '');
    
    // 17. Finaliser le formatage
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    return formatted;
  }

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
    
    return cleaned;
  }

  /**
   * Calculer le prix avec marge
   */
  private calculatePriceWithMargin(originalPrice: number, margin: number): number {
    if (!originalPrice || originalPrice <= 0) return 0;
    return originalPrice * (1 + margin / 100);
  }

  /**
   * Préparer un produit CJ pour publication
   * Crée un Product (draft) depuis CJProductStore
   */
  /**
   * Mapper automatiquement une catégorie externe vers une catégorie interne
   */
  private async mapExternalCategory(externalCategory: string, supplierId: string): Promise<string | null> {
    if (!externalCategory || !supplierId) {
      return null;
    }

    console.log(`🔍 [MAP-CATEGORY] Recherche mapping pour: "${externalCategory}" (Supplier: ${supplierId})`);

    // Vérifier s'il existe un mapping pour cette catégorie externe
    const existingMapping = await this.prisma.categoryMapping.findFirst({
      where: {
        supplierId: supplierId,
        externalCategory: externalCategory
      }
    });

    if (existingMapping) {
      console.log(`✅ [MAP-CATEGORY] Mapping trouvé: ${externalCategory} → ${existingMapping.internalCategory}`);
      
      // Vérifier si internalCategory est un ID valide
      const category = await this.prisma.category.findUnique({
        where: { id: existingMapping.internalCategory }
      });

      if (category) {
        console.log(`✅ [MAP-CATEGORY] Catégorie interne trouvée: ${category.name} (ID: ${category.id})`);
        return category.id;
      } else {
        console.warn(`⚠️ [MAP-CATEGORY] Catégorie interne non trouvée pour ID: ${existingMapping.internalCategory}`);
      }
    } else {
      console.log(`❌ [MAP-CATEGORY] Aucun mapping trouvé pour "${externalCategory}"`);
    }

    return null;
  }

  async prepareCJProductForPublication(
    cjStoreProductId: string,
    prepareData: PrepareProductDto,
    userId?: string
  ) {
    console.log('🚀 [PREPARE] Début préparation produit:', { cjStoreProductId, prepareData, userId });
    
    // 1. Récupérer le produit depuis CJProductStore
    const cjProduct = await this.prisma.cJProductStore.findUnique({
      where: { id: cjStoreProductId }
    });

    if (!cjProduct) {
      console.error('❌ [PREPARE] Produit CJ non trouvé:', cjStoreProductId);
      throw new NotFoundException('Produit CJ non trouvé dans le magasin');
    }

    console.log('✅ [PREPARE] Produit CJ trouvé:', { id: cjProduct.id, name: cjProduct.name, cjProductId: cjProduct.cjProductId });

    // 2. Vérifier si le produit n'est pas déjà dans Product
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        cjProductId: cjProduct.cjProductId
      }
    });

    if (existingProduct) {
      console.warn('⚠️ [PREPARE] Produit déjà dans le catalogue:', existingProduct.id);
      throw new BadRequestException('Ce produit CJ est déjà dans le catalogue');
    }

    // 3. ✅ NOUVEAU : Vérifier le mapping de catégorie automatiquement
    let categoryId = prepareData.categoryId;
    if (prepareData.supplierId && cjProduct.category) {
      const mappedCategoryId = await this.mapExternalCategory(cjProduct.category, prepareData.supplierId);
      if (mappedCategoryId) {
        console.log(`✅ [PREPARE] Catégorie mappée automatiquement: ${cjProduct.category} → ${mappedCategoryId}`);
        categoryId = mappedCategoryId; // Utiliser la catégorie mappée si elle existe
      } else {
        console.log(`⚠️ [PREPARE] Aucun mapping trouvé, utilisation de la catégorie fournie: ${prepareData.categoryId}`);
      }
    }

    // 4. Nettoyage automatique (Niveau 1)
    const cleanedName = this.cleanProductName(cjProduct.name);
      const cleanedDescription = this.formatProductDescription(cjProduct.description || '');
    const margin = prepareData.margin || 30;
    const originalPrice = cjProduct.originalPrice || cjProduct.price;
    const calculatedPrice = this.calculatePriceWithMargin(originalPrice, margin);

    // 5. Préparer les données pour Product
    // ✅ Copier automatiquement les données anglaises depuis CJ
    const productData: any = {
      name: cleanedName, // Nom par défaut (anglais)
      name_en: cleanedName, // ✅ Copier automatiquement en anglais
      name_fr: null, // ✅ À remplir par l'admin lors de l'édition
      description: cleanedDescription, // Description par défaut (anglais)
      description_en: cleanedDescription, // ✅ Copier automatiquement en anglais
      description_fr: null, // ✅ À remplir par l'admin lors de l'édition
      price: calculatedPrice,
      originalPrice: originalPrice,
      image: cjProduct.image,
      categoryId: categoryId, // ✅ Utiliser la catégorie mappée ou celle fournie
      supplierId: prepareData.supplierId,
      externalCategory: cjProduct.category,
      source: 'cj-dropshipping',
      status: 'draft', // Statut draft pour édition
      margin: margin,
      stock: 0, // Par défaut, sera mis à jour si nécessaire
      
      // Données CJ détaillées
      cjProductId: cjProduct.cjProductId,
      productSku: cjProduct.productSku,
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

    console.log('💾 [PREPARE] Données du produit à créer:', {
      name: productData.name,
      price: productData.price,
      status: productData.status,
      categoryId: productData.categoryId,
      cjProductId: productData.cjProductId
    });

    // 5. Créer le Product (draft)
    try {
      const product = await this.prisma.product.create({
        data: {
          ...productData,
          cjMapping: {
            create: {
              cjProductId: cjProduct.cjProductId,
              cjSku: cjProduct.productSku || cjProduct.cjProductId
            }
          }
        },
        include: {
          category: true,
          supplier: true,
          cjMapping: true
        }
      });

      console.log('✅ [PREPARE] Produit créé avec succès:', {
        id: product.id,
        name: product.name,
        status: product.status,
        categoryId: product.categoryId
      });

      // ✅ Synchroniser les reviews en arrière-plan (ne bloque pas l'import)
      this.syncProductReviewsInBackground(product.id, cjProduct.cjProductId);

      // 6. 🆕 CRÉER LES PRODUCTVARIANTS AVEC LEURS STOCKS
      console.log('📦 [PREPARE] Création des ProductVariants avec stocks...');
      
      try {
        // 🆕 Récupérer les stocks en temps réel depuis l'API CJ
        let variantsWithStock: any[] = [];
        
        if (cjProduct.cjProductId) {
          try {
            console.log(`📡 [PREPARE] Récupération des stocks pour PID: ${cjProduct.cjProductId}`);
            
            // Charger le token CJ depuis la base de données
            await this.cjApiClient.loadTokenFromDatabase();
            
            // Récupérer les variants avec leurs stocks
            variantsWithStock = await this.cjApiClient.getProductVariantsWithStock(cjProduct.cjProductId);
            console.log(`✅ [PREPARE] ${variantsWithStock.length} variants avec stocks récupérés`);
          } catch (stockError) {
            console.warn('⚠️ [PREPARE] Impossible de récupérer les stocks en temps réel:', stockError);
            // Fallback : utiliser les variants depuis CJProductStore (sans stock)
            variantsWithStock = [];
          }
        }
        
        // Si pas de stocks récupérés, utiliser les variants depuis CJProductStore
        let variants: any[] = variantsWithStock.length > 0 ? variantsWithStock : [];
        
        if (variants.length === 0 && cjProduct.variants) {
          try {
            variants = typeof cjProduct.variants === 'string' 
              ? JSON.parse(cjProduct.variants)
              : cjProduct.variants;
            console.log(`📦 [PREPARE] Utilisation de ${variants.length} variants depuis CJProductStore (sans stocks en temps réel)`);
          } catch (e) {
            console.warn('⚠️ [PREPARE] Erreur parsing variants:', e);
          }
        }

        if (variants && variants.length > 0) {
          console.log(`📊 [PREPARE] ${variants.length} variants à créer`);
          
          let createdCount = 0;
          for (const variant of variants) {
            try {
              // Parser variantKey si c'est un JSON string
              let parsedKey = variant.variantKey;
              try {
                if (parsedKey && parsedKey.startsWith('[')) {
                  const parsed = JSON.parse(parsedKey);
                  parsedKey = Array.isArray(parsed) ? parsed.join('-') : parsedKey;
                }
              } catch {}

              // Récupérer le stock depuis le variant CJ (peut être dans stock ou variantStock)
              const stockValue = parseInt(variant.stock || variant.variantStock || '0', 10);
              
              await this.prisma.productVariant.create({
                data: {
                  productId: product.id,
                  cjVariantId: variant.vid || variant.variantId || '',
                  name: variant.variantNameEn || variant.variantName || `Variant ${variant.variantSku}`,
                  sku: variant.variantSku || '',
                  price: parseFloat(variant.variantSellPrice || variant.sellPrice || '0'),
                  weight: parseFloat(variant.variantWeight || '0'),
                  dimensions: variant.variantLength && variant.variantWidth && variant.variantHeight
                    ? JSON.stringify({
                        length: variant.variantLength,
                        width: variant.variantWidth,
                        height: variant.variantHeight,
                        volume: variant.variantVolume
                      })
                    : null,
                  image: variant.variantImage || null,
                  stock: stockValue,  // ✅ STOCK SAUVEGARDÉ
                  properties: JSON.stringify({
                    key: parsedKey,
                    property: variant.variantProperty,
                    standard: variant.variantStandard,
                    unit: variant.variantUnit
                  }),
                  status: stockValue > 0 ? 'available' : 'out_of_stock',
                  isActive: true,
                  lastSyncAt: new Date()
                }
              });
              createdCount++;
            } catch (variantError: any) {
              if (!variantError.message?.includes('Unique constraint')) {
                console.warn(`⚠️ [PREPARE] Erreur création variant: ${variantError.message}`);
              }
            }
          }
          
          console.log(`✅ [PREPARE] ${createdCount} ProductVariants créés avec stocks`);
        } else {
          console.log('⚠️ [PREPARE] Aucun variant à créer');
        }
      } catch (error) {
        console.error('❌ [PREPARE] Erreur lors de la création des variants:', error);
        // Ne pas bloquer la création du produit si les variants échouent
      }

      // 7. Marquer comme importé dans CJProductStore
      await this.prisma.cJProductStore.update({
        where: { id: cjStoreProductId },
        data: { status: 'imported' }
      });

      console.log('✅ [PREPARE] Produit CJ marqué comme importé');

      return product;
    } catch (error) {
      console.error('❌ [PREPARE] Erreur lors de la création du produit:', error);
      throw error;
    }
  }

  /**
   * Éditer un produit en draft
   */
  async editDraftProduct(
    id: string,
    editData: EditProductDto,
    userId?: string
  ) {
    // 1. Vérifier que le produit existe et est en draft
    const product = await this.prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    if (product.status !== 'draft') {
      throw new BadRequestException('Seuls les produits en draft peuvent être édités');
    }

    // 2. Préparer les données de mise à jour
    const updateData: any = {};

    // Nom
    if (editData.name !== undefined) {
      updateData.name = this.cleanProductName(editData.name);
    }

    // Description
    if (editData.description !== undefined) {
      updateData.description = this.formatProductDescription(editData.description);
    }

    // Marge et prix
    if (editData.margin !== undefined) {
      updateData.margin = editData.margin;
      // Recalculer le prix si originalPrice existe
      if (product.originalPrice) {
        updateData.price = this.calculatePriceWithMargin(product.originalPrice, editData.margin);
      }
    }

    // Catégorie
    if (editData.categoryId !== undefined) {
      updateData.categoryId = editData.categoryId;
    }

    // Image
    if (editData.image !== undefined) {
      updateData.image = editData.image;
    }

    // Images multiples (si fourni)
    if (editData.images !== undefined && editData.images.length > 0) {
      // Supprimer les anciennes images
      await this.prisma.image.deleteMany({
        where: { productId: id }
      });

      // Créer les nouvelles images
      await this.prisma.image.createMany({
        data: editData.images.map((url, index) => ({
          productId: id,
          url: url,
          alt: `${product.name} - Image ${index + 1}`
        }))
      });
    }

    // Badge
    if (editData.badge !== undefined) {
      updateData.badge = editData.badge;
    }

    // Stock
    if (editData.stock !== undefined) {
      updateData.stock = editData.stock;
    }

    // Marquer comme édité
    updateData.isEdited = true;
    updateData.editedAt = new Date();
    if (userId) {
      updateData.editedBy = userId;
    }

    // 3. Mettre à jour le produit
    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        supplier: true,
        images: true,
        cjMapping: true
      }
    });

    return updatedProduct;
  }

  /**
   * Mettre à jour un produit (publié ou draft)
   */
  async updateProduct(
    id: string,
    updateData: {
      name?: string;
      description?: string;
      price?: number;
      originalPrice?: number;
      stock?: number;
      categoryId?: string;
      supplierId?: string;
      status?: string;
      badge?: string | null;
      type?: string;
      image?: string;
    },
    userId?: string
  ) {
    try {
      // 1. Vérifier que le produit existe
      const product = await this.prisma.product.findUnique({
        where: { id }
      });

      if (!product) {
        throw new NotFoundException('Produit non trouvé');
      }

      // 2. Préparer les données de mise à jour
      const data: any = {};

      if (updateData.name !== undefined && updateData.name !== null) {
        data.name = this.cleanProductName(updateData.name);
      }

      if (updateData.description !== undefined && updateData.description !== null) {
        data.description = this.formatProductDescription(updateData.description);
      }

      if (updateData.price !== undefined && updateData.price !== null) {
        data.price = Number(updateData.price);
      }

      if (updateData.originalPrice !== undefined) {
        data.originalPrice = updateData.originalPrice ? Number(updateData.originalPrice) : null;
      }

      if (updateData.stock !== undefined && updateData.stock !== null) {
        data.stock = Number(updateData.stock);
      }

      if (updateData.categoryId !== undefined) {
        if (updateData.categoryId && updateData.categoryId.trim() !== '') {
          data.category = {
            connect: { id: updateData.categoryId }
          };
        } else {
          data.category = {
            disconnect: true
          };
        }
      }

      if (updateData.supplierId !== undefined) {
        if (updateData.supplierId && updateData.supplierId.trim() !== '') {
          data.supplier = {
            connect: { id: updateData.supplierId }
          };
        } else {
          data.supplier = {
            disconnect: true
          };
        }
      }

      if (updateData.status !== undefined && updateData.status !== null) {
        data.status = updateData.status;
      }

      if (updateData.badge !== undefined) {
        data.badge = updateData.badge || null;
      }

      // Le champ 'type' n'existe pas dans le modèle Product
      // Si vous voulez mettre à jour productType, utilisez productType dans updateData
      // if (updateData.productType !== undefined) {
      //   data.productType = updateData.productType || null;
      // }

      if (updateData.image !== undefined) {
        data.image = updateData.image || null;
      }

      // Vérifier qu'il y a des données à mettre à jour
      if (Object.keys(data).length === 0) {
        // Aucune modification, retourner le produit tel quel
        const product = await this.prisma.product.findUnique({
          where: { id },
          include: {
            category: true,
            supplier: true,
            images: true,
            cjMapping: true
          }
        });
        return {
          data: product,
          message: 'Aucune modification effectuée'
        };
      }

      // 3. Mettre à jour le produit
      this.logger.log(`🔄 Mise à jour du produit ${id} avec les champs: ${Object.keys(data).join(', ')}`);
      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data,
        include: {
          category: true,
          supplier: true,
          images: true,
          cjMapping: true
        }
      });

      this.logger.log(`✅ Produit ${id} mis à jour avec succès`);
      return {
        data: updatedProduct,
        message: 'Produit mis à jour avec succès'
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur lors de la mise à jour du produit ${id}:`, error);
      this.logger.error(`❌ Détails de l'erreur:`, error.message, error.stack);
      throw error;
    }
  }

  /**
   * Publier un produit draft (passer à active)
   */
  async publishProduct(id: string) {
    // 1. Vérifier que le produit existe et est en draft
    const product = await this.prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    if (product.status !== 'draft') {
      throw new BadRequestException('Seuls les produits en draft peuvent être publiés');
    }

    // 2. Vérifications avant publication
    if (!product.categoryId) {
      throw new BadRequestException('Une catégorie est requise pour publier le produit');
    }

    if (!product.name || product.name.trim() === '') {
      throw new BadRequestException('Un nom est requis pour publier le produit');
    }

    if (product.price <= 0) {
      throw new BadRequestException('Un prix valide est requis pour publier le produit');
    }

    // ✅ Vérification optionnelle : s'assurer qu'on a au moins une traduction
    // (Avertissement mais ne bloque pas la publication)
    const productWithTranslations = product as any;
    if (!productWithTranslations.name_fr && !productWithTranslations.name_en) {
      this.logger.warn(`⚠️ Produit ${id} publié sans traduction française ni anglaise`);
    }

    // 3. Passer à active
    const publishedProduct = await this.prisma.product.update({
      where: { id },
      data: { status: 'active' },
      include: {
        category: true,
        supplier: true,
        images: true,
        cjMapping: true
      }
    });

    return publishedProduct;
  }

  /**
   * Obtenir tous les produits en draft (pour édition)
   */
  async getDraftProducts() {
    console.log('📋 [GET-DRAFT] Récupération des produits draft...');
    
    const products = await this.prisma.product.findMany({
      where: {
        status: 'draft'
      },
      include: {
        category: true,
        supplier: true,
        images: true,
        productVariants: {
          // ✅ Inclure TOUS les champs des variants
          select: {
            id: true,
            productId: true,
            cjVariantId: true,
            name: true,
            sku: true,
            price: true,
            weight: true,
            dimensions: true,
            image: true,
            status: true,
            properties: true,
            stock: true,
            isActive: true,
            lastSyncAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        cjMapping: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📋 [GET-DRAFT] ${products.length} produit(s) draft trouvé(s)`);
    if (products.length > 0) {
      // Log détaillé avec catégories
      const productsByCategory = products.reduce((acc, p) => {
        const catName = p.category?.name || 'Sans catégorie';
        if (!acc[catName]) acc[catName] = [];
        acc[catName].push(p);
        return acc;
      }, {} as Record<string, typeof products[number][]>);
      
      console.log('📋 [GET-DRAFT] Produits par catégorie:');
      Object.entries(productsByCategory).forEach(([catName, prods]: [string, typeof products[number][]]) => {
        console.log(`  - ${catName}: ${prods.length} produit(s)`);
      });
      
      console.log('📋 [GET-DRAFT] Détails produits:', products.map(p => ({ 
        id: p.id, 
        name: p.name, 
        status: p.status,
        categoryId: p.categoryId,
        categoryName: p.category?.name || 'SANS CATÉGORIE',
        supplierId: p.supplierId,
        variantsCount: p.productVariants?.length || 0,
        hasVariantsJson: !!p.variants,
        variantsJsonLength: (() => {
          if (!p.variants) return 0;
          try {
            // p.variants est toujours une string selon Prisma, on doit la parser
            const variantsValue = p.variants as string | null | undefined;
            if (!variantsValue || typeof variantsValue !== 'string') return 0;
            
            const parsed = JSON.parse(variantsValue);
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            return 0;
          }
        })()
      })));
    }
    
    // ✅ Transformer les données pour le frontend et calculer le stock total
    return products.map(product => {
      const processed = this.processProductImages(product);
      
      // Calculer le stock total depuis les variants
      let totalStock = 0;
      if (processed.productVariants && processed.productVariants.length > 0) {
        totalStock = processed.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
      }
      
      return { 
        ...processed, 
        stock: totalStock
      };
    });
  }

  /**
   * Obtenir un produit draft par ID
   */
  async getDraftProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id, status: 'draft' },
      include: {
        category: true,
        supplier: true,
        images: true,
        productVariants: {
          // ✅ Inclure TOUS les champs des variants
          select: {
            id: true,
            productId: true,
            cjVariantId: true,
            name: true,
            sku: true,
            price: true,
            weight: true,
            dimensions: true,
            image: true,
            status: true,
            properties: true,
            stock: true,
            isActive: true,
            lastSyncAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        cjMapping: true
      }
    });

    if (!product) {
      throw new NotFoundException('Produit draft non trouvé');
    }

    // ✅ Traiter les images et calculer le stock total
    const processed = this.processProductImages(product);
    // ✅ Calculer le stock total depuis les variants
    if (processed.productVariants && processed.productVariants.length > 0) {
      const totalStock = processed.productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
      return { ...processed, stock: totalStock };
    }
    return processed;
  }

  /**
   * Mettre à jour automatiquement les produits draft sans catégorie qui ont un mapping
   */
  async updateDraftProductsWithMapping() {
    console.log('🔄 [UPDATE-DRAFT] Mise à jour des produits draft sans catégorie...');

    // Récupérer tous les produits draft sans catégorie
    const draftProductsWithoutCategory = await this.prisma.product.findMany({
      where: {
        status: 'draft',
        categoryId: null,
        externalCategory: { not: null },
        supplierId: { not: null }
      },
      include: {
        supplier: true
      }
    });

    console.log(`📋 [UPDATE-DRAFT] ${draftProductsWithoutCategory.length} produit(s) draft sans catégorie trouvé(s)`);

    let updatedCount = 0;

    for (const product of draftProductsWithoutCategory) {
      if (!product.externalCategory || !product.supplierId) {
        continue;
      }

      // Vérifier le mapping
      const mappedCategoryId = await this.mapExternalCategory(product.externalCategory, product.supplierId);

      if (mappedCategoryId) {
        // Mettre à jour le produit avec la catégorie mappée
        await this.prisma.product.update({
          where: { id: product.id },
          data: { categoryId: mappedCategoryId }
        });

        console.log(`✅ [UPDATE-DRAFT] Produit ${product.id} mis à jour avec catégorie: ${mappedCategoryId}`);
        updatedCount++;
      }
    }

    console.log(`✅ [UPDATE-DRAFT] ${updatedCount} produit(s) mis à jour avec succès`);

    return {
      total: draftProductsWithoutCategory.length,
      updated: updatedCount
    };
  }

  // ===== NOTIFICATIONS DE MISE À JOUR DE PRODUITS =====

  async getUpdateNotifications(unreadOnly: boolean = false, limit: number = 50) {
    const where: any = {};
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await this.prisma.productUpdateNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Parser les changements JSON
    const formattedNotifications = notifications.map(notif => ({
      ...notif,
      changes: notif.changes ? JSON.parse(notif.changes) : []
    }));

    return {
      notifications: formattedNotifications,
      total: await this.prisma.productUpdateNotification.count({ where }),
      unreadCount: await this.prisma.productUpdateNotification.count({ where: { isRead: false } })
    };
  }

  async markNotificationAsRead(id: string) {
    return this.prisma.productUpdateNotification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
  }

  async markAllNotificationsAsRead() {
    const result = await this.prisma.productUpdateNotification.updateMany({
      where: { isRead: false },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return {
      updated: result.count
    };
  }

  /**
   * Nettoyer les descriptions de tous les produits
   * Supprime les informations Weight/Dimensions souvent fausses
   */
  async cleanupAllDescriptions() {
    console.log('🧹 === NETTOYAGE DES DESCRIPTIONS ===');
    
    try {
      // Récupérer tous les produits avec descriptions
      const products = await this.prisma.product.findMany({
        where: {
          description: { not: null }
        },
        select: {
          id: true,
          name: true,
          description: true
        }
      });
      
      console.log(`📦 ${products.length} produits à traiter`);
      
      let updated = 0;
      let unchanged = 0;
      
      for (const product of products) {
        const originalDesc = product.description || '';
        
        // Nettoyer la description
        const cleanedDesc = this.cleanDescription(originalDesc);
        
        // Vérifier si la description a changé
        if (cleanedDesc !== originalDesc) {
          await this.prisma.product.update({
            where: { id: product.id },
            data: { description: cleanedDesc }
          });
          updated++;
          console.log(`✅ ${product.name.substring(0, 50)}: ${originalDesc.length} → ${cleanedDesc.length} caractères`);
        } else {
          unchanged++;
        }
      }
      
      console.log('\n==============================================');
      console.log(`✅ ${updated} descriptions mises à jour`);
      console.log(`⏭️  ${unchanged} descriptions inchangées`);
      console.log('==============================================\n');
      
      return {
        success: true,
        updated,
        unchanged,
        total: products.length
      };
      
    } catch (error) {
      console.error('❌ Erreur nettoyage descriptions:', error);
      throw error;
    }
  }

  /**
   * Nettoyer une description (supprimer HTML, CSS, markdown et infos techniques fausses)
   */
  private cleanDescription(description: string): string {
    if (!description) return '';
    
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
    
    // ✅ Supprimer les lignes qui ne contiennent que du CSS/markdown
    const lines = cleaned.split('\n');
    const cleanLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;
      if (/^[#@{}:;,\s-]+$/.test(trimmed)) return false;
      if (/^[a-zA-Z0-9_-]+\s*\{/.test(trimmed)) return false;
      if (trimmed.includes('{') && trimmed.includes('}') && trimmed.length < 50) return false;
      // Supprimer les lignes qui sont des spécifications techniques
      if (/^[A-Z][a-zA-Z\s]+:\s*[A-Z]/.test(trimmed) && trimmed.length < 100) return false;
      return true;
    });
    cleaned = cleanLines.join('\n');
    
    return cleaned.trim();
  }
}

