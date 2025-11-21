import { Body, Controller, Get, Logger, Param, Post, Query } from '@nestjs/common';
import { CJDisputesService } from './cj-disputes.service';

@Controller('api/cj-dropshipping/disputes')
export class CJDisputesController {
  private readonly logger = new Logger(CJDisputesController.name);

  constructor(private readonly cjDisputesService: CJDisputesService) {}

  /**
   * Récupère les produits en litige pour une commande
   */
  @Get('products/:orderId')
  async getDisputeProducts(@Param('orderId') orderId: string) {
    this.logger.log(`🔍 Récupération des produits en litige pour la commande ${orderId}`);
    return this.cjDisputesService.getDisputeProducts(orderId);
  }

  /**
   * Confirme un litige (7.2)
   * Retourne les informations nécessaires pour créer un litige
   */
  @Post('confirm')
  async confirmDispute(@Body() params: {
    orderId: string;
    productInfoList: Array<{
      lineItemId: string;
      quantity: string;
      // price n'est pas requis dans la requête
    }>;
  }) {
    this.logger.log('✅ Confirmation d\'un litige');
    return this.cjDisputesService.confirmDispute(params);
  }

  /**
   * Crée un litige
   */
  @Post('create')
  async createDispute(@Body() params: {
    orderId: string;
    businessDisputeId: string;
    disputeReasonId: number;
    expectType: number; // 1: Refund, 2: Reissue
    refundType: number; // 1: balance, 2: platform
    messageText: string;
    imageUrl?: string[];
    videoUrl?: string[];
    productInfoList: Array<{
      lineItemId: string;
      quantity: string;
      price: number;
    }>;
  }) {
    this.logger.log('📝 Création d\'un litige');
    return this.cjDisputesService.createDispute(params);
  }

  /**
   * Annule un litige
   */
  @Post('cancel')
  async cancelDispute(@Body() params: {
    orderId: string;
    disputeId: string;
  }) {
    this.logger.log('❌ Annulation d\'un litige');
    return this.cjDisputesService.cancelDispute(params);
  }

  /**
   * Récupère la liste des litiges
   */
  @Get('list')
  async getDisputeList(@Query() params: {
    orderId?: string;
    disputeId?: number;
    orderNumber?: string;
    pageNum?: number;
    pageSize?: number;
  }) {
    this.logger.log('📋 Récupération de la liste des litiges');
    return this.cjDisputesService.getDisputeList(params);
  }

  /**
   * Récupère les analytics des litiges
   */
  @Get('analytics')
  async getDisputeAnalytics() {
    this.logger.log('📊 Analytics des litiges');
    return this.cjDisputesService.getDisputeAnalytics();
  }

  /**
   * Récupère les litiges par statut
   */
  @Get('by-status/:status')
  async getDisputesByStatus(@Param('status') status: string) {
    this.logger.log(`📊 Litiges par statut: ${status}`);
    return this.cjDisputesService.getDisputeList({ pageSize: 100 });
  }

  /**
   * Récupère les litiges par fournisseur
   */
  @Get('by-supplier/:supplier')
  async getDisputesBySupplier(@Param('supplier') supplier: string) {
    this.logger.log(`📊 Litiges par fournisseur: ${supplier}`);
    return this.cjDisputesService.getDisputeList({ pageSize: 100 });
  }

  /**
   * Récupère les litiges par raison
   */
  @Get('by-reason/:reason')
  async getDisputesByReason(@Param('reason') reason: string) {
    this.logger.log(`📊 Litiges par raison: ${reason}`);
    return this.cjDisputesService.getDisputeList({ pageSize: 100 });
  }

  /**
   * Récupère les litiges récents
   */
  @Get('recent')
  async getRecentDisputes(@Query('limit') limit: string = '10') {
    const limitNumber = parseInt(limit);
    this.logger.log(`📊 Litiges récents (${limitNumber})`);
    return this.cjDisputesService.getDisputeList({ pageSize: limitNumber });
  }

  /**
   * Récupère les litiges en attente
   */
  @Get('pending')
  async getPendingDisputes() {
    this.logger.log('📊 Litiges en attente');
    return this.cjDisputesService.getDisputeList({ pageSize: 100 });
  }

  /**
   * Récupère les litiges résolus
   */
  @Get('resolved')
  async getResolvedDisputes() {
    this.logger.log('📊 Litiges résolus');
    return this.cjDisputesService.getDisputeList({ pageSize: 100 });
  }
}
