import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';

@ApiTags('currency')
@Controller('api/currency')
export class CurrencyController {
  private readonly logger = new Logger(CurrencyController.name);

  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  @ApiOperation({ summary: 'Récupérer tous les taux de change' })
  @ApiResponse({ status: 200, description: 'Taux de change récupérés avec succès' })
  async getRates() {
    const rates = await this.currencyService.getExchangeRates();
    return {
      success: true,
      rates,
      base: 'USD',
    };
  }

  @Get('currency-from-country')
  @ApiOperation({ summary: 'Obtenir la devise d\'un pays' })
  @ApiQuery({ name: 'countryCode', required: true, description: 'Code pays (ex: FR, US, CM)' })
  @ApiResponse({ status: 200, description: 'Devise du pays' })
  async getCurrencyFromCountry(@Query('countryCode') countryCode: string) {
    const currency = this.currencyService.getCurrencyFromCountry(countryCode);
    return {
      success: true,
      countryCode: countryCode.toUpperCase(),
      currency,
    };
  }

  @Post('update')
  @ApiOperation({ summary: 'Mettre à jour les taux de change depuis l\'API externe' })
  @ApiResponse({ status: 200, description: 'Taux de change mis à jour' })
  async updateRates() {
    this.logger.log('🔄 Mise à jour des taux de change...');
    const result = await this.currencyService.updateExchangeRates();
    return result;
  }

  @Get('convert')
  @ApiOperation({ summary: 'Convertir un prix USD vers une devise' })
  @ApiQuery({ name: 'price', required: true, description: 'Prix en USD' })
  @ApiQuery({ name: 'currency', required: true, description: 'Devise cible (EUR, XAF, etc.)' })
  @ApiResponse({ status: 200, description: 'Prix converti' })
  async convertPrice(
    @Query('price') price: string,
    @Query('currency') currency: string,
  ) {
    const priceUSD = parseFloat(price);
    if (isNaN(priceUSD)) {
      return {
        success: false,
        error: 'Prix invalide',
      };
    }

    const convertedPrice = await this.currencyService.convertPrice(priceUSD, currency);
    const formattedPrice = this.currencyService.formatPrice(convertedPrice, currency);

    return {
      success: true,
      originalPrice: priceUSD,
      currency,
      convertedPrice,
      formattedPrice,
    };
  }
}



