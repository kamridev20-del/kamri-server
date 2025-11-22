import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les catégories' })
  @ApiResponse({ status: 200, description: 'Liste des catégories récupérée avec succès' })
  async findAll() {
    const categories = await this.categoriesService.findAll();
    return {
      data: categories,
      message: 'Catégories récupérées avec succès'
    };
  }

  @Get('with-product-counts')
  @ApiOperation({ summary: 'Récupérer toutes les catégories avec le nombre de produits par catégorie (optimisé)' })
  @ApiResponse({ status: 200, description: 'Catégories avec compteurs récupérées avec succès' })
  async findAllWithProductCounts() {
    const categories = await this.categoriesService.findAllWithProductCounts();
    return {
      data: categories,
      message: 'Catégories avec compteurs récupérées avec succès'
    };
  }

  @Get('stats/all')
  @ApiOperation({ summary: 'Récupérer toutes les statistiques de catégories en une seule requête (optimisé pour admin)' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
  async getAllCategoryStats() {
    const stats = await this.categoriesService.getAllCategoryStats();
    return {
      data: stats,
      message: 'Statistiques récupérées avec succès'
    };
  }

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle catégorie' })
  @ApiResponse({ status: 201, description: 'Catégorie créée avec succès' })
  async create(@Body() data: { name: string; description?: string; icon?: string; color?: string }) {
    const category = await this.categoriesService.create(data);
    return {
      data: category,
      message: 'Catégorie créée avec succès'
    };
  }

  @Get('unmapped-external')
  @ApiOperation({ summary: 'Récupérer les catégories externes non mappées' })
  @ApiResponse({ status: 200, description: 'Catégories externes non mappées récupérées avec succès' })
  async getUnmappedExternalCategories() {
    try {
      const categories = await this.categoriesService.getUnmappedExternalCategories();
      return {
        data: categories,
        message: 'Catégories externes non mappées récupérées avec succès'
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des catégories non mappées:', error);
      return {
        error: 'Erreur lors de la récupération des catégories non mappées',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  @Get('mappings/all')
  @ApiOperation({ summary: 'Récupérer tous les mappings de catégories' })
  @ApiResponse({ status: 200, description: 'Mappings récupérés avec succès' })
  async getCategoryMappings() {
    const mappings = await this.categoriesService.getCategoryMappings();
    return {
      data: mappings,
      message: 'Mappings récupérés avec succès'
    };
  }

  @Post('mappings')
  @ApiOperation({ summary: 'Créer un nouveau mapping de catégorie' })
  @ApiResponse({ status: 201, description: 'Mapping créé avec succès' })
  async createCategoryMapping(@Body() data: {
    supplierId: string;
    externalCategory: string;
    internalCategory: string;
  }) {
    const mapping = await this.categoriesService.createCategoryMapping(data);
    return {
      data: mapping,
      message: 'Mapping créé avec succès'
    };
  }

  @Put('mappings/:id')
  @ApiOperation({ summary: 'Modifier un mapping de catégorie' })
  @ApiResponse({ status: 200, description: 'Mapping modifié avec succès' })
  async updateCategoryMapping(
    @Param('id') id: string,
    @Body() data: {
      internalCategory?: string;
      status?: string;
    }
  ) {
    const mapping = await this.categoriesService.updateCategoryMapping(id, data);
    return {
      data: mapping,
      message: 'Mapping modifié avec succès'
    };
  }

  @Post('mappings/:id/sync-products')
  @ApiOperation({ summary: 'Forcer la synchronisation des produits draft pour un mapping de catégorie' })
  @ApiResponse({ status: 200, description: 'Synchronisation terminée avec succès' })
  async syncDraftProductsForMapping(@Param('id') id: string) {
    // Récupérer le mapping
    const mappings = await this.categoriesService.getCategoryMappings();
    const mapping = mappings.find(m => m.id === id);
    
    if (!mapping) {
      return {
        error: 'Mapping non trouvé'
      };
    }

    // Récupérer la catégorie interne
    const category = await this.categoriesService.findOne(mapping.internalCategory);
    if (!category) {
      return {
        error: 'Catégorie interne non trouvée'
      };
    }

    const result = await this.categoriesService.syncDraftProductsForCategory(
      category.id,
      mapping.supplierId,
      mapping.externalCategory
    );

    return {
      data: result,
      message: 'Synchronisation terminée avec succès'
    };
  }

  @Delete('mappings/:id')
  @ApiOperation({ summary: 'Supprimer un mapping de catégorie' })
  @ApiResponse({ status: 200, description: 'Mapping supprimé avec succès' })
  async deleteCategoryMapping(@Param('id') id: string) {
    const result = await this.categoriesService.deleteCategoryMapping(id);
    return {
      data: result,
      message: 'Mapping supprimé avec succès'
    };
  }

  @Post('mappings/sync-all')
  @ApiOperation({ summary: 'Synchroniser tous les mappings de catégories en une seule fois' })
  @ApiResponse({ status: 200, description: 'Synchronisation globale terminée avec succès' })
  async syncAllMappings() {
    console.log('🔄 [CONTROLLER] syncAllMappings appelé');
    try {
      const result = await this.categoriesService.syncAllMappings();
      console.log('✅ [CONTROLLER] syncAllMappings terminé avec succès');
      return {
        data: result,
        message: 'Synchronisation globale terminée avec succès'
      };
    } catch (error: any) {
      console.error('❌ [CONTROLLER] Erreur syncAllMappings:', error);
      throw error;
    }
  }

  @Get('mappings/:id/cj-products-count')
  @ApiOperation({ summary: 'Obtenir le nombre de produits CJ disponibles pour un mapping' })
  @ApiResponse({ status: 200, description: 'Nombre de produits récupéré avec succès' })
  async getCJStoreProductsCount(
    @Param('id') id: string
  ) {
    const mappings = await this.categoriesService.getCategoryMappings();
    const mapping = mappings.find(m => m.id === id);
    
    if (!mapping) {
      return {
        error: 'Mapping non trouvé'
      };
    }

    const result = await this.categoriesService.getCJStoreProductsCount(
      mapping.externalCategory,
      mapping.supplierId
    );

    return {
      data: result,
      message: 'Nombre de produits récupéré avec succès'
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une catégorie par ID' })
  @ApiResponse({ status: 200, description: 'Catégorie récupérée avec succès' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  async findOne(@Param('id') id: string) {
    const category = await this.categoriesService.findOne(id);
    if (!category) {
      return {
        error: 'Catégorie non trouvée'
      };
    }
    return {
      data: category,
      message: 'Catégorie récupérée avec succès'
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une catégorie' })
  @ApiResponse({ status: 200, description: 'Catégorie modifiée avec succès' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  async update(@Param('id') id: string, @Body() data: { name?: string; description?: string; icon?: string; color?: string }) {
    const category = await this.categoriesService.update(id, data);
    if (!category) {
      return {
        error: 'Catégorie non trouvée'
      };
    }
    return {
      data: category,
      message: 'Catégorie modifiée avec succès'
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une catégorie' })
  @ApiResponse({ status: 200, description: 'Catégorie supprimée avec succès' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  async remove(@Param('id') id: string) {
    const result = await this.categoriesService.remove(id);
    if (!result) {
      return {
        error: 'Catégorie non trouvée'
      };
    }
    return {
      message: 'Catégorie supprimée avec succès'
    };
  }
}
