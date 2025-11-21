import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Query } from '@nestjs/common';
import { CJWebhookService } from './cj-webhook.service';

export interface CJWebhookPayload {
  messageId: string;
  type: 'PRODUCT' | 'VARIANT' | 'STOCK' | 'ORDER' | 'ORDERSPLIT' | 'SOURCINGCREATE' | 'LOGISTIC';
  params: any;
}

@Controller('cj-dropshipping/webhooks')
export class CJWebhookController {
  private readonly logger = new Logger(CJWebhookController.name);

  constructor(private readonly cjWebhookService: CJWebhookService) {}

  @Post('product')
  @HttpCode(HttpStatus.OK)
  async handleProductWebhook(@Body() payload: CJWebhookPayload) {
    this.logger.log(`🔔 Webhook PRODUCT reçu: ${payload.messageId}`);
    
    try {
      await this.cjWebhookService.handleProductUpdate(payload);
      this.logger.log(`✅ Webhook PRODUCT traité avec succès: ${payload.messageId}`);
      return { success: true, messageId: payload.messageId };
    } catch (error) {
      this.logger.error(`❌ Erreur traitement webhook PRODUCT: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  @Post('variant')
  @HttpCode(HttpStatus.OK)
  async handleVariantWebhook(@Body() payload: CJWebhookPayload) {
    this.logger.log(`🔔 Webhook VARIANT reçu: ${payload.messageId}`);
    
    try {
      await this.cjWebhookService.handleVariantUpdate(payload);
      this.logger.log(`✅ Webhook VARIANT traité avec succès: ${payload.messageId}`);
      return { success: true, messageId: payload.messageId };
    } catch (error) {
      this.logger.error(`❌ Erreur traitement webhook VARIANT: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  @Post('stock')
  @HttpCode(HttpStatus.OK)
  async handleStockWebhook(@Body() payload: CJWebhookPayload) {
    this.logger.log(`🔔 Webhook STOCK reçu: ${payload.messageId}`);
    
    try {
      await this.cjWebhookService.handleStockUpdate(payload);
      this.logger.log(`✅ Webhook STOCK traité avec succès: ${payload.messageId}`);
      return { success: true, messageId: payload.messageId };
    } catch (error) {
      this.logger.error(`❌ Erreur traitement webhook STOCK: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  @Post('order')
  @HttpCode(HttpStatus.OK)
  async handleOrderWebhook(@Body() payload: CJWebhookPayload) {
    this.logger.log(`🔔 Webhook ORDER reçu: ${payload.messageId}`);
    
    try {
      await this.cjWebhookService.handleOrderUpdate(payload);
      this.logger.log(`✅ Webhook ORDER traité avec succès: ${payload.messageId}`);
      return { success: true, messageId: payload.messageId };
    } catch (error) {
      this.logger.error(`❌ Erreur traitement webhook ORDER: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  @Post('logistic')
  @HttpCode(HttpStatus.OK)
  async handleLogisticWebhook(@Body() payload: CJWebhookPayload) {
    this.logger.log(`🔔 Webhook LOGISTIC reçu: ${payload.messageId}`);
    
    try {
      await this.cjWebhookService.handleLogisticUpdate(payload);
      this.logger.log(`✅ Webhook LOGISTIC traité avec succès: ${payload.messageId}`);
      return { success: true, messageId: payload.messageId };
    } catch (error) {
      this.logger.error(`❌ Erreur traitement webhook LOGISTIC: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  @Post('sourcing')
  @HttpCode(HttpStatus.OK)
  async handleSourcingWebhook(@Body() payload: CJWebhookPayload) {
    this.logger.log(`🔔 Webhook SOURCINGCREATE reçu: ${payload.messageId}`);
    
    try {
      await this.cjWebhookService.handleSourcingUpdate(payload);
      this.logger.log(`✅ Webhook SOURCINGCREATE traité avec succès: ${payload.messageId}`);
      return { success: true, messageId: payload.messageId };
    } catch (error) {
      this.logger.error(`❌ Erreur traitement webhook SOURCINGCREATE: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  @Post('ordersplit')
  @HttpCode(HttpStatus.OK)
  async handleOrderSplitWebhook(@Body() payload: CJWebhookPayload) {
    this.logger.log(`🔔 Webhook ORDERSPLIT reçu: ${payload.messageId}`);
    
    try {
      await this.cjWebhookService.handleOrderSplitUpdate(payload);
      this.logger.log(`✅ Webhook ORDERSPLIT traité avec succès: ${payload.messageId}`);
      return { success: true, messageId: payload.messageId };
    } catch (error) {
      this.logger.error(`❌ Erreur traitement webhook ORDERSPLIT: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Configure les webhooks CJ
   */
  @Post('configure')
  async configureWebhooks(@Body() params: {
    product?: {
      type: 'ENABLE' | 'CANCEL';
      callbackUrls: string[];
    };
    stock?: {
      type: 'ENABLE' | 'CANCEL';
      callbackUrls: string[];
    };
    order?: {
      type: 'ENABLE' | 'CANCEL';
      callbackUrls: string[];
    };
    logistics?: {
      type: 'ENABLE' | 'CANCEL';
      callbackUrls: string[];
    };
  }) {
    this.logger.log('🔧 Configuration des webhooks CJ');
    return this.cjWebhookService.configureWebhooks(params);
  }

  /**
   * Configure les webhooks par défaut
   */
  @Post('setup-default')
  async setupDefaultWebhooks(@Query('baseUrl') baseUrl: string) {
    this.logger.log(`🔧 Configuration des webhooks par défaut: ${baseUrl}`);
    return this.cjWebhookService.setupDefaultWebhooks(baseUrl);
  }

  /**
   * Désactive tous les webhooks
   */
  @Post('disable-all')
  async disableAllWebhooks() {
    this.logger.log('🔧 Désactivation de tous les webhooks CJ');
    return this.cjWebhookService.disableAllWebhooks();
  }

  /**
   * Récupère le statut des webhooks
   */
  @Get('status')
  async getWebhookStatus() {
    this.logger.log('📊 Récupération du statut des webhooks');
    return this.cjWebhookService.getWebhookStatus();
  }
}
