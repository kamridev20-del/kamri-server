import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DuplicatePreventionService } from '../common/services/duplicate-prevention.service';

@Injectable()
export class StoresService {
  constructor(
    private prisma: PrismaService,
    private duplicateService: DuplicatePreventionService
  ) {}

  /**
   * Mapper automatiquement une catégorie externe vers une catégorie interne
   */
  private async mapExternalCategory(externalCategory: string, supplierId: string): Promise<string | null> {
    if (!externalCategory || !supplierId) {
      return null;
    }

    console.log(`🔍 [STORES-MAP] Recherche mapping pour: "${externalCategory}" (Supplier: ${supplierId})`);

    // Vérifier s'il existe un mapping pour cette catégorie externe
    const existingMapping = await this.prisma.categoryMapping.findFirst({
      where: {
        supplierId: supplierId,
        externalCategory: externalCategory
      }
    });

    if (existingMapping) {
      console.log(`✅ [STORES-MAP] Mapping trouvé: ${externalCategory} → ${existingMapping.internalCategory}`);
      
      // Vérifier si internalCategory est un ID valide
      const category = await this.prisma.category.findUnique({
        where: { id: existingMapping.internalCategory }
      });

      if (category) {
        console.log(`✅ [STORES-MAP] Catégorie interne trouvée: ${category.name} (ID: ${category.id})`);
        return category.id;
      } else {
        console.warn(`⚠️ [STORES-MAP] Catégorie interne non trouvée pour ID: ${existingMapping.internalCategory}`);
      }
    } else {
      console.log(`❌ [STORES-MAP] Aucun mapping trouvé pour "${externalCategory}"`);
    }

    return null;
  }

  // ✅ Obtenir tous les magasins disponibles
  async getAllStores() {
    const stores = [];

    // Magasin CJ Dropshipping
    const cjConfig = await this.prisma.cJConfig.findFirst();
    if (cjConfig && cjConfig.enabled) {
      const cjStats = await this.getCJStoreStats();
      stores.push({
        id: 'cj-dropshipping',
        name: 'CJ Dropshipping',
        description: 'Magasin de produits CJ Dropshipping',
        type: 'cj-dropshipping',
        status: cjConfig.enabled ? 'active' : 'inactive',
        stats: cjStats,
        lastSync: await this.getCJLastSync(),
        config: {
          email: cjConfig.email,
          tier: cjConfig.tier,
          enabled: cjConfig.enabled
        }
      });
    }

    // Ajouter d'autres magasins ici (AliExpress, Shopify, etc.)
    
    return stores;
  }

  // ✅ Obtenir les produits d'un magasin spécifique
  async getStoreProducts(storeId: string, filters?: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    if (storeId === 'cj-dropshipping') {
      const result = await this.getCJStoreProducts(filters);
      
      // Récupérer les catégories uniques pour le filtre
      const uniqueCategories = await this.prisma.cJProductStore.findMany({
        distinct: ['category'],
        select: { category: true },
        where: {
          AND: [
            { category: { not: null } },
            { category: { not: '' } }
          ]
        },
      });
      const categories = uniqueCategories.map(c => c.category!).filter(Boolean) as string[];

      return { 
        products: result.products, 
        pagination: result.pagination,
        categories 
      };
    }

    throw new Error(`Magasin ${storeId} non trouvé`);
  }

  // ✅ Obtenir les statistiques d'un magasin
  async getStoreStats(storeId: string) {
    if (storeId === 'cj-dropshipping') {
      return this.getCJStoreStats();
    }

    throw new Error(`Magasin ${storeId} non trouvé`);
  }

  // ✅ Méthodes spécifiques pour le magasin CJ
  private async getCJStoreProducts(filters?: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.category) {
      where.category = {
        contains: filters.category,
        mode: 'insensitive'
      };
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.cJProductStore.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.cJProductStore.count({ where })
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  private async getCJStoreStats() {
    const [total, available, imported, selected] = await Promise.all([
      this.prisma.cJProductStore.count(),
      this.prisma.cJProductStore.count({ where: { status: 'available' } }),
      this.prisma.cJProductStore.count({ where: { status: 'imported' } }),
      this.prisma.cJProductStore.count({ where: { status: 'selected' } })
    ]);

    return {
      total,
      available,
      imported,
      selected,
      pending: total - available - imported - selected
    };
  }

  private async getCJLastSync() {
    const lastProduct = await this.prisma.cJProductStore.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    return lastProduct?.createdAt || null;
  }

  // ✅ Sélectionner/désélectionner des produits
  async toggleProductSelection(storeId: string, productId: string) {
    if (storeId === 'cj-dropshipping') {
      const product = await this.prisma.cJProductStore.findUnique({
        where: { id: productId }
      });

      if (!product) {
        throw new Error('Produit non trouvé');
      }

      const newStatus = product.status === 'selected' ? 'available' : 'selected';
      
      return this.prisma.cJProductStore.update({
        where: { id: productId },
        data: { status: newStatus }
      });
    }

    throw new Error(`Magasin ${storeId} non trouvé`);
  }

  // ✅ Importer les produits sélectionnés
  async importSelectedProducts(storeId: string) {
    if (storeId === 'cj-dropshipping') {
      // Récupérer l'ID du fournisseur CJ Dropshipping
      const cjSupplier = await this.prisma.supplier.findFirst({
        where: { name: 'CJ Dropshipping' }
      });

      if (!cjSupplier) {
        return {
          message: 'Fournisseur CJ Dropshipping non trouvé',
          imported: 0
        };
      }

      const selectedProducts = await this.prisma.cJProductStore.findMany({
        where: { status: 'selected' }
      });

      if (selectedProducts.length === 0) {
        return {
          message: 'Aucun produit sélectionné',
          imported: 0
        };
      }

      const importedProducts = [];

      for (const cjProduct of selectedProducts) {
        try {
          console.log(`🔄 Import du produit: ${cjProduct.name}`);
          
          // Préparer les données du produit pour la vérification anti-doublons
          const productDataForCheck = {
            name: cjProduct.name,
            price: cjProduct.price,
            description: cjProduct.description
          };
          
          // ✅ NOUVELLE LOGIQUE ANTI-DOUBLONS : Vérifier avant de créer
          const duplicateCheck = await this.duplicateService.checkCJProductDuplicate(
            cjProduct.cjProductId || '', 
            cjProduct.productSku,
            productDataForCheck
          );
          
          if (duplicateCheck.isDuplicate && duplicateCheck.existingProduct) {
            console.log(`⚠️ Produit déjà existant (doublon détecté): ${duplicateCheck.reason}`);
            // Marquer le produit du magasin comme importé même si c'est un doublon
            await this.prisma.cJProductStore.update({
              where: { id: cjProduct.id },
              data: { status: 'imported' }
            });
            
            // Créer le mapping pour le produit existant
            await this.prisma.cJProductMapping.create({
              data: {
                productId: duplicateCheck.existingProduct.id,
                cjProductId: cjProduct.cjProductId || '',
                cjSku: cjProduct.productSku || ''
              }
            });
            
            continue; // Passer au produit suivant
          }
          
          // ✅ NOUVEAU : Vérifier le mapping de catégorie automatiquement
          let categoryId: string | null = null;
          if (cjProduct.category) {
            categoryId = await this.mapExternalCategory(cjProduct.category, cjSupplier.id);
            if (categoryId) {
              console.log(`✅ [IMPORT] Catégorie mappée automatiquement: ${cjProduct.category} → ${categoryId}`);
            } else {
              console.log(`⚠️ [IMPORT] Aucun mapping trouvé pour "${cjProduct.category}", produit créé sans catégorie`);
            }
          }

          // Préparer les données du produit pour l'upsert intelligent
          const productData = {
            name: cjProduct.name,
            description: cjProduct.description,
            price: cjProduct.price,
            originalPrice: cjProduct.originalPrice,
            image: cjProduct.image,
            supplierId: cjSupplier.id, // Utiliser l'ID réel du fournisseur
            externalCategory: cjProduct.category,
            categoryId: categoryId, // ✅ Utiliser la catégorie mappée si elle existe
            source: 'cj-dropshipping',
            status: 'draft', // ✅ Unifié : tous les produits passent par draft
            badge: 'nouveau',
            stock: Math.floor(Math.random() * 50) + 10,
            
            // ✅ CRUCIAL : Ajouter cjProductId pour la protection anti-doublons
            cjProductId: cjProduct.cjProductId || '', // ✅ Champ manquant !
            
            // ✅ TOUTES LES DONNÉES DÉTAILLÉES CJ
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
            variants: cjProduct.variants, // JSON des 48+ variants
            cjReviews: cjProduct.reviews, // JSON des avis CJ
            dimensions: cjProduct.dimensions,
            brand: cjProduct.brand,
            tags: cjProduct.tags, // JSON des tags
          };
          
          // ✅ UTILISER UPSERT INTELLIGENT avec le service anti-doublons
          const importResult = await this.duplicateService.upsertCJProduct(productData, duplicateCheck);
          
          const product = await this.prisma.product.findUnique({
            where: { id: importResult.productId }
          });

          // Marquer comme importé
          await this.prisma.cJProductStore.update({
            where: { id: cjProduct.id },
            data: { status: 'imported' }
          });

          // Créer le mapping
          await this.prisma.cJProductMapping.create({
            data: {
              productId: product.id,
              cjProductId: cjProduct.cjProductId,
              cjSku: cjProduct.cjProductId,
              lastSyncAt: new Date(),
            },
          });

          importedProducts.push(product);
        } catch (error) {
          console.error(`Erreur lors de l'import du produit ${cjProduct.name}:`, error);
        }
      }

      return {
        message: `${importedProducts.length} produits importés avec succès`,
        imported: importedProducts.length,
        products: importedProducts
      };
    }

    throw new Error(`Magasin ${storeId} non trouvé`);
  }

}
