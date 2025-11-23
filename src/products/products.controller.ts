import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { EditProductDto } from './dto/edit-product.dto';
import { PrepareProductDto } from './dto/prepare-product.dto';
import { ProductsService } from './products.service';
import { ShippingValidationService } from '../shipping/shipping-validation.service';
import { ProductViewersService } from './product-viewers.service';

@ApiTags('products')
@Controller('api/products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly shippingValidationService: ShippingValidationService,
    private readonly productViewersService: ProductViewersService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  findAll(@Query('category') category?: string) {
    if (category) {
      return this.productsService.findByCategory(category);
    }
    return this.productsService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des produits et catégories' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  @ApiQuery({ name: 'q', required: false, description: 'Terme de recherche' })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre de résultats (défaut: 10)' })
  @ApiQuery({ name: 'popular', required: false, description: 'Inclure les recherches populaires si pas de query' })
  async search(
    @Query('q') query?: string,
    @Query('limit') limit?: string,
    @Query('popular') popular?: string
  ) {
    const resultLimit = limit ? parseInt(limit, 10) : 10;
    const includePopular = popular === 'true' || popular === '1';
    return this.productsService.searchProductsAndCategories(query || '', resultLimit, includePopular);
  }

  @Get('admin/all')
  @ApiOperation({ summary: 'Get all products for admin (including pending)' })
  @ApiResponse({ status: 200, description: 'All products retrieved successfully' })
  findAllForAdmin() {
    return this.productsService.findAllForAdmin();
  }

  @Get('admin/pending')
  @ApiOperation({ summary: 'Get pending products for validation' })
  @ApiResponse({ status: 200, description: 'Pending products retrieved successfully' })
  getPendingProducts() {
    return this.productsService.getPendingProducts();
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending product' })
  @ApiResponse({ status: 200, description: 'Product approved successfully' })
  approve(@Param('id') id: string) {
    return this.productsService.approve(id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending product' })
  @ApiResponse({ status: 200, description: 'Product rejected successfully' })
  reject(@Param('id') id: string) {
    return this.productsService.reject(id);
  }

  // ===== NOUVEAUX ENDPOINTS POUR L'ÉDITION MANUELLE =====
  // ⚠️ IMPORTANT: Ces routes doivent être AVANT @Get(':id') pour éviter les conflits

  @Get(':id/check-shipping')
  @ApiOperation({ summary: 'Vérifie si un produit est livrable dans un pays' })
  @ApiParam({ name: 'id', description: 'ID du produit' })
  @ApiQuery({ name: 'countryCode', required: true, description: 'Code pays de destination (ISO 3166-1 alpha-2)' })
  @ApiQuery({ name: 'variantId', required: false, description: 'ID du variant (optionnel)' })
  async checkShipping(
    @Param('id') productId: string,
    @Query('countryCode') countryCode: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.shippingValidationService.checkProductShipping(productId, countryCode, variantId);
  }

  @Get('draft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir tous les produits en draft (pour édition)' })
  @ApiResponse({ status: 200, description: 'Produits draft récupérés avec succès' })
  async getDraftProducts() {
    console.log('📋 [CONTROLLER] getDraftProducts appelé');
    const products = await this.productsService.getDraftProducts();
    console.log('📋 [CONTROLLER] Produits retournés:', products.length);
    return products;
  }

  @Get('draft/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir un produit draft par ID' })
  @ApiResponse({ status: 200, description: 'Produit draft récupéré avec succès' })
  @ApiResponse({ status: 404, description: 'Produit draft non trouvé' })
  getDraftProduct(@Param('id') id: string) {
    return this.productsService.getDraftProduct(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (published or draft)' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateProduct(
    @Param('id') id: string,
    @Body() updateData: any,
    @GetUser() user?: any
  ) {
    return this.productsService.updateProduct(id, updateData, user?.id || user?.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Get('admin/ready-for-validation')
  @ApiOperation({ summary: 'Get products ready for validation (with category mapping)' })
  @ApiResponse({ status: 200, description: 'Products ready for validation retrieved successfully' })
  getProductsReadyForValidation(@Query('categoryId') categoryId?: string) {
    return this.productsService.getProductsReadyForValidation(categoryId);
  }

  @Get('admin/by-source')
  @ApiOperation({ summary: 'Get products by source (dummy-json, cj-dropshipping)' })
  @ApiResponse({ status: 200, description: 'Products by source retrieved successfully' })
  getProductsBySource(@Query('source') source?: string) {
    return this.productsService.getProductsBySource(source);
  }

  @Get('admin/validation-stats')
  @ApiOperation({ summary: 'Get validation statistics' })
  @ApiResponse({ status: 200, description: 'Validation statistics retrieved successfully' })
  getValidationStats() {
    return this.productsService.getValidationStats();
  }

  // ✅ ENDPOINTS CJ DROPSHIPPING
  @Get('cj/search')
  @ApiOperation({ summary: 'Search products in CJ Dropshipping catalog' })
  @ApiResponse({ status: 200, description: 'CJ products retrieved successfully' })
  searchCJProducts(@Query() searchParams: any) {
    return this.productsService.searchCJProducts(searchParams);
  }

  @Get('cj/categories')
  @ApiOperation({ summary: 'Get CJ Dropshipping categories' })
  @ApiResponse({ status: 200, description: 'CJ categories retrieved successfully' })
  getCJCategories() {
    return this.productsService.getCJCategories();
  }

  @Get('cj/products/:pid/details')
  @ApiOperation({ summary: 'Get detailed product info from CJ' })
  @ApiResponse({ status: 200, description: 'CJ product details retrieved successfully' })
  getCJProductDetails(@Param('pid') pid: string) {
    return this.productsService.getCJProductDetails(pid);
  }

  @Post('cj/products/import')
  @ApiOperation({ summary: 'Import a product from CJ to local database' })
  @ApiResponse({ status: 201, description: 'Product imported successfully' })
  importCJProduct(@Body() importData: any) {
    return this.productsService.importCJProduct(importData);
  }

  @Get('cj/products/:pid/stock')
  @ApiOperation({ summary: 'Get stock information for CJ product' })
  @ApiResponse({ status: 200, description: 'CJ product stock retrieved successfully' })
  getCJProductStock(@Param('pid') pid: string, @Query('countryCode') countryCode: string) {
    return this.productsService.getCJProductStock(pid, countryCode);
  }

  // ===== NOUVEAUX ENDPOINTS POUR L'ÉDITION MANUELLE =====

  @Post('cj/prepare/:cjStoreProductId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Préparer un produit CJ pour publication (créer en draft)' })
  @ApiResponse({ status: 201, description: 'Produit préparé avec succès' })
  @ApiResponse({ status: 404, description: 'Produit CJ non trouvé' })
  @ApiResponse({ status: 400, description: 'Produit déjà dans le catalogue' })
  async prepareCJProduct(
    @Param('cjStoreProductId') cjStoreProductId: string,
    @Body() prepareData: PrepareProductDto,
    @GetUser() user?: any
  ) {
    return this.productsService.prepareCJProductForPublication(
      cjStoreProductId,
      prepareData,
      user?.id || user?.sub
    );
  }

  @Patch('draft/:id/edit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Éditer un produit en draft' })
  @ApiResponse({ status: 200, description: 'Produit édité avec succès' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé' })
  @ApiResponse({ status: 400, description: 'Seuls les produits draft peuvent être édités' })
  async editDraftProduct(
    @Param('id') id: string,
    @Body() editData: EditProductDto,
    @GetUser() user?: any
  ) {
    return this.productsService.editDraftProduct(
      id,
      editData,
      user?.id || user?.sub
    );
  }

  @Patch('draft/:id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publier un produit draft (passer à active)' })
  @ApiResponse({ status: 200, description: 'Produit publié avec succès' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé' })
  @ApiResponse({ status: 400, description: 'Seuls les produits draft peuvent être publiés' })
  publishProduct(@Param('id') id: string) {
    return this.productsService.publishProduct(id);
  }

  @Post('draft/update-mappings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour automatiquement les produits draft sans catégorie qui ont un mapping' })
  @ApiResponse({ status: 200, description: 'Produits mis à jour avec succès' })
  async updateDraftProductsWithMapping() {
    return this.productsService.updateDraftProductsWithMapping();
  }

  // ===== NOTIFICATIONS DE MISE À JOUR DE PRODUITS =====

  @Get('update-notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir les notifications de mise à jour de produits via webhooks' })
  @ApiResponse({ status: 200, description: 'Notifications récupérées avec succès' })
  @ApiQuery({ name: 'unread', required: false, type: Boolean, description: 'Filtrer uniquement les notifications non lues' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de notifications à retourner' })
  getUpdateNotifications(@Query('unread') unread?: string, @Query('limit') limit?: number) {
    const unreadOnly = unread === 'true';
    const limitNum = limit ? Number(limit) : 50;
    return this.productsService.getUpdateNotifications(unreadOnly, limitNum);
  }

  @Patch('update-notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  @ApiResponse({ status: 200, description: 'Notification marquée comme lue' })
  markNotificationAsRead(@Param('id') id: string) {
    return this.productsService.markNotificationAsRead(id);
  }

  @Patch('update-notifications/read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marquer toutes les notifications comme lues' })
  @ApiResponse({ status: 200, description: 'Toutes les notifications marquées comme lues' })
  markAllNotificationsAsRead() {
    return this.productsService.markAllNotificationsAsRead();
  }

  @Post('cleanup-descriptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nettoyer les descriptions de tous les produits (supprimer Weight/Dimensions faux)' })
  @ApiResponse({ status: 200, description: 'Descriptions nettoyées avec succès' })
  cleanupDescriptions() {
    return this.productsService.cleanupAllDescriptions();
  }

  // ✅ Endpoints pour le tracking des viewers
  @Post(':id/viewers')
  @ApiOperation({ summary: 'Enregistrer un viewer actif pour un produit' })
  @ApiResponse({ status: 200, description: 'Viewer enregistré avec succès' })
  @ApiParam({ name: 'id', description: 'ID du produit' })
  addViewer(
    @Param('id') productId: string,
    @Body('sessionId') sessionId: string,
  ) {
    const viewersCount = this.productViewersService.addViewer(productId, sessionId);
    return { viewersCount };
  }

  @Delete(':id/viewers')
  @ApiOperation({ summary: 'Retirer un viewer actif pour un produit' })
  @ApiResponse({ status: 200, description: 'Viewer retiré avec succès' })
  @ApiParam({ name: 'id', description: 'ID du produit' })
  removeViewer(
    @Param('id') productId: string,
    @Body('sessionId') sessionId: string,
  ) {
    const viewersCount = this.productViewersService.removeViewer(productId, sessionId);
    return { viewersCount };
  }

  @Get(':id/viewers')
  @ApiOperation({ summary: 'Récupérer le nombre de viewers actifs pour un produit' })
  @ApiResponse({ status: 200, description: 'Nombre de viewers récupéré avec succès' })
  @ApiParam({ name: 'id', description: 'ID du produit' })
  getViewersCount(@Param('id') productId: string) {
    const viewersCount = this.productViewersService.getViewersCount(productId);
    return { viewersCount };
  }
}

