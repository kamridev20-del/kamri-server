import { Injectable } from '@nestjs/common';
import { CJMainService } from '../cj-dropshipping/services/cj-main.service';
import { DuplicatePreventionService } from '../common/services/duplicate-prevention.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private cjMainService: CJMainService,
    private duplicateService: DuplicatePreventionService
  ) {}

  async create(createSupplierDto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        ...createSupplierDto,
        apiKey: createSupplierDto.apiKey || '', // Valeur par défaut si pas fournie
      },
    });
  }

  async findAll() {
    // ✅ Récupérer TOUS les fournisseurs de la base de données
    const suppliers = await this.prisma.supplier.findMany({
      include: {
        products: {
          include: {
            category: true,
            supplier: true,
            productVariants: {
              // ✅ Inclure les variants avec leurs stocks
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
                createdAt: true,
                updatedAt: true,
              },
            },
          }
        },
        categoryMappings: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // ✅ Enrichir les données pour l'affichage
    const enrichedSuppliers = await Promise.all(
      suppliers.map(async (supplier) => {
        // Pour CJ Dropshipping, récupérer les stats du magasin
        if (supplier.name === 'CJ Dropshipping') {
          const cjStoreStats = await this.getCJStoreStats();
          const cjLastSync = await this.prisma.cJProductStore.findFirst({
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
          });

          return {
            ...supplier,
            lastSync: cjLastSync?.createdAt || supplier.lastSync,
            storeStats: cjStoreStats
          };
        }

        return supplier;
      })
    );

    return enrichedSuppliers;
  }

  async findOne(id: string) {
    return this.prisma.supplier.findUnique({
      where: { id },
      include: {
        products: true,
        categoryMappings: true,
      },
    });
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    return this.prisma.supplier.update({
      where: { id },
      data: updateSupplierDto,
    });
  }

  async remove(id: string) {
    return this.prisma.supplier.delete({
      where: { id },
    });
  }

  async ensureCJSupplierExists() {
    // Vérifier si le fournisseur CJ Dropshipping existe
    let cjSupplier = await this.prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' }
    });

    if (!cjSupplier) {
      console.log('🏢 Création automatique du fournisseur CJ Dropshipping...');
      cjSupplier = await this.prisma.supplier.create({
        data: {
          name: 'CJ Dropshipping',
          description: 'Fournisseur CJ Dropshipping pour vente réelle',
          apiUrl: 'https://developers.cjdropshipping.com',
          apiKey: 'cj-api-key',
          status: 'connected',
          lastSync: new Date(),
        }
      });
      console.log(`✅ Fournisseur CJ créé automatiquement avec ID: ${cjSupplier.id}`);
    } else {
      // S'assurer que le statut est 'connected' 
      if (cjSupplier.status !== 'connected') {
        await this.prisma.supplier.update({
          where: { id: cjSupplier.id },
          data: { 
            status: 'connected',
            lastSync: new Date(),
          }
        });
        console.log(`✅ Statut du fournisseur CJ mis à jour vers 'connected'`);
      }
    }

    return cjSupplier;
  }

  async testConnection(id: string) {
    // Gestion spéciale pour CJ Dropshipping
    if (id === 'cj-dropshipping') {
      // S'assurer que le fournisseur CJ existe d'abord
      await this.ensureCJSupplierExists();
      const cjConfig = await this.prisma.cJConfig.findFirst();
      if (!cjConfig) {
        return { success: false, message: 'CJ Dropshipping non configuré' };
      }

      // Tester la connexion CJ via le service CJ
      try {
        // Import du service CJ (éviter la dépendance circulaire)
        const { CJMainService } = await import('../cj-dropshipping/services/cj-main.service');
        const { CJAPIClient } = await import('../cj-dropshipping/cj-api-client');
        const cjApiClient = new CJAPIClient({} as any);
        const cjService = new CJMainService(this.prisma, cjApiClient, null, null, null, null, null, null);
        const result = await cjService.testConnection();
        
        return result;
      } catch (error) {
        return { success: false, message: `Erreur CJ: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new Error('Fournisseur non trouvé');
    }

    // Simulation du test de connexion
    const isConnected = Math.random() > 0.3; // 70% de chance de succès

    if (isConnected) {
      await this.prisma.supplier.update({
        where: { id },
        data: {
          status: 'connected',
          lastSync: new Date(),
        },
      });
      return { success: true, message: 'Connexion réussie' };
    } else {
      await this.prisma.supplier.update({
        where: { id },
        data: { status: 'disconnected' },
      });
      return { success: false, message: 'Échec de la connexion' };
    }
  }

  async getStats() {
    const total = await this.prisma.supplier.count();
    const connected = await this.prisma.supplier.count({
      where: { status: 'connected' },
    });
    const products = await this.prisma.product.count({
      where: { supplierId: { not: null } },
    });

    return {
      total,
      connected,
      disconnected: total - connected,
      products,
    };
  }

  async importProducts(supplierId: string) {
    console.log('🚀 === DÉBUT IMPORT PRODUITS ===');
    console.log('🔍 Supplier ID:', supplierId);
    
    // Vérifier si c'est le fournisseur CJ Dropshipping (par ID ou nom)
    const foundSupplier = await this.prisma.supplier.findFirst({
      where: {
        OR: [
          { id: supplierId },
          { name: 'CJ Dropshipping' }
        ]
      }
    });

    // Gestion spéciale pour CJ Dropshipping - Import en lot depuis le magasin
    if (foundSupplier?.name === 'CJ Dropshipping' || supplierId === 'cj-dropshipping') {
      try {
        console.log('🛒 === IMPORT EN LOT DEPUIS LE MAGASIN CJ ===');
        
        // Récupérer tous les produits disponibles du magasin CJ
        const cjStoreProducts = await this.prisma.cJProductStore.findMany({
          where: { status: 'available' },
          orderBy: { createdAt: 'desc' }
        });

        // ✅ DEBUG : Vérifier tous les produits du magasin
        const allCJProducts = await this.prisma.cJProductStore.findMany({
          orderBy: { createdAt: 'desc' }
        });
        console.log(`🔍 DEBUG - Tous les produits du magasin CJ:`, allCJProducts.map(p => ({ 
          id: p.id, 
          name: p.name, 
          status: p.status 
        })));

        if (cjStoreProducts.length === 0) {
          // ✅ Si aucun produit disponible, mais qu'il y a des produits importés, les remettre en disponible
          const importedProducts = allCJProducts.filter(p => p.status === 'imported');
          if (importedProducts.length > 0) {
            console.log(`🔄 Remise en statut 'available' de ${importedProducts.length} produits importés`);
            await this.prisma.cJProductStore.updateMany({
              where: { status: 'imported' },
              data: { status: 'available' }
            });
            
            // Récupérer à nouveau les produits maintenant disponibles
            const newCJStoreProducts = await this.prisma.cJProductStore.findMany({
              where: { status: 'available' },
              orderBy: { createdAt: 'desc' }
            });
            
            if (newCJStoreProducts.length > 0) {
              console.log(`✅ ${newCJStoreProducts.length} produits remis en statut 'available'`);
              // Continuer avec l'import
              cjStoreProducts.push(...newCJStoreProducts);
            }
          }
          
          if (cjStoreProducts.length === 0) {
            return {
              message: `Aucun produit disponible dans le magasin CJ (${allCJProducts.length} produits au total, statuts: ${allCJProducts.map(p => p.status).join(', ')})`,
              products: [],
              supplier: 'CJ Dropshipping',
              workflow: 'Magasin vide - Importez d\'abord des produits depuis /admin/cj-dropshipping/products'
            };
          }
        }

        console.log(`📦 ${cjStoreProducts.length} produits trouvés dans le magasin CJ`);
        
        // ✅ Créer le fournisseur CJ UNE SEULE FOIS avant la boucle
        let cjSupplier = await this.prisma.supplier.findFirst({
          where: { name: 'CJ Dropshipping' }
        });

        if (!cjSupplier) {
          console.log('🏢 Création du fournisseur CJ Dropshipping...');
          cjSupplier = await this.prisma.supplier.create({
            data: {
              name: 'CJ Dropshipping',
              description: 'Fournisseur CJ Dropshipping pour vente réelle',
              apiUrl: 'https://developers.cjdropshipping.com',
              apiKey: 'cj-api-key',
              status: 'connected',
              lastSync: new Date(),
            }
          });
          console.log(`✅ Fournisseur CJ créé avec ID: ${cjSupplier.id}`);
        } else {
          console.log(`✅ Fournisseur CJ existant trouvé: ${cjSupplier.id}`);
        }
        
        const importedProducts = [];
        
        for (const cjProduct of cjStoreProducts) {
          try {
            console.log(`\n🔄 === TRAITEMENT PRODUIT MAGASIN ===`);
            console.log(`📝 Nom: ${cjProduct.name}`);
            console.log(`🏷️ Catégorie: ${cjProduct.category}`);
            console.log(`💰 Prix: ${cjProduct.price}`);
            console.log(`🆔 CJ Product ID: ${cjProduct.cjProductId}`);
            
            // ✅ NOUVELLE LOGIQUE ANTI-DOUBLONS avec service dédié
            const duplicateCheck = await this.duplicateService.checkCJProductDuplicate(
              cjProduct.cjProductId, 
              cjProduct.productSku
            );
            
            console.log(`🔍 Résultat vérification doublons:`, {
              isDuplicate: duplicateCheck.isDuplicate,
              action: duplicateCheck.action,
              reason: duplicateCheck.reason
            });

            // ✅ IMPORTANT : Mapper la catégorie externe dans tous les cas
            const categoryId = await this.mapExternalCategory(cjProduct.category || '', cjSupplier.id);
            console.log(`✅ Catégorie mappée vers ID: ${categoryId}`);
            
            // Préparer les données du produit pour l'upsert intelligent
            const productData = {
              name: cjProduct.name,
              description: cjProduct.description,
              price: cjProduct.price,
              originalPrice: cjProduct.originalPrice,
              image: cjProduct.image,
              categoryId: categoryId,
              supplierId: cjSupplier.id,
              externalCategory: cjProduct.category,
              source: 'cj-dropshipping',
              status: 'draft', // ✅ Unifié : tous les produits passent par draft
              cjProductId: cjProduct.cjProductId, // ✅ Nouvel ID unique CJ
              productSku: cjProduct.productSku,
              suggestSellPrice: cjProduct.suggestSellPrice,
              variants: cjProduct.variants,
              dimensions: cjProduct.dimensions,
              brand: cjProduct.brand,
              tags: cjProduct.tags,
              productWeight: cjProduct.productWeight,
              packingWeight: cjProduct.packingWeight,
              materialNameEn: cjProduct.materialNameEn,
              packingNameEn: cjProduct.packingNameEn,
              listedNum: cjProduct.listedNum,
              supplierName: cjProduct.supplierName,
              createrTime: cjProduct.createrTime,
              cjReviews: cjProduct.reviews,
              productType: cjProduct.productType,
              productUnit: cjProduct.productUnit,
              productKeyEn: cjProduct.productKeyEn,
              badge: this.generateBadge(),
              stock: Math.floor(Math.random() * 50) + 10,
            };

            // ✅ UTILISER UPSERT INTELLIGENT avec le service anti-doublons
            const importResult = await this.duplicateService.upsertCJProduct(productData, duplicateCheck);
            
            console.log(`✅ Produit ${importResult.status}:`, {
              productId: importResult.productId,
              changes: importResult.changes
            });

            if (importResult.productId) {
              // Marquer le produit comme importé dans le magasin
              await this.prisma.cJProductStore.update({
                where: { id: cjProduct.id },
                data: { status: 'imported' }
              });

              // Créer/mettre à jour le mapping CJ
              await this.prisma.cJProductMapping.upsert({
                where: { productId: importResult.productId },
                update: {
                  cjProductId: cjProduct.cjProductId,
                  cjSku: cjProduct.cjProductId,
                  lastSyncAt: new Date(),
                },
                create: {
                  productId: importResult.productId,
                  cjProductId: cjProduct.cjProductId,
                  cjSku: cjProduct.cjProductId,
                  lastSyncAt: new Date(),
                },
              });

              importedProducts.push({
                id: importResult.productId,
                name: cjProduct.name,
                status: importResult.status,
                changes: importResult.changes
              });
            }
          } catch (error) {
            console.error(`❌ Erreur lors de la création du produit ${cjProduct.name}:`, error);
          }
        }

        console.log(`\n🎉 === IMPORT EN LOT TERMINÉ ===`);
        console.log(`📊 Total produits importés: ${importedProducts.length}`);
        console.log(`🏢 Fournisseur: CJ Dropshipping`);
        console.log(`📋 Produits:`, importedProducts.map(p => ({ name: p.name, category: p.category?.name, status: p.status })));

        return {
          message: `${importedProducts.length} produits importés depuis le magasin CJ - Tous en attente de validation`,
          products: importedProducts,
          supplier: 'CJ Dropshipping',
          workflow: 'Magasin CJ → Import en lot → Validation → Active'
        };
      } catch (error) {
        console.log('❌ === ERREUR IMPORT MAGASIN CJ ===');
        console.log('💥 Erreur:', error);
        throw new Error(`Erreur lors de l'import du magasin CJ: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      console.log('❌ Fournisseur non trouvé pour ID:', supplierId);
      throw new Error('Fournisseur non trouvé');
    }

    console.log('✅ Fournisseur trouvé:', supplier.name);

    try {
      // ✅ Vérifier si c'est un fournisseur CJ
      if (supplier.name === 'CJ Dropshipping') {
        console.log('🔄 Import depuis le MAGASIN CJ (CJProductStore)...');
        
        // ✅ Récupérer les produits du MAGASIN CJ (pas de l'API)
        const cjStoreProducts = await this.prisma.cJProductStore.findMany({
          where: { status: 'available' },
          orderBy: { createdAt: 'desc' }
        });

        console.log(`📦 ${cjStoreProducts.length} produits trouvés dans le magasin CJ`);
        
        if (cjStoreProducts.length === 0) {
          return {
            message: 'Aucun produit disponible dans le magasin CJ. Importez d\'abord des produits depuis /admin/cj-dropshipping/products',
            products: [],
            supplier: 'CJ Dropshipping',
          };
        }
        
        const importedProducts = [];
        
        for (const cjStoreProduct of cjStoreProducts) {
          try {
            console.log(`\n🔄 === TRAITEMENT PRODUIT MAGASIN ===`);
            console.log(`📝 Nom: ${cjStoreProduct.name}`);
            console.log(`🏷️ Catégorie: ${cjStoreProduct.category}`);
            console.log(`💰 Prix: ${cjStoreProduct.price}`);
            
            // ✅ Nettoyer les données du produit CJ
            const cleanedData = this.cleanCJProductData(cjStoreProduct);
            console.log(`🧹 Données nettoyées:`, {
              name: cleanedData.name,
              description: cleanedData.description.substring(0, 100) + '...',
              image: cleanedData.image,
              price: cleanedData.price
            });
            
            // Mapper les catégories externes vers nos catégories
            const categoryId = await this.mapExternalCategory(cleanedData.category || '', supplier.id);
            console.log(`✅ Catégorie mappée vers ID: ${categoryId}`);
            
            // Créer le produit KAMRI avec les données nettoyées
            const productData: any = {
              name: cleanedData.name,
              description: cleanedData.description,
              price: cleanedData.price,
              originalPrice: cleanedData.originalPrice,
              image: cleanedData.image,
              supplierId: supplier.id,
              externalCategory: cleanedData.category,
              source: 'cj-dropshipping',
              status: 'pending',
              badge: this.generateBadge(),
              stock: Math.floor(Math.random() * 50) + 10,
            };

            if (categoryId) {
              productData.categoryId = categoryId;
            }

            const product = await this.prisma.product.create({
              data: productData,
              include: {
                category: true,
                supplier: true,
              },
            });

            // Marquer le produit comme importé dans le magasin
            await this.prisma.cJProductStore.update({
              where: { id: cjStoreProduct.id },
              data: { status: 'imported' }
            });

            console.log(`✅ Produit KAMRI créé: ${product.name}`);
            importedProducts.push(product);
          } catch (error) {
            console.error(`❌ Erreur lors de la création du produit ${cjStoreProduct.name}:`, error);
          }
        }

        console.log(`\n🎉 === IMPORT MAGASIN CJ TERMINÉ ===`);
        console.log(`📊 Total produits importés: ${importedProducts.length}`);
        console.log(`🏢 Fournisseur: CJ Dropshipping`);

        return {
          message: `${importedProducts.length} produits importés depuis le magasin CJ`,
          products: importedProducts,
          supplier: 'CJ Dropshipping',
        };
      }

      // ✅ Pour les autres fournisseurs (Dummy, Fake Store, etc.)
      const apiUrl = supplier.apiUrl;
      const apiName = supplier.name;
      
      console.log(`🔄 Début de l'import depuis ${apiName}...`);
      console.log(`🌐 URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        console.log('❌ Erreur HTTP:', response.status, response.statusText);
        throw new Error('Erreur lors de la récupération des produits');
      }
      
      const apiResponse = await response.json();
      
      // DummyJSON retourne { products: [...] } alors que Fake Store retourne directement [...]
      const fakeProducts = apiResponse.products || apiResponse;
      
      console.log(`📦 ${fakeProducts.length} produits récupérés depuis ${apiName}`);
      console.log('📋 Premiers produits:', fakeProducts.slice(0, 3).map(p => ({ title: p.title, category: p.category })));
      
      const importedProducts = [];
      
      for (const fakeProduct of fakeProducts) {
        try {
          console.log(`\n🔄 === TRAITEMENT PRODUIT ===`);
          console.log(`📝 Titre: ${fakeProduct.title}`);
          console.log(`🏷️ Catégorie externe: "${fakeProduct.category}"`);
          console.log(`💰 Prix: ${fakeProduct.price}`);
          
          // Debug des images
          const extractedImage = this.extractImageUrl(fakeProduct);
          console.log(`🖼️ Image extraite: ${extractedImage || 'Aucune image trouvée'}`);
          if (fakeProduct.images) console.log(`📸 Images disponibles: ${fakeProduct.images.length}`);
          if (fakeProduct.image) console.log(`🖼️ Image directe: ${fakeProduct.image}`);
          if (fakeProduct.thumbnail) console.log(`🔍 Thumbnail: ${fakeProduct.thumbnail}`);
          
          // Mapper les catégories externes vers nos catégories
          const categoryId = await this.mapExternalCategory(fakeProduct.category, supplier.id);
          console.log(`✅ Catégorie mappée vers ID: ${categoryId}`);
          
          // TOUS les produits importés sont en attente de catégorisation et validation
          const productData: any = {
            name: fakeProduct.title,
            description: fakeProduct.description,
            price: fakeProduct.price,
            originalPrice: fakeProduct.price * 1.2, // Prix original fictif
            image: this.extractImageUrl(fakeProduct), // ✅ Fonction générique pour tous les fournisseurs
            supplierId: supplier.id,
            externalCategory: fakeProduct.category, // Sauvegarder la catégorie externe
            source: 'dummy-json', // ✅ Marquer la source
            status: 'pending', // TOUS les produits en attente de catégorisation
            badge: this.generateBadge(),
            stock: Math.floor(Math.random() * 50) + 10,
          };

          // Ajouter categoryId seulement si une catégorie est assignée
          if (categoryId) {
            productData.categoryId = categoryId;
          }

          const product = await this.prisma.product.create({
            data: productData,
            include: {
              category: true,
              supplier: true,
            },
          });
          
          // Sauvegarder toutes les images du produit
          const allImages = this.extractAllImages(fakeProduct);
          if (allImages.length > 0) {
            console.log(`🖼️ Sauvegarde de ${allImages.length} images pour le produit`);
            for (const imageUrl of allImages) {
              await this.prisma.image.create({
                data: {
                  url: imageUrl,
                  alt: fakeProduct.title,
                  productId: product.id,
                },
              });
            }
          }
          
          console.log(`✅ Produit créé: ${product.name} (statut: pending - en attente de catégorisation)`);
          console.log(`📊 ID produit: ${product.id}`);
          console.log(`🖼️ Images sauvegardées: ${allImages.length}`);
          importedProducts.push(product);
        } catch (error) {
          console.error(`❌ Erreur lors de la création du produit ${fakeProduct.title}:`, error);
        }
      }

      console.log(`\n🎉 === IMPORT TERMINÉ ===`);
      console.log(`📊 Total produits importés: ${importedProducts.length}`);
      console.log(`🏢 Fournisseur: ${supplier.name}`);
      console.log(`📋 Produits:`, importedProducts.map(p => ({ name: p.name, category: p.category?.name, status: p.status })));

      return {
        message: `${importedProducts.length} produits importés depuis ${apiName} - Tous en attente de catégorisation`,
        products: importedProducts,
        supplier: supplier.name,
        workflow: 'Import → Catégorisation → Validation → Active'
      };
    } catch (error) {
      console.log('❌ === ERREUR IMPORT ===');
      console.log('💥 Erreur:', error);
      throw new Error(`Erreur lors de l'import: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async mapExternalCategory(fakeCategory: string, supplierId: string): Promise<string> {
    console.log(`\n🔍 === MAPPING CATÉGORIE ===`);
    console.log(`🏷️ Catégorie externe: "${fakeCategory}"`);
    console.log(`🏢 Supplier ID: ${supplierId}`);
    
    // Vérifier s'il existe déjà un mapping pour cette catégorie externe
    console.log(`🔎 Recherche mapping existant...`);
    const existingMapping = await this.prisma.categoryMapping.findFirst({
      where: {
        supplierId: supplierId,
        externalCategory: fakeCategory
      }
    });

    if (existingMapping) {
      console.log(`✅ Mapping existant trouvé:`, existingMapping);
      // Vérifier si internalCategory contient un ID ou un nom
      let internalCategory;
      
      // Essayer d'abord comme ID (nouveau format)
      internalCategory = await this.prisma.category.findUnique({
        where: { id: existingMapping.internalCategory }
      });
      
      // Si pas trouvé, essayer comme nom (ancien format)
      if (!internalCategory) {
        internalCategory = await this.prisma.category.findFirst({
          where: { name: existingMapping.internalCategory }
        });
      }
      
      if (internalCategory) {
        console.log(`✅ Catégorie interne trouvée: ${internalCategory.name} (ID: ${internalCategory.id})`);
        return internalCategory.id;
      } else {
        console.log(`❌ Catégorie interne non trouvée pour mapping: ${existingMapping.internalCategory}`);
      }
    } else {
      console.log(`❌ Aucun mapping existant pour "${fakeCategory}"`);
    }

    // Si pas de mapping, enregistrer comme catégorie non mappée
    console.log(`📝 Enregistrement catégorie non mappée...`);
    try {
      // ✅ Pour CJ, utiliser le vrai supplierId
      let actualSupplierId = supplierId;
      if (supplierId === 'cj-dropshipping') {
        const cjSupplier = await this.prisma.supplier.findFirst({
          where: { name: 'CJ Dropshipping' }
        });
        actualSupplierId = cjSupplier?.id || null;
      }
      
      if (actualSupplierId) {
        await this.prisma.unmappedExternalCategory.upsert({
          where: {
            supplierId_externalCategory: {
              supplierId: actualSupplierId,
              externalCategory: fakeCategory
            }
          },
          update: {
            productCount: {
              increment: 1
            }
          },
          create: {
            externalCategory: fakeCategory,
            supplierId: actualSupplierId,
            productCount: 1
          }
        });
        console.log(`✅ Catégorie non mappée enregistrée: ${fakeCategory}`);
      }
    } catch (error) {
      console.log(`❌ Erreur enregistrement catégorie non mappée:`, error);
      // ✅ Continuer même si l'enregistrement échoue
    }
    
    // Vérifier ce qui a été enregistré
    const savedCategory = await this.prisma.unmappedExternalCategory.findFirst({
      where: {
        supplierId: supplierId,
        externalCategory: fakeCategory
      }
    });
    console.log(`🔍 Catégorie sauvegardée:`, savedCategory);
    
    // Pas de fallback - laisser en attente de catégorisation manuelle
    console.log(`⏳ Produit laissé en attente de catégorisation manuelle`);
    console.log(`📝 Catégorie externe "${fakeCategory}" doit être mappée manuellement`);
    
    // Retourner null pour indiquer qu'aucune catégorie n'est assignée
    return null;
  }


  /**
   * Fonction générique pour extraire l'URL d'image de n'importe quel fournisseur
   * Compatible avec DummyJSON, Fake Store, WooCommerce, Shopify, AliExpress, etc.
   */
  private extractImageUrl(product: any): string | null {
    // Priorité 1: images[0] (DummyJSON, Shopify, WooCommerce, AliExpress, etc.)
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0];
    }
    
    // Priorité 2: image (Fake Store, WooCommerce, etc.)
    if (product.image && typeof product.image === 'string') {
      return product.image;
    }
    
    // Priorité 3: thumbnail (DummyJSON, etc.)
    if (product.thumbnail && typeof product.thumbnail === 'string') {
      return product.thumbnail;
    }
    
    // Priorité 4: Autres champs possibles selon les fournisseurs
    if (product.photo && typeof product.photo === 'string') return product.photo;
    if (product.picture && typeof product.picture === 'string') return product.picture;
    if (product.img && typeof product.img === 'string') return product.img;
    if (product.photoUrl && typeof product.photoUrl === 'string') return product.photoUrl;
    if (product.imageUrl && typeof product.imageUrl === 'string') return product.imageUrl;
    
    // Aucune image trouvée
    return null;
  }

  /**
   * Fonction pour extraire TOUTES les images d'un produit
   * Utilisée pour créer la galerie d'images
   */
  private extractAllImages(product: any): string[] {
    const images: string[] = [];
    
    // Priorité 1: images[] (DummyJSON, Shopify, WooCommerce, AliExpress, etc.)
    if (product.images && Array.isArray(product.images)) {
      images.push(...product.images.filter((img: any) => typeof img === 'string'));
    }
    
    // Priorité 2: image (Fake Store, WooCommerce, etc.) - si pas déjà dans images[]
    if (product.image && typeof product.image === 'string' && !images.includes(product.image)) {
      images.push(product.image);
    }
    
    // Priorité 3: thumbnail (DummyJSON, etc.) - si pas déjà dans images[]
    if (product.thumbnail && typeof product.thumbnail === 'string' && !images.includes(product.thumbnail)) {
      images.push(product.thumbnail);
    }
    
    // Priorité 4: Autres champs possibles
    const otherImageFields = ['photo', 'picture', 'img', 'photoUrl', 'imageUrl'];
    for (const field of otherImageFields) {
      if (product[field] && typeof product[field] === 'string' && !images.includes(product[field])) {
        images.push(product[field]);
      }
    }
    
    return images;
  }

  // ✅ Nouvelle méthode pour obtenir les catégories externes du magasin CJ
  async getCJExternalCategories() {
    // Récupérer toutes les catégories externes uniques du magasin CJ
    const cjStoreProducts = await this.prisma.cJProductStore.findMany({
      where: {
        category: { not: null }
      },
      select: {
        category: true
      },
      distinct: ['category']
    });

    return cjStoreProducts
      .map(p => p.category)
      .filter((category): category is string => category !== null)
      .sort();
  }

  // ✅ Nouvelle méthode pour obtenir les mappings de catégories par fournisseur
  async getCategoryMappings(supplierId: string) {
    if (supplierId === 'cj-dropshipping') {
      // Pour CJ Dropshipping, retourner les catégories externes du magasin
      const externalCategories = await this.getCJExternalCategories();
      return {
        supplierId: 'cj-dropshipping',
        supplierName: 'CJ Dropshipping',
        externalCategories,
        mappings: await this.prisma.categoryMapping.findMany({
          where: { supplierId: 'cj-dropshipping' }
        })
      };
    }

    // Pour les autres fournisseurs, logique existante
    return this.prisma.categoryMapping.findMany({
      where: { supplierId }
    });
  }

  // ✅ Nouvelle méthode pour obtenir les produits du magasin CJ
  async getCJStoreProducts() {
    return this.prisma.cJProductStore.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  // ✅ Nouvelle méthode pour obtenir les statistiques du magasin CJ
  async getCJStoreStats() {
    const [total, available, imported] = await Promise.all([
      this.prisma.cJProductStore.count(),
      this.prisma.cJProductStore.count({ where: { status: 'available' } }),
      this.prisma.cJProductStore.count({ where: { status: 'imported' } })
    ]);

    return {
      total,
      available,
      imported,
      pending: total - available - imported
    };
  }

  // ✅ Nouvelle méthode pour réinitialiser le magasin CJ
  async resetCJStore() {
    // Remettre tous les produits importés en statut available
    const updated = await this.prisma.cJProductStore.updateMany({
      where: { status: 'imported' },
      data: { status: 'available' }
    });

    console.log(`🔄 ${updated.count} produits remis en statut 'available'`);

    return {
      message: `Magasin CJ réinitialisé - ${updated.count} produits remis en statut 'available'`,
      stats: await this.getCJStoreStats()
    };
  }

  /**
   * Nettoyer les données des produits CJ
   */
  private cleanCJProductData(cjStoreProduct: any) {
    // Nettoyer la description (supprimer les balises HTML)
    let cleanDescription = cjStoreProduct.description || '';
    if (typeof cleanDescription === 'string') {
      // Supprimer les balises HTML mais garder le contenu
      cleanDescription = cleanDescription
        .replace(/<[^>]*>/g, '') // Supprimer toutes les balises HTML
        .replace(/&nbsp;/g, ' ') // Remplacer &nbsp; par des espaces
        .replace(/&amp;/g, '&') // Remplacer &amp; par &
        .replace(/&lt;/g, '<') // Remplacer &lt; par <
        .replace(/&gt;/g, '>') // Remplacer &gt; par >
        .replace(/&quot;/g, '"') // Remplacer &quot; par "
        .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul
        .trim();
    }

    // Nettoyer l'image (s'assurer que c'est une URL valide)
    let cleanImage = cjStoreProduct.image || '';
    if (typeof cleanImage === 'string') {
      try {
        // Si c'est un JSON string, le parser
        const parsed = JSON.parse(cleanImage);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cleanImage = parsed[0]; // Prendre la première image
        }
      } catch {
        // Si ce n'est pas du JSON, garder tel quel
        cleanImage = cleanImage;
      }
    } else if (Array.isArray(cleanImage) && cleanImage.length > 0) {
      cleanImage = cleanImage[0]; // Prendre la première image
    }

    // Nettoyer le nom (supprimer les caractères spéciaux)
    let cleanName = cjStoreProduct.name || '';
    if (typeof cleanName === 'string') {
      cleanName = cleanName
        .replace(/[^\w\s\-.,]/g, '') // Supprimer les caractères spéciaux
        .replace(/\s+/g, ' ') // Remplacer les espaces multiples
        .trim();
    }

    return {
      name: cleanName,
      description: cleanDescription,
      image: cleanImage,
      price: Number(cjStoreProduct.price) || 0,
      originalPrice: Number(cjStoreProduct.originalPrice) || 0,
      category: cjStoreProduct.category || '',
    };
  }

  private generateBadge(): string {
    const badges = ['nouveau', 'promo', 'tendance', 'top vente'];
    return badges[Math.floor(Math.random() * badges.length)];
  }

  /**
   * Resynchroniser les compteurs des catégories non mappées
   * Supprime les catégories sans produits et met à jour les compteurs
   */
  async syncUnmappedCategories() {
    console.log('🔄 === RESYNCHRONISATION CATÉGORIES NON MAPPÉES ===');
    
    try {
      // 1. Récupérer tous les fournisseurs
      const suppliers = await this.prisma.supplier.findMany();
      
      let totalCleaned = 0;
      let totalUpdated = 0;
      
      for (const supplier of suppliers) {
        console.log(`\n📦 Traitement fournisseur: ${supplier.name}`);
        
        // 2. Récupérer les produits actuels du fournisseur groupés par catégorie
        const products = await this.prisma.product.findMany({
          where: { supplierId: supplier.id },
          select: { category: true }
        });
        
        // Compter les produits par catégorie externe (depuis le champ category qui contient la catégorie CJ)
        const categoryCounts = new Map<string, number>();
        
        // Pour CJ, utiliser aussi les produits du store
        if (supplier.name === 'CJ Dropshipping') {
          const storeProducts = await this.prisma.cJProductStore.findMany({
            select: { category: true }
          });
          
          storeProducts.forEach(p => {
            if (p.category) {
              categoryCounts.set(p.category, (categoryCounts.get(p.category) || 0) + 1);
            }
          });
        }
        
        // 3. Récupérer toutes les catégories non mappées de ce fournisseur
        const unmappedCategories = await this.prisma.unmappedExternalCategory.findMany({
          where: { supplierId: supplier.id }
        });
        
        console.log(`   - ${unmappedCategories.length} catégories non mappées trouvées`);
        console.log(`   - ${categoryCounts.size} catégories avec produits actuels`);
        
        // 4. Mettre à jour ou supprimer chaque catégorie
        for (const unmappedCat of unmappedCategories) {
          const actualCount = categoryCounts.get(unmappedCat.externalCategory) || 0;
          
          if (actualCount === 0) {
            // Aucun produit avec cette catégorie, supprimer l'entrée
            await this.prisma.unmappedExternalCategory.delete({
              where: { id: unmappedCat.id }
            });
            console.log(`   ❌ Supprimé: "${unmappedCat.externalCategory}" (0 produits)`);
            totalCleaned++;
          } else if (actualCount !== unmappedCat.productCount) {
            // Mettre à jour le compteur
            await this.prisma.unmappedExternalCategory.update({
              where: { id: unmappedCat.id },
              data: { productCount: actualCount }
            });
            console.log(`   ✅ Mis à jour: "${unmappedCat.externalCategory}" (${unmappedCat.productCount} → ${actualCount})`);
            totalUpdated++;
          }
        }
      }
      
      console.log('\n==============================================');
      console.log('📊 RÉSULTAT:');
      console.log(`   - ${totalCleaned} catégories supprimées (0 produits)`);
      console.log(`   - ${totalUpdated} catégories mises à jour`);
      console.log('==============================================\n');
      
      return {
        success: true,
        cleaned: totalCleaned,
        updated: totalUpdated,
        message: `${totalCleaned} catégories nettoyées, ${totalUpdated} catégories mises à jour`
      };
      
    } catch (error) {
      console.error('❌ Erreur resynchronisation:', error);
      throw error;
    }
  }
}
