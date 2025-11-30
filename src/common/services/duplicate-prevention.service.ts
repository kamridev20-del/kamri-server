import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingProduct?: any;
  action: 'CREATE' | 'UPDATE' | 'SKIP';
  reason?: string;
}

export interface ImportStatusResult {
  status: 'new' | 'updated' | 'imported' | 'duplicate';
  productId?: string;
  changes?: string[];
}

@Injectable()
export class DuplicatePreventionService {
  private readonly logger = new Logger(DuplicatePreventionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Vérifier si un produit CJ existe déjà
   */
  async checkCJProductDuplicate(cjProductId: string, productSku?: string, productData?: any): Promise<DuplicateCheckResult> {
    this.logger.log(`🔍 Vérification doublons pour CJ Product ID: ${cjProductId}`);

    try {
      // 1️⃣ Recherche prioritaire par cjProductId (identifiant unique CJ)
      let existingProduct = await this.prisma.product.findFirst({
        where: { cjProductId },
        include: {
          category: true,
          supplier: true,
          cjMapping: true
        }
      });

      if (existingProduct) {
        this.logger.log(`🔄 Produit existant trouvé par cjProductId: ${existingProduct.id}`);
        return {
          isDuplicate: true,
          existingProduct,
          action: 'UPDATE',
          reason: `Produit CJ ${cjProductId} déjà importé (ID: ${existingProduct.id})`
        };
      }

      // 2️⃣ Recherche secondaire par productSku si fourni
      if (productSku) {
        existingProduct = await this.prisma.product.findFirst({
          where: { 
            productSku,
            source: 'cj-dropshipping' // Limiter à CJ pour éviter conflits inter-fournisseurs
          },
          include: {
            category: true,
            supplier: true,
            cjMapping: true
          }
        });

        if (existingProduct) {
          this.logger.log(`🔄 Produit existant trouvé par productSku: ${existingProduct.id}`);
          return {
            isDuplicate: true,
            existingProduct,
            action: 'UPDATE',
            reason: `Produit SKU ${productSku} déjà importé (ID: ${existingProduct.id})`
          };
        }
      }

      // 3️⃣ Recherche par similarité : nom + prix (détection de doublons potentiels)
      // Cette vérification permet de détecter les produits identiques avec des cjProductId différents
      if (productData?.name && productData?.price) {
        const normalizedName = productData.name.trim().toLowerCase();
        
        // SQLite ne supporte pas mode: 'insensitive', on doit récupérer tous les produits et filtrer
        const allCJProducts = await this.prisma.product.findMany({
          where: {
            source: 'cj-dropshipping',
            price: {
              // Tolérance de 0.01 pour les prix (arrondis)
              gte: productData.price - 0.01,
              lte: productData.price + 0.01
            }
          },
          include: {
            category: true,
            supplier: true,
            cjMapping: true
          }
        });
        
        // Filtrer par similarité de nom (insensible à la casse)
        const similarProduct = allCJProducts.find(p => {
          const existingName = p.name.trim().toLowerCase();
          // Vérifier si les noms sont similaires (contient ou similaire)
          return existingName.includes(normalizedName) || normalizedName.includes(existingName);
        });

        if (similarProduct) {
          // Comparer plus précisément le nom (au moins 80% de similitude)
          const existingName = similarProduct.name.trim().toLowerCase();
          const similarity = this.calculateSimilarity(normalizedName, existingName);
          
          if (similarity > 0.8) {
            this.logger.warn(`⚠️ Produit similaire détecté (similarité: ${Math.round(similarity * 100)}%): ${similarProduct.id}`);
            this.logger.warn(`   Produit existant: "${similarProduct.name}" (Prix: ${similarProduct.price})`);
            this.logger.warn(`   Produit à importer: "${productData.name}" (Prix: ${productData.price})`);
            
            return {
              isDuplicate: true,
              existingProduct: similarProduct,
              action: 'SKIP', // Ne pas mettre à jour, juste ignorer le doublon
              reason: `Produit similaire déjà importé (similarité: ${Math.round(similarity * 100)}%) - ${similarProduct.id}`
            };
          }
        }
      }

      // 4️⃣ Aucun doublon détecté
      this.logger.log(`✅ Aucun doublon détecté pour ${cjProductId}`);
      return {
        isDuplicate: false,
        action: 'CREATE',
        reason: 'Nouveau produit'
      };

    } catch (error) {
      this.logger.error(`❌ Erreur lors de la vérification de doublons:`, error);
      // En cas d'erreur, considérer comme nouveau pour ne pas bloquer l'import
      return {
        isDuplicate: false,
        action: 'CREATE',
        reason: 'Erreur de vérification - traité comme nouveau'
      };
    }
  }

  /**
   * Vérifier si un produit CJProductStore existe déjà
   */
  async checkCJStoreDuplicate(cjProductId: string): Promise<boolean> {
    try {
      const existing = await this.prisma.cJProductStore.findFirst({
        where: { cjProductId }
      });
      
      const isDuplicate = !!existing;
      this.logger.log(`🛒 Vérification magasin CJ ${cjProductId}: ${isDuplicate ? 'EXISTE' : 'NOUVEAU'}`);
      
      return isDuplicate;
    } catch (error) {
      this.logger.error(`❌ Erreur vérification magasin CJ:`, error);
      return false;
    }
  }

  /**
   * Calculer la similarité entre deux chaînes (algorithme de Jaro-Winkler simplifié)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    // Calculer la distance de Levenshtein
    const distance = this.levenshteinDistance(longer, shorter);
    const similarity = (longer.length - distance) / longer.length;
    
    return similarity;
  }

  /**
   * Distance de Levenshtein entre deux chaînes
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Upsert intelligent d'un produit CJ
   */
  async upsertCJProduct(productData: any, duplicateCheck: DuplicateCheckResult): Promise<ImportStatusResult> {
    try {
      // Si c'est un doublon à ignorer (SKIP), retourner directement
      if (duplicateCheck.action === 'SKIP' && duplicateCheck.existingProduct) {
        this.logger.log(`⏭️ Doublon ignoré: ${duplicateCheck.reason}`);
        return {
          status: 'duplicate',
          productId: duplicateCheck.existingProduct.id,
          changes: [`Doublon ignoré - ${duplicateCheck.reason}`]
        };
      }
      
      if (duplicateCheck.action === 'UPDATE' && duplicateCheck.existingProduct) {
        // 🔄 MISE À JOUR du produit existant
        this.logger.log(`🔄 Mise à jour du produit existant: ${duplicateCheck.existingProduct.id}`);
        
        const changes: string[] = [];
        const updateData: any = {
          updatedAt: new Date(),
          lastImportAt: new Date(),
          importStatus: 'updated'
        };

        // Vérifier et mettre à jour les champs qui ont changé
        if (duplicateCheck.existingProduct.price !== productData.price) {
          updateData.price = productData.price;
          changes.push(`prix: ${duplicateCheck.existingProduct.price} → ${productData.price}`);
        }

        if (duplicateCheck.existingProduct.stock !== productData.stock) {
          updateData.stock = productData.stock || 0;
          changes.push(`stock: ${duplicateCheck.existingProduct.stock} → ${productData.stock}`);
        }

        if (duplicateCheck.existingProduct.description !== productData.description) {
          updateData.description = productData.description;
          changes.push('description mise à jour');
        }

        // Mettre à jour tous les champs CJ spécifiques
        const cjFields = [
          'suggestSellPrice', 'variants', 'dimensions', 'brand', 'tags',
          'productWeight', 'packingWeight', 'materialNameEn', 'packingNameEn',
          'externalCategory' // ✅ Préserver externalCategory lors de la mise à jour
        ];
        
        cjFields.forEach(field => {
          if (productData[field] !== undefined) {
            updateData[field] = productData[field];
          }
        });
        
        // ✅ Si categoryName est fourni mais pas externalCategory, utiliser categoryName
        if (productData.categoryName && !productData.externalCategory) {
          updateData.externalCategory = productData.categoryName;
        }
        
        // ✅ Mapper externalCategory vers categoryId si fourni et si categoryId n'est pas déjà défini
        if (updateData.externalCategory && duplicateCheck.existingProduct?.supplierId && !updateData.categoryId) {
          try {
            const mappedCategoryId = await this.mapExternalCategory(updateData.externalCategory, duplicateCheck.existingProduct.supplierId);
            if (mappedCategoryId) {
              updateData.categoryId = mappedCategoryId;
              this.logger.log(`✅ Catégorie mappée automatiquement lors de la mise à jour: ${updateData.externalCategory} → ${mappedCategoryId}`);
            }
          } catch (e) {
            this.logger.warn(`⚠️ Erreur lors du mapping de externalCategory lors de la mise à jour:`, e);
          }
        }

        const updatedProduct = await this.prisma.product.update({
          where: { id: duplicateCheck.existingProduct.id },
          data: updateData,
          include: {
            category: true,
            supplier: true
          }
        });

        this.logger.log(`✅ Produit mis à jour avec ${changes.length} changements`);
        
        // ✅ METTRE À JOUR LES PRODUCT VARIANTS si le JSON a changé
        if (productData.variants && updateData.variants) {
          await this.createProductVariantsFromJSON(updatedProduct.id, productData.variants);
        }
        
        return {
          status: 'updated',
          productId: updatedProduct.id,
          changes
        };

      } else {
        // 🆕 CRÉATION d'un nouveau produit
        this.logger.log(`🆕 Création d'un nouveau produit CJ`);
        
        // ✅ Mapper sku vers productSku si présent (compatibilité)
        const createData: any = { ...productData };
        if (createData.sku && !createData.productSku) {
          createData.productSku = createData.sku;
          delete createData.sku;
        }
        
        // ✅ Mapper categoryName vers externalCategory si présent
        if (createData.categoryName && !createData.externalCategory) {
          createData.externalCategory = createData.categoryName;
          delete createData.categoryName;
        }
        
        // ✅ Supprimer les champs non valides pour Prisma
        delete createData.modifiedFields; // Ce champ n'existe pas dans Prisma
        delete createData.properties; // Ce champ n'existe pas dans Prisma
        
        // ✅ S'assurer que status est une string valide (pending, active, inactive, rejected)
        if (createData.status && typeof createData.status === 'string') {
          // Si status est un nombre stringifié, le convertir
          if (createData.status === '2' || createData.status === '1' || createData.status === '0') {
            // Mapper les statuts CJ vers les statuts KAMRI
            createData.status = 'pending'; // Par défaut, les produits importés sont en pending
          }
        } else {
          createData.status = 'pending'; // Par défaut
        }
        
        // ✅ S'assurer que source est défini
        if (!createData.source) {
          createData.source = 'cj-dropshipping';
        }
        
        // ✅ Mapper externalCategory vers categoryId si fourni et si categoryId n'est pas déjà défini
        if (createData.externalCategory && createData.supplierId && !createData.categoryId) {
          try {
            const mappedCategoryId = await this.mapExternalCategory(createData.externalCategory, createData.supplierId);
            if (mappedCategoryId) {
              createData.categoryId = mappedCategoryId;
              this.logger.log(`✅ Catégorie mappée automatiquement: ${createData.externalCategory} → ${mappedCategoryId}`);
            } else {
              this.logger.log(`⚠️ Aucun mapping trouvé pour externalCategory: ${createData.externalCategory}`);
            }
          } catch (e) {
            this.logger.warn(`⚠️ Erreur lors du mapping de externalCategory:`, e);
          }
        }
        
        // ✅ Vérifier que categoryId existe dans la base de données
        if (createData.categoryId && typeof createData.categoryId === 'string' && createData.categoryId.trim() !== '') {
          try {
            const categoryExists = await this.prisma.category.findUnique({
              where: { id: createData.categoryId }
            });
            if (!categoryExists) {
              this.logger.warn(`⚠️ Catégorie ${createData.categoryId} introuvable, suppression de categoryId`);
              delete createData.categoryId;
            }
          } catch (e) {
            this.logger.warn(`⚠️ Erreur lors de la vérification de categoryId ${createData.categoryId}:`, e);
            delete createData.categoryId;
          }
        } else {
          // Si categoryId est null, undefined ou vide, le supprimer
          delete createData.categoryId;
        }
        
        // ✅ Vérifier que supplierId existe dans la base de données
        if (createData.supplierId && typeof createData.supplierId === 'string' && createData.supplierId.trim() !== '') {
          try {
            const supplierExists = await this.prisma.supplier.findUnique({
              where: { id: createData.supplierId }
            });
            if (!supplierExists) {
              this.logger.warn(`⚠️ Fournisseur ${createData.supplierId} introuvable, suppression de supplierId`);
              delete createData.supplierId;
            }
          } catch (e) {
            this.logger.warn(`⚠️ Erreur lors de la vérification de supplierId ${createData.supplierId}:`, e);
            delete createData.supplierId;
          }
        } else {
          // Si supplierId est null, undefined ou vide, le supprimer
          delete createData.supplierId;
        }
        
        const newProduct = await this.prisma.product.create({
          data: {
            ...createData,
            importStatus: 'new',
            lastImportAt: new Date(),
            // ✅ Pays d'origine : CN par défaut pour CJ Dropshipping
            originCountryCode: createData.originCountryCode || (createData.source === 'cj-dropshipping' ? 'CN' : null),
          },
          include: {
            category: true,
            supplier: true
          }
        });

        this.logger.log(`✅ Nouveau produit créé: ${newProduct.id}`);
        
        // ✅ CRÉER LES PRODUCT VARIANTS depuis le JSON variants
        if (productData.variants) {
          await this.createProductVariantsFromJSON(newProduct.id, productData.variants);
        }
        
        return {
          status: 'new',
          productId: newProduct.id,
          changes: ['Nouveau produit créé']
        };
      }

    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'upsert du produit:`, error);
      throw error;
    }
  }

  /**
   * Upsert intelligent d'un produit dans CJProductStore
   */
  async upsertCJStoreProduct(productData: any): Promise<{ isNew: boolean; productId: string }> {
    try {
      const existing = await this.prisma.cJProductStore.findUnique({
        where: { cjProductId: productData.cjProductId }
      });
      
      const result = await this.prisma.cJProductStore.upsert({
        where: { cjProductId: productData.cjProductId },
        update: {
          name: productData.name,
          description: productData.description,
          price: productData.price,
          originalPrice: productData.originalPrice,
          image: productData.image,
          category: productData.category,
          // Mettre à jour tous les champs détaillés
          productSku: productData.productSku,
          productWeight: productData.productWeight,
          packingWeight: productData.packingWeight,
          productType: productData.productType,
          productUnit: productData.productUnit,
          productKeyEn: productData.productKeyEn,
          materialNameEn: productData.materialNameEn,
          packingNameEn: productData.packingNameEn,
          suggestSellPrice: productData.suggestSellPrice,
          listedNum: productData.listedNum,
          supplierName: productData.supplierName,
          supplierId: productData.supplierId,
          createrTime: productData.createrTime,
          variants: productData.variants,
          reviews: productData.reviews,
          dimensions: productData.dimensions,
          brand: productData.brand,
          tags: productData.tags,
          // ✅ Champs douaniers
          categoryId: productData.categoryId,
          entryCode: productData.entryCode,
          entryName: productData.entryName,
          entryNameEn: productData.entryNameEn,
          // ✅ Matériau/Emballage complets
          materialName: productData.materialName,
          materialKey: productData.materialKey,
          packingName: productData.packingName,
          packingKey: productData.packingKey,
          // ✅ Attributs produit complets
          productKey: productData.productKey,
          productProSet: productData.productProSet,
          productProEnSet: productData.productProEnSet,
          // ✅ Personnalisation (POD)
          customizationVersion: productData.customizationVersion,
          customizationJson1: productData.customizationJson1,
          customizationJson2: productData.customizationJson2,
          customizationJson3: productData.customizationJson3,
          customizationJson4: productData.customizationJson4,
          // ✅ Média
          productVideo: productData.productVideo,
          // ✅ Informations de livraison
          deliveryCycle: productData.deliveryCycle,
          isFreeShipping: productData.isFreeShipping,
          freeShippingCountries: productData.freeShippingCountries,
          defaultShippingMethod: productData.defaultShippingMethod,
          // ✅ Préserver le statut d'import s'il existe
          importStatus: existing?.importStatus || 'not_imported',
          importedProductId: existing?.importedProductId || null,
          updatedAt: new Date()
        },
        create: {
          ...productData,
          // ✅ Initialiser le statut d'import pour les nouveaux produits
          importStatus: 'not_imported',
          importedProductId: null
        }
      });

      const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
      
      this.logger.log(`🛒 Produit magasin CJ ${isNew ? 'créé' : 'mis à jour'}: ${result.id}`);
      
      return {
        isNew,
        productId: result.id
      };

    } catch (error) {
      this.logger.error(`❌ Erreur upsert magasin CJ:`, error);
      throw error;
    }
  }

  /**
   * Créer les ProductVariant depuis le JSON variants
   */
  private async createProductVariantsFromJSON(productId: string, variantsJSON: string): Promise<number> {
    try {
      let variants = [];
      
      // Parser le JSON
      try {
        variants = JSON.parse(variantsJSON);
        if (!Array.isArray(variants)) {
          this.logger.warn(`⚠️ Variants non-array pour produit ${productId}, skip`);
          return 0;
        }
      } catch (e) {
        this.logger.warn(`❌ Erreur parsing JSON variants pour produit ${productId}, skip`);
        return 0;
      }

      if (variants.length === 0) {
        this.logger.log(`⏭️ Aucun variant JSON pour produit ${productId}, skip`);
        return 0;
      }

      this.logger.log(`📦 Création de ${variants.length} variants pour produit ${productId}...`);

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
            productId: productId,
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
            status: (variant.stock || variant.variantStock || 0) > 0 ? 'available' : 'out_of_stock',
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
          this.logger.error(`❌ Erreur création variant:`, e instanceof Error ? e.message : String(e));
        }
      }

      if (createdCount > 0) {
        this.logger.log(`✅ ${createdCount} variants créés pour produit ${productId}`);
      }

      return createdCount;

    } catch (error) {
      this.logger.error(`❌ Erreur création variants pour produit ${productId}:`, error);
      return 0;
    }
  }

  /**
   * Obtenir les statistiques de doublons
   */
  async getDuplicateStats(): Promise<{
    totalProducts: number;
    cjProducts: number;
    duplicatesFound: number;
    lastImports: any[];
  }> {
    try {
      console.log('📊 [DuplicateService] getDuplicateStats appelé');
      const [totalProducts, cjProducts, recentImports] = await Promise.all([
        this.prisma.product.count().catch(() => 0),
        this.prisma.product.count({ where: { source: 'cj-dropshipping' } }).catch(() => 0),
        this.prisma.product.findMany({
          where: { 
            lastImportAt: { not: null },
            source: 'cj-dropshipping'
          },
          orderBy: { lastImportAt: 'desc' },
          take: 10,
          select: {
            id: true,
            name: true,
            importStatus: true,
            lastImportAt: true,
            cjProductId: true
          }
        }).catch(() => [])
      ]);

      const duplicatesFound = recentImports.filter(p => p.importStatus === 'updated').length;

      console.log('✅ [DuplicateService] Stats calculées:', {
        totalProducts,
        cjProducts,
        duplicatesFound,
        lastImportsCount: recentImports.length
      });

      return {
        totalProducts: totalProducts || 0,
        cjProducts: cjProducts || 0,
        duplicatesFound,
        lastImports: recentImports || []
      };
    } catch (error) {
      console.error('❌ [DuplicateService] Erreur dans getDuplicateStats:', error);
      return {
        totalProducts: 0,
        cjProducts: 0,
        duplicatesFound: 0,
        lastImports: [],
      };
    }
  }

  /**
   * Mapper automatiquement une catégorie externe vers une catégorie interne
   */
  private async mapExternalCategory(externalCategory: string, supplierId: string): Promise<string | null> {
    if (!externalCategory || !supplierId) {
      return null;
    }

    this.logger.log(`🔍 [MAP-CATEGORY] Recherche mapping pour: "${externalCategory}" (Supplier: ${supplierId})`);

    // Vérifier s'il existe un mapping pour cette catégorie externe
    const existingMapping = await this.prisma.categoryMapping.findFirst({
      where: {
        supplierId: supplierId,
        externalCategory: externalCategory
      }
    });

    if (existingMapping) {
      this.logger.log(`✅ [MAP-CATEGORY] Mapping trouvé: ${externalCategory} → ${existingMapping.internalCategory}`);
      
      // Vérifier si internalCategory est un ID valide
      const category = await this.prisma.category.findUnique({
        where: { id: existingMapping.internalCategory }
      });

      if (category) {
        this.logger.log(`✅ [MAP-CATEGORY] Catégorie interne trouvée: ${category.name} (ID: ${category.id})`);
        return category.id;
      } else {
        this.logger.warn(`⚠️ [MAP-CATEGORY] Catégorie interne non trouvée pour ID: ${existingMapping.internalCategory}`);
      }
    } else {
      this.logger.log(`❌ [MAP-CATEGORY] Aucun mapping trouvé pour "${externalCategory}"`);
    }

    return null;
  }
}