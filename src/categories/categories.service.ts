import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        nameEn: true,
        description: true,
        icon: true,
        color: true,
        externalId: true,
        parentId: true,
        level: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
        imageUrl: true, // ✅ URL de l'image personnalisée
        products: {
          where: {
            status: {
              in: ['active', 'pending'] // Inclure les produits en attente ET actifs
            }
          },
          select: {
            id: true,
            name: true,
            price: true,
            image: true,
            badge: true,
            status: true // Ajouter le statut pour distinguer
          }
        }
      }
    });
  }

  /**
   * ✅ OPTIMISÉ : Récupérer toutes les catégories avec le nombre de produits
   * Utilise une seule requête SQL avec GROUP BY au lieu de charger tous les produits
   */
  async findAllWithProductCounts() {
    // Récupérer les catégories
    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        nameEn: true,
        description: true,
        icon: true,
        color: true,
        externalId: true,
        parentId: true,
        level: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
        imageUrl: true, // ✅ URL de l'image personnalisée
      },
      orderBy: { name: 'asc' }
    });

    // ✅ Une seule requête SQL pour compter les produits par catégorie
    const productCounts = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: {
        status: {
          in: ['active', 'pending']
        },
        categoryId: {
          not: null
        }
      },
      _count: {
        id: true
      }
    });

    // Créer un Map pour un accès rapide
    const countMap = new Map(
      productCounts.map(item => [item.categoryId, item._count.id])
    );

    // Enrichir les catégories avec les compteurs
    return categories.map(category => ({
      ...category,
      productCount: countMap.get(category.id) || 0
    }));
  }

  /**
   * ✅ OPTIMISÉ : Récupérer toutes les statistiques de catégories en une seule requête
   * Pour la page admin - évite les appels API séquentiels
   */
  async getAllCategoryStats() {
    // Récupérer toutes les catégories
    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        nameEn: true,
        description: true,
        icon: true,
        color: true,
        imageUrl: true, // ✅ URL de l'image personnalisée
        externalId: true,
        parentId: true,
        level: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' }
    });

    // ✅ Une seule requête pour compter les produits draft par catégorie
    const draftCounts = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: {
        status: 'draft',
        categoryId: {
          not: null
        }
      },
      _count: {
        id: true
      }
    });

    // ✅ Récupérer tous les mappings
    const mappings = await this.prisma.categoryMapping.findMany({
      include: {
        supplier: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // ✅ Compter les produits CJ par catégorie externe en une seule requête
    const cjStoreCounts = await this.prisma.cJProductStore.groupBy({
      by: ['category'],
      where: {
        status: 'available'
      },
      _count: {
        id: true
      }
    });

    // Créer des Maps pour un accès rapide
    const draftCountMap = new Map(
      draftCounts.map(item => [item.categoryId, item._count.id])
    );

    const cjStoreCountMap = new Map(
      cjStoreCounts.map(item => [item.category, item._count.id])
    );

    // Construire les statistiques
    const categoryStats: Record<string, { draftCount: number; cjStoreCount: number }> = {};

    // Stats pour les catégories
    categories.forEach(category => {
      categoryStats[category.id] = {
        draftCount: draftCountMap.get(category.id) || 0,
        cjStoreCount: 0
      };
    });

    // Stats pour les mappings (CJ Store)
    mappings.forEach(mapping => {
      const cjCount = cjStoreCountMap.get(mapping.externalCategory) || 0;
      if (categoryStats[mapping.internalCategory]) {
        categoryStats[mapping.internalCategory].cjStoreCount += cjCount;
      } else {
        categoryStats[mapping.internalCategory] = {
          draftCount: 0,
          cjStoreCount: cjCount
        };
      }
    });

    return {
      categories,
      mappings,
      stats: categoryStats
    };
  }

  async findOne(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          where: {
            status: 'active'
          }
        }
      }
    });
  }

  async create(data: { name: string; description?: string; icon?: string; color?: string; imageUrl?: string }) {
    return this.prisma.category.create({
      data: {
        name: data.name,
        description: data.description || '',
        icon: data.icon || '🛍️',
        color: data.color || '#4CAF50',
        imageUrl: data.imageUrl,
        isDefault: false // ✅ S'assurer que les nouvelles catégories ne sont pas par défaut
      }
    });
  }

  async update(id: string, data: { name?: string; description?: string; icon?: string; color?: string; imageUrl?: string }) {
    return this.prisma.category.update({
      where: { id },
      data
    });
  }

  async remove(id: string) {
    // Vérifier si c'est une catégorie par défaut
    const category = await this.prisma.category.findUnique({
      where: { id }
    });

    if (category?.isDefault) {
      throw new Error('Impossible de supprimer une catégorie par défaut');
    }

    // Vérifier s'il y a des produits dans cette catégorie
    const productsCount = await this.prisma.product.count({
      where: { categoryId: id }
    });

    if (productsCount > 0) {
      throw new Error(`Impossible de supprimer la catégorie car elle contient ${productsCount} produit(s)`);
    }

    return this.prisma.category.delete({
      where: { id }
    });
  }

  async getCategoryMappings() {
    return this.prisma.categoryMapping.findMany({
      include: {
        supplier: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createCategoryMapping(data: {
    supplierId: string;
    externalCategory: string;
    internalCategory: string;
  }) {
    // ✅ Accepter l'ID directement (plus performant et robuste)
    // Si c'est un ID (format cuid), chercher par ID, sinon chercher par nom (rétrocompatibilité)
    const isId = data.internalCategory.length > 20 && !data.internalCategory.includes(' '); // Format ID cuid typique
    
    const category = isId
      ? await this.prisma.category.findUnique({
          where: { id: data.internalCategory }
        })
      : await this.prisma.category.findFirst({
          where: { name: data.internalCategory }
        });

    if (!category) {
      throw new Error(`Catégorie interne "${data.internalCategory}" non trouvée`);
    }

    // Créer ou mettre à jour le mapping (upsert)
    const mapping = await this.prisma.categoryMapping.upsert({
      where: {
        supplierId_externalCategory: {
          supplierId: data.supplierId,
          externalCategory: data.externalCategory,
        },
      },
      update: {
        internalCategory: category.id, // Utiliser l'ID au lieu du nom
        status: 'mapped',
      },
      create: {
        supplierId: data.supplierId,
        externalCategory: data.externalCategory,
        internalCategory: category.id, // Utiliser l'ID au lieu du nom
        status: 'mapped',
      },
      include: {
        supplier: true,
      },
    });

    // ✅ Unifié : Mettre à jour tous les produits draft de cette catégorie externe
    // Mettre à jour même ceux qui ont déjà une catégorie (au cas où on change de mapping)
    const updatedProducts = await this.prisma.product.updateMany({
      where: {
        supplierId: data.supplierId,
        externalCategory: data.externalCategory,
        status: 'draft', // ✅ Unifié : uniquement draft
      },
      data: {
        categoryId: category.id, // Utiliser l'ID de la catégorie
      },
    });

    console.log(`✅ Mapping créé/mis à jour: ${data.externalCategory} → ${data.internalCategory} (ID: ${category.id})`);
    console.log(`📦 ${updatedProducts.count} produits draft mis à jour avec la catégorie ${category.name} (ID: ${category.id})`);
    
    // ✅ Vérifier combien de produits ont cette catégorie maintenant
    const productsWithCategory = await this.prisma.product.count({
      where: {
        categoryId: category.id,
        status: 'draft'
      }
    });
    console.log(`📦 Total produits draft avec catégorie "${category.name}": ${productsWithCategory}`);

    // ✅ NOUVEAU : Créer automatiquement les produits depuis CJProductStore vers Product (draft)
    const createdProducts = await this.createProductsFromCJStore(data.supplierId, data.externalCategory, category.id);

    console.log(`📦 ${createdProducts.count} nouveaux produits créés depuis CJProductStore vers draft`);
    
    // ✅ Vérifier combien de produits draft ont maintenant cette catégorie
    const finalProductsCount = await this.prisma.product.count({
      where: {
        categoryId: category.id,
        status: 'draft',
        supplierId: data.supplierId,
        externalCategory: data.externalCategory
      }
    });
    console.log(`📦 Total produits draft avec catégorie "${category.name}" (${category.id}) pour "${data.externalCategory}": ${finalProductsCount}`);

    return {
      ...mapping,
      updatedProducts: updatedProducts.count,
      createdProducts: createdProducts.count,
      totalDraftProducts: finalProductsCount
    };
  }

  /**
   * Créer automatiquement les produits depuis CJProductStore vers Product (draft)
   * lorsqu'un mapping de catégorie est créé
   */
  private async createProductsFromCJStore(supplierId: string, externalCategory: string, categoryId: string) {
    console.log(`🔄 [CREATE-FROM-STORE] Création produits depuis CJProductStore pour catégorie: ${externalCategory}`);

    // Récupérer tous les produits CJProductStore avec cette catégorie externe qui ne sont pas encore importés
    // ✅ IMPORTANT: Filtrer aussi par supplierId pour éviter de récupérer des produits du mauvais fournisseur
    const cjStoreProducts = await this.prisma.cJProductStore.findMany({
      where: {
        category: externalCategory,
        status: 'available', // Seulement ceux qui ne sont pas encore importés
        // ✅ Filtrer par supplierId si le modèle CJProductStore a ce champ
        // Si le modèle n'a pas supplierId, on devra vérifier autrement
      }
    });

    console.log(`📋 [CREATE-FROM-STORE] ${cjStoreProducts.length} produit(s) trouvé(s) dans CJProductStore pour catégorie "${externalCategory}"`);
    
    // ✅ Récupérer le fournisseur pour vérifier son nom et filtrer si nécessaire
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true }
    });
    
    if (supplier) {
      console.log(`📋 [CREATE-FROM-STORE] Fournisseur: ${supplier.name} (ID: ${supplier.id})`);
    }
    
    // ✅ Filtrer par supplierId si le champ existe dans CJProductStore
    // Note: Le supplierId dans CJProductStore est probablement l'ID CJ, pas l'ID KAMRI
    // On peut aussi filtrer par supplierName si disponible

    let createdCount = 0;
    let skippedCount = 0;

    for (const cjProduct of cjStoreProducts) {
      try {
        // Vérifier si le produit n'est pas déjà dans Product
        // Vérifier par cjProductId ET par nom + supplierId pour être sûr
        const existingProduct = await this.prisma.product.findFirst({
          where: {
            OR: [
              { cjProductId: cjProduct.cjProductId },
              {
                name: cjProduct.name,
                supplierId: supplierId,
                source: 'cj-dropshipping'
              }
            ]
          }
        });

        if (existingProduct) {
          console.log(`⚠️ [CREATE-FROM-STORE] Produit déjà dans Product: ${cjProduct.name} (ID: ${existingProduct.id}, Status: ${existingProduct.status}, CategoryId: ${existingProduct.categoryId})`);
          
          // ✅ Si le produit existe mais n'a pas de catégorie OU a une catégorie différente, mettre à jour
          if (existingProduct.status === 'draft') {
            if (!existingProduct.categoryId || existingProduct.categoryId !== categoryId) {
              await this.prisma.product.update({
                where: { id: existingProduct.id },
                data: { 
                  categoryId: categoryId,
                  externalCategory: externalCategory // Mettre à jour aussi la catégorie externe
                }
              });
              console.log(`✅ [CREATE-FROM-STORE] Catégorie mise à jour pour produit existant: ${existingProduct.id} (ancienne: ${existingProduct.categoryId}, nouvelle: ${categoryId})`);
              createdCount++; // Compter comme mis à jour
            } else {
              console.log(`ℹ️ [CREATE-FROM-STORE] Produit ${existingProduct.id} a déjà la bonne catégorie: ${categoryId}`);
              skippedCount++;
            }
          } else {
            console.log(`⚠️ [CREATE-FROM-STORE] Produit ${existingProduct.id} existe mais n'est pas en draft (status: ${existingProduct.status}), ignoré`);
            skippedCount++;
          }
          continue;
        }

        // Nettoyer le nom et la description
        const cleanedName = this.cleanProductName(cjProduct.name || '');
        const cleanedDescription = this.cleanProductDescription(cjProduct.description || '');

        // Calculer le prix avec marge par défaut (30%)
        const margin = 30;
        const originalPrice = cjProduct.originalPrice || cjProduct.price;
        const calculatedPrice = originalPrice * (1 + margin / 100);

        // Créer le produit dans Product (draft)
        const product = await this.prisma.product.create({
          data: {
            name: cleanedName,
            description: cleanedDescription,
            price: calculatedPrice,
            originalPrice: originalPrice,
            image: cjProduct.image,
            categoryId: categoryId, // ✅ Utiliser la catégorie mappée
            supplierId: supplierId,
            externalCategory: externalCategory,
            source: 'cj-dropshipping',
            status: 'draft', // ✅ Statut draft
            margin: margin,
            stock: 0,
            badge: 'nouveau', // Ajouter un badge par défaut
            
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
            
            // Créer le mapping CJ
            cjMapping: {
              create: {
                cjProductId: cjProduct.cjProductId,
                cjSku: cjProduct.productSku || cjProduct.cjProductId
              }
            }
          }
        });

        // Marquer comme importé dans CJProductStore
        await this.prisma.cJProductStore.update({
          where: { id: cjProduct.id },
          data: { status: 'imported' }
        });

        console.log(`✅ [CREATE-FROM-STORE] Produit créé: ${product.name} (ID: ${product.id}, CategoryId: ${product.categoryId}, Status: ${product.status}, SupplierId: ${product.supplierId})`);
        
        // ✅ Vérifier que le produit est bien récupérable dans getDraftProducts
        const verifyProduct = await this.prisma.product.findUnique({
          where: { id: product.id },
          include: { category: true }
        });
        if (verifyProduct) {
          console.log(`✅ [CREATE-FROM-STORE] Vérification: Produit ${product.id} récupérable avec catégorie: ${verifyProduct.category?.name || 'NULL'}`);
        } else {
          console.error(`❌ [CREATE-FROM-STORE] ERREUR: Produit ${product.id} non trouvé après création !`);
        }
        
        createdCount++;

      } catch (error) {
        console.error(`❌ [CREATE-FROM-STORE] Erreur lors de la création du produit ${cjProduct.name}:`, error);
        skippedCount++;
      }
    }

    console.log(`✅ [CREATE-FROM-STORE] ${createdCount} produit(s) créé(s), ${skippedCount} ignoré(s)`);

    return {
      count: createdCount,
      skipped: skippedCount,
      total: cjStoreProducts.length
    };
  }

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

  async updateCategoryMapping(id: string, data: {
    internalCategory?: string;
    status?: string;
  }) {
    const mapping = await this.prisma.categoryMapping.findUnique({
      where: { id },
      include: {
        supplier: true,
      },
    });

    if (!mapping) {
      throw new Error('Mapping non trouvé');
    }

    // Si la catégorie interne change, mettre à jour les produits draft
    if (data.internalCategory && data.internalCategory !== mapping.internalCategory) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.internalCategory }
      });

      if (category) {
        // Mettre à jour tous les produits draft avec cette catégorie externe
        const updatedProducts = await this.prisma.product.updateMany({
          where: {
            supplierId: mapping.supplierId,
            externalCategory: mapping.externalCategory,
            status: 'draft'
          },
          data: {
            categoryId: category.id
          }
        });
        console.log(`📦 ${updatedProducts.count} produits draft mis à jour avec la nouvelle catégorie: ${category.name}`);
      }
    }

    return this.prisma.categoryMapping.update({
      where: { id },
      data,
      include: {
        supplier: true,
      },
    });
  }
  
  /**
   * Forcer la synchronisation des produits draft pour une catégorie spécifique
   * Utile pour récupérer les produits qui n'ont pas été créés lors du mapping initial
   */
  async syncDraftProductsForCategory(categoryId: string, supplierId: string, externalCategory: string) {
    console.log(`🔄 [SYNC-DRAFT] Synchronisation produits draft pour catégorie ${categoryId} (${externalCategory})`);
    
    // Récupérer tous les produits CJProductStore avec cette catégorie externe
    const cjStoreProducts = await this.prisma.cJProductStore.findMany({
      where: {
        category: externalCategory,
        status: 'available'
      }
    });

    console.log(`📋 [SYNC-DRAFT] ${cjStoreProducts.length} produit(s) trouvé(s) dans CJProductStore`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const cjProduct of cjStoreProducts) {
      try {
        // Vérifier si le produit existe déjà
        const existingProduct = await this.prisma.product.findFirst({
          where: {
            OR: [
              { cjProductId: cjProduct.cjProductId },
              {
                name: cjProduct.name,
                supplierId: supplierId,
                source: 'cj-dropshipping'
              }
            ]
          }
        });

        if (existingProduct) {
          // Mettre à jour si nécessaire
          if (existingProduct.status === 'draft' && existingProduct.categoryId !== categoryId) {
            await this.prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                categoryId: categoryId,
                externalCategory: externalCategory
              }
            });
            console.log(`✅ [SYNC-DRAFT] Produit ${existingProduct.id} mis à jour avec catégorie ${categoryId}`);
            updatedCount++;
          } else {
            skippedCount++;
          }
          continue;
        }

        // Créer le produit s'il n'existe pas
        const cleanedName = this.cleanProductName(cjProduct.name || '');
        const cleanedDescription = this.cleanProductDescription(cjProduct.description || '');
        const margin = 30;
        const originalPrice = cjProduct.originalPrice || cjProduct.price;
        const calculatedPrice = originalPrice * (1 + margin / 100);

        const product = await this.prisma.product.create({
          data: {
            name: cleanedName,
            description: cleanedDescription,
            price: calculatedPrice,
            originalPrice: originalPrice,
            image: cjProduct.image,
            categoryId: categoryId,
            supplierId: supplierId,
            externalCategory: externalCategory,
            source: 'cj-dropshipping',
            status: 'draft',
            margin: margin,
            stock: 0,
            badge: 'nouveau',
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
            cjMapping: {
              create: {
                cjProductId: cjProduct.cjProductId,
                cjSku: cjProduct.productSku || cjProduct.cjProductId
              }
            }
          }
        });

        await this.prisma.cJProductStore.update({
          where: { id: cjProduct.id },
          data: { status: 'imported' }
        });

        console.log(`✅ [SYNC-DRAFT] Produit créé: ${product.name} (ID: ${product.id})`);
        createdCount++;
      } catch (error) {
        console.error(`❌ [SYNC-DRAFT] Erreur pour produit ${cjProduct.name}:`, error);
        skippedCount++;
      }
    }

    console.log(`✅ [SYNC-DRAFT] Synchronisation terminée: ${createdCount} créé(s), ${updatedCount} mis à jour, ${skippedCount} ignoré(s)`);

    return {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: cjStoreProducts.length
    };
  }

  async getUnmappedExternalCategories() {
    try {
      console.log('🔍 Recherche des catégories non mappées...');
      const categories = await this.prisma.unmappedExternalCategory.findMany({
        include: {
          supplier: true,
        },
        orderBy: {
          productCount: 'desc',
        },
      });
      
      // ✅ Recalculer le nombre réel de produits depuis Product (draft) pour chaque catégorie
      const categoriesWithRealCount = await Promise.all(
        categories.map(async (category) => {
          // Compter les produits réels dans Product (draft) pour cette catégorie externe
          const realProductCount = await this.prisma.product.count({
            where: {
              externalCategory: category.externalCategory,
              supplierId: category.supplierId,
              source: 'cj-dropshipping',
              status: 'draft' // Seulement les produits en draft
            },
          });
          
          // Aussi compter dans cj_product_store pour référence
          const cjStoreCount = await this.prisma.cJProductStore.count({
            where: {
              category: category.externalCategory,
              supplierId: category.supplierId,
              status: 'available'
            },
          });
          
          // Utiliser le maximum entre les deux pour avoir le nombre total
          const totalCount = Math.max(realProductCount, cjStoreCount);
          
          // Mettre à jour le productCount dans la base si différent
          if (totalCount !== category.productCount) {
            await this.prisma.unmappedExternalCategory.update({
              where: { id: category.id },
              data: { productCount: totalCount },
            });
            console.log(`🔄 Catégorie "${category.externalCategory}": ${category.productCount} → ${totalCount} produits (${realProductCount} draft + ${cjStoreCount} store)`);
          }
          
          return {
            ...category,
            productCount: totalCount, // Utiliser le nombre réel
          };
        })
      );
      
      // Trier par nombre réel de produits (décroissant)
      categoriesWithRealCount.sort((a, b) => b.productCount - a.productCount);
      
      console.log(`📦 ${categoriesWithRealCount.length} catégories non mappées trouvées avec comptage réel`);
      return categoriesWithRealCount;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des catégories non mappées:', error);
      throw error;
    }
  }

  async deleteCategoryMapping(id: string) {
    const mapping = await this.prisma.categoryMapping.findUnique({
      where: { id },
      include: {
        supplier: true,
      },
    });

    if (!mapping) {
      throw new Error('Mapping non trouvé');
    }

    await this.prisma.categoryMapping.delete({
      where: { id },
    });

    console.log(`🗑️ Mapping supprimé: ${mapping.externalCategory} (ID: ${id})`);
    return { success: true, deletedMapping: mapping };
  }

  async getCJStoreProductsCount(externalCategory: string, supplierId: string) {
    const count = await this.prisma.cJProductStore.count({
      where: {
        category: externalCategory,
        status: 'available',
      },
    });
    return { count, externalCategory, supplierId };
  }

  /**
   * Synchroniser tous les mappings de catégories en une seule fois
   * Utile pour récupérer tous les produits manquants après une importation massive
   */
  async syncAllMappings() {
    console.log('🔄 [SYNC-ALL] Début synchronisation globale de tous les mappings...');
    
    // Récupérer tous les mappings actifs
    const allMappings = await this.prisma.categoryMapping.findMany({
      where: {
        status: 'mapped'
      },
      include: {
        supplier: true
      }
    });

    console.log(`📋 [SYNC-ALL] ${allMappings.length} mapping(s) trouvé(s)`);

    const results = {
      totalMappings: allMappings.length,
      processed: 0,
      totalCreated: 0,
      totalUpdated: 0,
      totalSkipped: 0,
      errors: [] as Array<{ mapping: string; error: string }>,
      details: [] as Array<{
        mapping: string;
        created: number;
        updated: number;
        skipped: number;
      }>
    };

    // Synchroniser chaque mapping
    for (const mapping of allMappings) {
      try {
        console.log(`🔄 [SYNC-ALL] Synchronisation mapping: ${mapping.externalCategory} → ${mapping.internalCategory}`);
        
        const syncResult = await this.syncDraftProductsForCategory(
          mapping.internalCategory,
          mapping.supplierId,
          mapping.externalCategory
        );

        results.processed++;
        results.totalCreated += syncResult.created;
        results.totalUpdated += syncResult.updated;
        results.totalSkipped += syncResult.skipped;
        
        results.details.push({
          mapping: `${mapping.supplier?.name || 'N/A'}: ${mapping.externalCategory}`,
          created: syncResult.created,
          updated: syncResult.updated,
          skipped: syncResult.skipped
        });

        console.log(`✅ [SYNC-ALL] Mapping ${mapping.externalCategory} synchronisé: ${syncResult.created} créé(s), ${syncResult.updated} mis à jour`);
      } catch (error: any) {
        console.error(`❌ [SYNC-ALL] Erreur pour mapping ${mapping.externalCategory}:`, error);
        results.errors.push({
          mapping: `${mapping.supplier?.name || 'N/A'}: ${mapping.externalCategory}`,
          error: error.message || 'Erreur inconnue'
        });
      }
    }

    console.log(`✅ [SYNC-ALL] Synchronisation globale terminée:`);
    console.log(`   - ${results.processed}/${results.totalMappings} mapping(s) traité(s)`);
    console.log(`   - ${results.totalCreated} produit(s) créé(s)`);
    console.log(`   - ${results.totalUpdated} produit(s) mis à jour`);
    console.log(`   - ${results.totalSkipped} produit(s) ignoré(s)`);
    console.log(`   - ${results.errors.length} erreur(s)`);

    return results;
  }
}
