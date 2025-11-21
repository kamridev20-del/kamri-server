import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CJAPIClient } from './cj-api-client';

@Injectable()
export class CJCategoriesService {
  private readonly logger = new Logger(CJCategoriesService.name);
  private categoriesCache: any[] | null = null;
  private cacheTimestamp: number | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes en millisecondes

  constructor(
    private prisma: PrismaService
  ) {}

  /**
   * Récupérer toutes les catégories depuis l'API CJ avec cache
   */
  async getAllCategories(): Promise<any[]> {
    this.logger.log('🏷️ === RÉCUPÉRATION DES CATÉGORIES CJ ===');
    
    // Vérifier le cache d'abord
    if (this.categoriesCache && this.cacheTimestamp && 
        (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
      this.logger.log('📦 Utilisation du cache des catégories');
      return this.categoriesCache;
    }
    
    try {
      this.logger.log('🚀 Initialisation du client CJ...');
      const client = await this.initializeClient();
      this.logger.log('✅ Client CJ initialisé');
      
      this.logger.log('📡 Appel DIRECT de l\'API CJ Dropshipping...');
      this.logger.log('🌐 URL complète: https://developers.cjdropshipping.com/api2.0/v1/product/getCategory');
      
      const categories = await client.getCategories();
      
      this.logger.log(`✅ ${categories.length} catégories récupérées depuis l'API CJ`);
      this.logger.log('📋 Premières catégories:', categories.slice(0, 3).map(c => c.categoryFirstName || c.name));
      
      // Mettre en cache
      this.categoriesCache = categories;
      this.cacheTimestamp = Date.now();
      this.logger.log('💾 Catégories mises en cache');
      
      // Sauvegarder en base de données
      await this.saveCategoriesToDatabase(categories);
      
      return categories;
    } catch (error) {
      this.logger.error('❌ Erreur lors de la récupération des catégories:', error);
      this.logger.error('📊 Type d\'erreur:', typeof error);
      this.logger.error('📊 Message:', error instanceof Error ? error.message : String(error));
      
      // Si on a un cache, l'utiliser en cas d'erreur
      if (this.categoriesCache) {
        this.logger.log('📦 Utilisation du cache en cas d\'erreur API');
        return this.categoriesCache;
      }
      
      // En cas d'erreur et pas de cache, retourner un message d'erreur
      throw new Error(`Impossible de récupérer les catégories CJ: ${error instanceof Error ? error.message : String(error)}`);
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
   * Sauvegarder les catégories en base de données
   */
  private async saveCategoriesToDatabase(categories: any[]): Promise<void> {
    this.logger.log('💾 Sauvegarde des catégories en base de données...');
    
    try {
      // Traiter la structure hiérarchique des catégories CJ
      for (const firstLevel of categories) {
        // Sauvegarder le niveau 1
        const firstLevelCategory = await this.saveCategory({
          externalId: `first_${firstLevel.categoryFirstName}`,
          name: firstLevel.categoryFirstName,
          nameEn: firstLevel.categoryFirstName,
          level: 1,
          parentId: null
        });

        // Traiter le niveau 2
        if (firstLevel.categoryFirstList && Array.isArray(firstLevel.categoryFirstList)) {
          for (const secondLevel of firstLevel.categoryFirstList) {
            const secondLevelCategory = await this.saveCategory({
              externalId: `second_${secondLevel.categorySecondName}`,
              name: secondLevel.categorySecondName,
              nameEn: secondLevel.categorySecondName,
              level: 2,
              parentId: firstLevelCategory.id
            });

            // Traiter le niveau 3
            if (secondLevel.categorySecondList && Array.isArray(secondLevel.categorySecondList)) {
              for (const thirdLevel of secondLevel.categorySecondList) {
                await this.saveCategory({
                  externalId: thirdLevel.categoryId,
                  name: thirdLevel.categoryName,
                  nameEn: thirdLevel.categoryName,
                  level: 3,
                  parentId: secondLevelCategory.id
                });
              }
            }
          }
        }
      }
      
      this.logger.log(`✅ Catégories sauvegardées avec structure hiérarchique`);
    } catch (error) {
      this.logger.error('❌ Erreur lors de la sauvegarde:', error);
      throw error;
    }
  }

  /**
   * Sauvegarder une catégorie individuelle
   */
  private async saveCategory(categoryData: {
    externalId: string;
    name: string;
    nameEn: string;
    level: number;
    parentId: string | null;
  }): Promise<any> {
    // TODO: Ajouter le modèle Category au schéma Prisma
    // return await this.prisma.category.upsert({
    //   where: { externalId: categoryData.externalId },
    //   update: {
    //     name: categoryData.name,
    //     nameEn: categoryData.nameEn,
    //     parentId: categoryData.parentId,
    //     level: categoryData.level,
    //     isActive: true,
    //     updatedAt: new Date(),
    //   },
    //   create: {
    //     externalId: categoryData.externalId,
    //     name: categoryData.name,
    //     nameEn: categoryData.nameEn,
    //     parentId: categoryData.parentId,
    //     level: categoryData.level,
    //     isActive: true,
    //     createdAt: new Date(),
    //     updatedAt: new Date(),
    //   },
    // });

    // Simulation pour l'instant
    return {
      id: `sim_${categoryData.externalId}`,
      externalId: categoryData.externalId,
      name: categoryData.name,
      nameEn: categoryData.nameEn,
      level: categoryData.level,
      parentId: categoryData.parentId
    };
  }

  /**
   * Initialiser le client CJ
   */
  private async initializeClient(): Promise<CJAPIClient> {
    this.logger.log('🚀 Initialisation du client CJ...');
    
    const config = await this.getConfig();
    if (!config.enabled) {
      throw new Error('L\'intégration CJ Dropshipping est désactivée');
    }

    const cjApiClient = new CJAPIClient(null as any);
    cjApiClient.setConfig({
      email: config.email,
      apiKey: config.apiKey,
      tier: config.tier as 'free' | 'plus' | 'prime' | 'advanced',
      platformToken: config.platformToken,
      debug: process.env.CJ_DEBUG === 'true',
    });

    await cjApiClient.login();
    this.logger.log('✅ Client CJ initialisé avec succès');
    
    return cjApiClient;
  }

  /**
   * Obtenir la configuration CJ
   */
  private async getConfig(): Promise<any> {
    // Récupérer la configuration depuis la base de données
    const config = await this.prisma.cJConfig.findFirst();
    
    if (!config) {
      throw new Error('Configuration CJ Dropshipping non trouvée');
    }
    
    if (!config.enabled) {
      throw new Error('L\'intégration CJ Dropshipping est désactivée');
    }
    
    return {
      enabled: config.enabled,
      email: config.email,
      apiKey: config.apiKey,
      tier: config.tier,
      platformToken: config.platformToken
    };
  }

  /**
   * Tester la récupération des catégories
   */
  async testCategoriesRetrieval(): Promise<{ success: boolean; categories: any[]; message: string }> {
    this.logger.log('🧪 Test de récupération des catégories CJ...');
    
    try {
      const client = await this.initializeClient();
      const categories = await client.getCategories();
      
      this.logger.log(`✅ Test réussi: ${categories.length} catégories récupérées`);
      
      return {
        success: true,
        categories: categories,
        message: `Récupération réussie: ${categories.length} catégories trouvées`
      };
    } catch (error) {
      this.logger.error('❌ Test échoué:', error);
      return {
        success: false,
        categories: [],
        message: `Erreur lors du test: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
