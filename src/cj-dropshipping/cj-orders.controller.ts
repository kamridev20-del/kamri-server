import { Body, Controller, Delete, Get, Logger, Param, Patch, Post, Query } from '@nestjs/common';
import { CJOrdersService } from './cj-orders.service';

@Controller('cj-dropshipping/orders')
export class CJOrdersController {
  private readonly logger = new Logger(CJOrdersController.name);

  constructor(private readonly cjOrdersService: CJOrdersService) {}

  @Post('create-v2')
  async createOrderV2(@Body() orderData: any) {
    this.logger.log('Requête reçue pour création commande V2');
    return this.cjOrdersService.createOrderV2(orderData);
  }

  @Post('create-v3')
  async createOrderV3(@Body() orderData: any) {
    this.logger.log('Requête reçue pour création commande V3');
    return this.cjOrdersService.createOrderV3(orderData);
  }

  @Post('add-cart')
  async addToCart(@Body() body: { cjOrderIdList: string[] }) {
    this.logger.log('Requête reçue pour ajout au panier');
    return this.cjOrdersService.addToCart(body.cjOrderIdList);
  }

  @Post('confirm-cart')
  async confirmCart(@Body() body: { cjOrderIdList: string[] }) {
    this.logger.log('Requête reçue pour confirmation panier');
    return this.cjOrdersService.confirmCart(body.cjOrderIdList);
  }

  @Post('save-parent-order')
  async saveGenerateParentOrder(@Body() body: { shipmentOrderId: string }) {
    this.logger.log('Requête reçue pour sauvegarde commande parent');
    return this.cjOrdersService.saveGenerateParentOrder(body.shipmentOrderId);
  }

  @Get('list')
  async getOrders(@Query() params: {
    pageNum?: number;
    pageSize?: number;
    orderIds?: string;
    shipmentOrderId?: string;
    status?: string;
  }) {
    this.logger.log('Requête reçue pour liste des commandes');
    
    const queryParams: any = { ...params };
    if (params.orderIds) {
      queryParams.orderIds = params.orderIds.split(',');
    }
    
    return this.cjOrdersService.getOrders(queryParams);
  }

  @Get('details/:orderId')
  async getOrderDetails(
    @Param('orderId') orderId: string,
    @Query('features') features?: string
  ) {
    this.logger.log(`Requête reçue pour détails commande: ${orderId}`);
    
    const featuresArray = features ? features.split(',') : undefined;
    return this.cjOrdersService.getOrderDetails(orderId, featuresArray);
  }

  @Delete(':orderId')
  async deleteOrder(@Param('orderId') orderId: string) {
    this.logger.log(`Requête reçue pour suppression commande: ${orderId}`);
    return this.cjOrdersService.deleteOrder(orderId);
  }

  @Patch(':orderId/confirm')
  async confirmOrder(@Param('orderId') orderId: string) {
    this.logger.log(`Requête reçue pour confirmation commande: ${orderId}`);
    return this.cjOrdersService.confirmOrder(orderId);
  }

  @Get('balance')
  async getBalance() {
    this.logger.log('Requête reçue pour solde du compte');
    return this.cjOrdersService.getBalance();
  }

  @Post('pay-balance')
  async payWithBalance(@Body() body: { orderId: string }) {
    this.logger.log('Requête reçue pour paiement avec solde');
    return this.cjOrdersService.payWithBalance(body.orderId);
  }

  @Post('pay-balance-v2')
  async payWithBalanceV2(@Body() body: { shipmentOrderId: string; payId: string }) {
    this.logger.log('Requête reçue pour paiement V2 avec solde');
    return this.cjOrdersService.payWithBalanceV2(body.shipmentOrderId, body.payId);
  }

  @Get('status/:orderId')
  async getOrderStatus(@Param('orderId') orderId: string) {
    this.logger.log(`Requête reçue pour statut commande: ${orderId}`);
    
    const result = await this.cjOrdersService.getOrderDetails(orderId);
    if (result.success) {
      return {
        success: true,
        orderId: result.order.orderId,
        status: result.order.orderStatus,
        createDate: result.order.createDate,
        paymentDate: result.order.paymentDate
      };
    }
    return result;
  }

  @Get('tracking/:orderId')
  async getOrderTracking(@Param('orderId') orderId: string) {
    this.logger.log(`Requête reçue pour suivi commande: ${orderId}`);
    
    const result = await this.cjOrdersService.getOrderDetails(orderId, ['LOGISTICS_TIMELINESS']);
    if (result.success) {
      return {
        success: true,
        orderId: result.order.orderId,
        trackNumber: result.order.trackNumber,
        trackingUrl: result.order.trackingUrl,
        logisticName: result.order.logisticName,
        logisticsTimeliness: result.order.logisticsTimeliness
      };
    }
    return result;
  }

  @Get('analytics/summary')
  async getOrdersAnalytics(@Query() params: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    this.logger.log('Requête reçue pour analytics des commandes');
    
    const result = await this.cjOrdersService.getOrders(params);
    if (result.success) {
      const analytics = {
        total: result.total,
        byStatus: {},
        totalAmount: 0,
        averageAmount: 0
      };
      
      result.orders.forEach(order => {
        const status = order.orderStatus || 'UNKNOWN';
        analytics.byStatus[status] = (analytics.byStatus[status] || 0) + 1;
        analytics.totalAmount += parseFloat(order.orderAmount || 0);
      });
      
      analytics.averageAmount = result.total > 0 ? analytics.totalAmount / result.total : 0;
      
      return {
        success: true,
        analytics
      };
    }
    return result;
  }
}
