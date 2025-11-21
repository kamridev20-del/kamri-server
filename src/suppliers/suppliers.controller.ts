import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@Controller('api/suppliers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un nouveau fournisseur' })
  @ApiResponse({ status: 201, description: 'Fournisseur créé avec succès' })
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les fournisseurs' })
  @ApiResponse({ status: 200, description: 'Liste des fournisseurs' })
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Récupérer les statistiques des fournisseurs' })
  @ApiResponse({ status: 200, description: 'Statistiques des fournisseurs' })
  getStats() {
    return this.suppliersService.getStats();
  }

  @Post('sync-unmapped-categories')
  @ApiOperation({ summary: 'Resynchroniser les compteurs des catégories non mappées' })
  @ApiResponse({ status: 200, description: 'Compteurs resynchronisés avec succès' })
  syncUnmappedCategories() {
    return this.suppliersService.syncUnmappedCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un fournisseur par ID' })
  @ApiResponse({ status: 200, description: 'Détails du fournisseur' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un fournisseur' })
  @ApiResponse({ status: 200, description: 'Fournisseur modifié avec succès' })
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un fournisseur' })
  @ApiResponse({ status: 200, description: 'Fournisseur supprimé avec succès' })
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Tester la connexion à un fournisseur' })
  @ApiResponse({ status: 200, description: 'Test de connexion effectué' })
  testConnection(@Param('id') id: string) {
    return this.suppliersService.testConnection(id);
  }

  @Post(':id/import')
  @ApiOperation({ summary: 'Importer des produits depuis un fournisseur' })
  @ApiResponse({ status: 200, description: 'Import de produits effectué' })
  importProducts(@Param('id') id: string) {
    return this.suppliersService.importProducts(id);
  }

  @Get(':id/category-mappings')
  @ApiOperation({ summary: 'Obtenir les mappings de catégories pour un fournisseur' })
  @ApiResponse({ status: 200, description: 'Mappings de catégories récupérés' })
  getCategoryMappings(@Param('id') id: string) {
    return this.suppliersService.getCategoryMappings(id);
  }

  @Get('cj/external-categories')
  @ApiOperation({ summary: 'Obtenir les catégories externes de CJ Dropshipping' })
  @ApiResponse({ status: 200, description: 'Catégories externes CJ récupérées' })
  getCJExternalCategories() {
    return this.suppliersService.getCJExternalCategories();
  }

  @Get('cj/store-products')
  @ApiOperation({ summary: 'Obtenir les produits du magasin CJ' })
  @ApiResponse({ status: 200, description: 'Produits du magasin CJ récupérés' })
  getCJStoreProducts() {
    return this.suppliersService.getCJStoreProducts();
  }

  @Get('cj/store-stats')
  @ApiOperation({ summary: 'Obtenir les statistiques du magasin CJ' })
  @ApiResponse({ status: 200, description: 'Statistiques du magasin CJ récupérées' })
  getCJStoreStats() {
    return this.suppliersService.getCJStoreStats();
  }

  @Post('cj/reset-store')
  @ApiOperation({ summary: 'Réinitialiser le magasin CJ' })
  @ApiResponse({ status: 200, description: 'Magasin CJ réinitialisé' })
  resetCJStore() {
    return this.suppliersService.resetCJStore();
  }
}
