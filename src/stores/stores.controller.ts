import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoresService } from './stores.service';

@ApiTags('stores')
@Controller('api/stores')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @ApiOperation({ summary: 'Obtenir tous les magasins' })
  @ApiResponse({ status: 200, description: 'Liste des magasins récupérée' })
  getAllStores() {
    return this.storesService.getAllStores();
  }

  @Get(':storeId/products')
  @ApiOperation({ summary: 'Obtenir les produits d\'un magasin' })
  @ApiResponse({ status: 200, description: 'Produits du magasin récupérés' })
  getStoreProducts(
    @Param('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.storesService.getStoreProducts(storeId, {
      status,
      category,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':storeId/stats')
  @ApiOperation({ summary: 'Obtenir les statistiques d\'un magasin' })
  @ApiResponse({ status: 200, description: 'Statistiques du magasin récupérées' })
  getStoreStats(@Param('storeId') storeId: string) {
    return this.storesService.getStoreStats(storeId);
  }

  @Post(':storeId/products/:productId/toggle')
  @ApiOperation({ summary: 'Sélectionner/désélectionner un produit' })
  @ApiResponse({ status: 200, description: 'Produit sélectionné/désélectionné' })
  toggleProductSelection(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
  ) {
    return this.storesService.toggleProductSelection(storeId, productId);
  }

  @Post(':storeId/import-selected')
  @ApiOperation({ summary: 'Importer les produits sélectionnés' })
  @ApiResponse({ status: 200, description: 'Produits sélectionnés importés' })
  importSelectedProducts(@Param('storeId') storeId: string) {
    return this.storesService.importSelectedProducts(storeId);
  }
}
