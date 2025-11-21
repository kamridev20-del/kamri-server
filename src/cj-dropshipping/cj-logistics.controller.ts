import { Body, Controller, Get, Logger, Param, Post, Query } from '@nestjs/common';
import { CJLogisticsService } from './cj-logistics.service';

@Controller('api/cj-dropshipping/logistics')
export class CJLogisticsController {
  private readonly logger = new Logger(CJLogisticsController.name);

  constructor(private readonly cjLogisticsService: CJLogisticsService) {}

  /**
   * Récupère toutes les options de logistique
   */
  @Get()
  async getAllLogistics() {
    this.logger.log('📦 Récupération de toutes les logistiques CJ');
    
    try {
      const logistics = await this.cjLogisticsService.getAllLogistics();
      
      return {
        success: true,
        total: logistics.length,
        logistics: logistics
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération logistiques: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les logistiques par pays
   */
  @Get('country/:countryCode')
  async getLogisticsByCountry(@Param('countryCode') countryCode: string) {
    this.logger.log(`🌍 Récupération logistiques pour pays: ${countryCode}`);
    
    try {
      const logistics = await this.cjLogisticsService.getLogisticsByCountry(countryCode);
      
      return {
        success: true,
        country: countryCode,
        total: logistics.length,
        logistics: logistics
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération logistiques par pays: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les logistiques express
   */
  @Get('express')
  async getExpressLogistics() {
    this.logger.log('⚡ Récupération des logistiques express');
    
    try {
      const logistics = await this.cjLogisticsService.getExpressLogistics();
      
      return {
        success: true,
        total: logistics.length,
        logistics: logistics
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération logistiques express: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les logistiques pour produits sensibles
   */
  @Get('sensitive')
  async getSensitiveLogistics() {
    this.logger.log('🔋 Récupération des logistiques sensibles');
    
    try {
      const logistics = await this.cjLogisticsService.getSensitiveLogistics();
      
      return {
        success: true,
        total: logistics.length,
        logistics: logistics
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération logistiques sensibles: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les logistiques par délai maximum
   */
  @Get('delivery-time')
  async getLogisticsByDeliveryTime(@Query('maxDays') maxDays: string) {
    const maxDaysNumber = parseInt(maxDays);
    this.logger.log(`⏰ Récupération logistiques avec délai max: ${maxDaysNumber} jours`);
    
    try {
      const logistics = await this.cjLogisticsService.getLogisticsByDeliveryTime(maxDaysNumber);
      
      return {
        success: true,
        maxDays: maxDaysNumber,
        total: logistics.length,
        logistics: logistics
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération logistiques par délai: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Recherche de logistiques
   */
  @Get('search')
  async searchLogistics(@Query('q') query: string) {
    this.logger.log(`🔍 Recherche de logistiques: ${query}`);
    
    try {
      const logistics = await this.cjLogisticsService.searchLogistics(query);
      
      return {
        success: true,
        query: query,
        total: logistics.length,
        logistics: logistics
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche logistiques: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les logistiques recommandées
   */
  @Get('recommended')
  async getRecommendedLogistics(
    @Query('country') countryCode: string,
    @Query('sensitive') isSensitive: string = 'false'
  ) {
    const sensitive = isSensitive === 'true';
    this.logger.log(`🎯 Logistiques recommandées pour ${countryCode} (sensible: ${sensitive})`);
    
    try {
      const logistics = await this.cjLogisticsService.getRecommendedLogistics(countryCode, sensitive);
      
      return {
        success: true,
        country: countryCode,
        sensitive: sensitive,
        total: logistics.length,
        logistics: logistics
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération logistiques recommandées: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Calcule le coût de livraison
   */
  @Get('calculate-cost')
  async calculateShippingCost(
    @Query('logisticsId') logisticsId: string,
    @Query('weight') weight: string,
    @Query('country') countryCode: string
  ) {
    const logisticsIdNumber = parseInt(logisticsId);
    const weightNumber = parseFloat(weight);
    
    this.logger.log(`💰 Calcul coût livraison - Logistique: ${logisticsIdNumber}, Poids: ${weightNumber}g, Pays: ${countryCode}`);
    
    try {
      const cost = await this.cjLogisticsService.calculateShippingCost(
        logisticsIdNumber,
        weightNumber,
        countryCode
      );
      
      return {
        success: true,
        logisticsId: logisticsIdNumber,
        weight: weightNumber,
        country: countryCode,
        cost: cost
      };
    } catch (error) {
      this.logger.error(`❌ Erreur calcul coût livraison: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Synchronise les logistiques en base de données
   */
  @Get('sync')
  async syncLogistics() {
    this.logger.log('🔄 Synchronisation des logistiques CJ');
    
    try {
      await this.cjLogisticsService.syncLogisticsToDatabase();
      
      return {
        success: true,
        message: 'Logistiques synchronisées avec succès'
      };
    } catch (error) {
      this.logger.error(`❌ Erreur synchronisation logistiques: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Calcule le fret pour des produits
   */
  @Post('calculate-freight')
  async calculateFreight(@Body() params: {
    startCountryCode: string;
    endCountryCode: string;
    zip?: string;
    taxId?: string;
    houseNumber?: string;
    iossNumber?: string;
    products: Array<{
      quantity: number;
      vid: string;
    }>;
  }) {
    this.logger.log('🚚 Calcul du fret');
    return this.cjLogisticsService.calculateFreight(params);
  }

  /**
   * Calcule le fret avancé avec conseils
   */
  @Post('calculate-freight-tip')
  async calculateFreightTip(@Body() params: {
    reqDTOS: Array<{
      srcAreaCode: string;
      destAreaCode: string;
      length: number;
      width: number;
      height: number;
      volume: number;
      totalGoodsAmount: number;
      productProp: string[];
      freightTrialSkuList: Array<{
        skuQuantity: number;
        sku: string;
      }>;
      skuList: string[];
      platforms?: string[];
      customerCode?: string;
      zip?: string;
      houseNumber?: string;
      iossNumber?: string;
      storageIdList?: string;
      recipientAddress?: string;
      city?: string;
      recipientName?: string;
      town?: string;
      phone?: string;
      wrapWeight: number;
      station?: string;
      dutyNo?: string;
      email?: string;
      province?: string;
      recipientAddress1?: string;
      uid?: string;
      recipientId?: string;
      recipientAddress2?: string;
      amount?: number;
      productTypes?: string[];
      weight: number;
      optionName?: string;
      volumeWeight?: number;
      orderType?: string;
    }>;
  }) {
    this.logger.log('💡 Calcul du fret avancé');
    return this.cjLogisticsService.calculateFreightTip(params);
  }

  /**
   * Récupère les informations de suivi (déprécié)
   */
  @Get('tracking')
  async getTrackingInfo(@Query('trackNumbers') trackNumbers: string) {
    this.logger.log('📦 Suivi des expéditions (déprécié)');
    const trackNumbersArray = trackNumbers.split(',');
    return this.cjLogisticsService.getTrackingInfo(trackNumbersArray);
  }

  /**
   * Récupère les informations de suivi (nouveau)
   */
  @Get('track-info')
  async getTrackInfo(@Query('trackNumbers') trackNumbers: string) {
    this.logger.log('📦 Suivi des expéditions (nouveau)');
    const trackNumbersArray = trackNumbers.split(',');
    return this.cjLogisticsService.getTrackInfo(trackNumbersArray);
  }
}
