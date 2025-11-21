import { Controller, Get, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CJCategoriesService } from './cj-categories.service';

@ApiTags('CJ Categories')
@Controller('api/cj-dropshipping/categories')
export class CJCategoriesController {
  private readonly logger = new Logger(CJCategoriesController.name);

  constructor(private readonly cjCategoriesService: CJCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les catégories CJ' })
  @ApiResponse({ status: 200, description: 'Catégories récupérées avec succès' })
  async getAllCategories() {
    try {
      this.logger.log('🏷️ === DÉBUT CONTRÔLEUR CATÉGORIES ===');
      this.logger.log('📞 Appel du service getAllCategories...');
      
      const categories = await this.cjCategoriesService.getAllCategories();
      
      this.logger.log('✅ Service terminé, catégories reçues:', categories.length);
      this.logger.log('📋 Premières catégories:', categories.slice(0, 3));
      
      return {
        success: true,
        categories: categories,
        total: categories.length,
        message: `${categories.length} catégories récupérées`
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération catégories: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      return {
        success: false,
        categories: [],
        total: 0,
        message: `Erreur: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  @Get('tree')
  @ApiOperation({ summary: 'Récupérer l\'arbre des catégories CJ' })
  @ApiResponse({ status: 200, description: 'Arbre des catégories récupéré avec succès' })
  async getCategoriesTree() {
    try {
      this.logger.log('🌳 Récupération de l\'arbre des catégories CJ...');
      const tree = await this.cjCategoriesService.getCategoriesTree();
      
      return {
        success: true,
        tree: tree,
        message: 'Arbre des catégories récupéré'
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération arbre: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      return {
        success: false,
        tree: [],
        message: `Erreur: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  @Post('test')
  @ApiOperation({ summary: 'Tester la récupération des catégories CJ' })
  @ApiResponse({ status: 200, description: 'Test de récupération des catégories' })
  async testCategoriesRetrieval() {
    try {
      this.logger.log('🧪 Test de récupération des catégories CJ...');
      const result = await this.cjCategoriesService.testCategoriesRetrieval();
      
      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur test catégories: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      return {
        success: false,
        categories: [],
        message: `Erreur lors du test: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  @Post('sync')
  @ApiOperation({ summary: 'Synchroniser les catégories CJ avec la base de données' })
  @ApiResponse({ status: 200, description: 'Catégories synchronisées avec succès' })
  async syncCategories() {
    try {
      this.logger.log('🔄 === DÉBUT SYNCHRONISATION CATÉGORIES CJ ===');
      this.logger.log('📞 Appel du service getAllCategories...');
      
      const categories = await this.cjCategoriesService.getAllCategories();
      
      this.logger.log('✅ Synchronisation terminée, catégories reçues:', categories.length);
      this.logger.log('📋 Premières catégories:', categories.slice(0, 3));
      
      return {
        success: true,
        categories: categories,
        total: categories.length,
        message: `${categories.length} catégories synchronisées avec succès`
      };
    } catch (error) {
      this.logger.error(`❌ Erreur synchronisation catégories: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      return {
        success: false,
        categories: [],
        total: 0,
        message: `Erreur lors de la synchronisation: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}