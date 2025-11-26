import { Controller, Get, Post, Body, Query, Req, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { GeoLocationService, GeoLocationResult } from './geo.service';
import { CurrencyService } from '../currency/currency.service';

@ApiTags('geo')
@Controller('api/geo')
export class GeoController {
  private readonly logger = new Logger(GeoController.name);

  constructor(
    private readonly geoService: GeoLocationService,
    private readonly currencyService: CurrencyService,
  ) {}

  @Get('detect-country')
  @ApiOperation({ summary: 'Détecte le pays depuis l\'adresse IP' })
  @ApiQuery({ name: 'ip', required: false, description: 'Adresse IP à utiliser (optionnel)' })
  async detectCountry(@Req() req: any, @Query('ip') ip?: string): Promise<GeoLocationResult | { error: string }> {
    try {
      // Utiliser l'IP fournie ou extraire depuis la requête
      const clientIP = ip || req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      
      this.logger.log(`🌍 Détection pays pour IP: ${clientIP}`);
      
      const result = await this.geoService.detectCountryFromIP(clientIP);
      
      if (!result) {
        return { error: 'Impossible de détecter le pays' };
      }

      return result;
    } catch (error: any) {
      this.logger.error(`❌ Erreur détection pays: ${error.message}`);
      return { error: error.message || 'Erreur lors de la détection du pays' };
    }
  }

  @Post('set-country')
  @ApiOperation({ summary: 'Définit manuellement le pays du client' })
  async setCountry(@Body() body: { countryCode: string }): Promise<{ success: boolean; countryCode: string; countryName: string; currency: string } | { error: string }> {
    try {
      if (!body.countryCode) {
        return { error: 'Code pays requis' };
      }

      if (!this.geoService.isValidCountryCode(body.countryCode)) {
        return { error: 'Code pays invalide' };
      }

      const countryName = this.geoService.getCountryName(body.countryCode);
      const currency = this.currencyService.getCurrencyFromCountry(body.countryCode);

      return {
        success: true,
        countryCode: body.countryCode.toUpperCase(),
        countryName,
        currency, // ✅ Retourner la devise correspondante
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur définition pays: ${error.message}`);
      return { error: error.message || 'Erreur lors de la définition du pays' };
    }
  }

  @Get('country-name')
  @ApiOperation({ summary: 'Obtient le nom du pays depuis son code' })
  @ApiQuery({ name: 'code', required: true, description: 'Code pays (ISO 3166-1 alpha-2)' })
  async getCountryName(@Query('code') code: string): Promise<{ countryCode: string; countryName: string } | { error: string }> {
    try {
      if (!code) {
        return { error: 'Code pays requis' };
      }

      if (!this.geoService.isValidCountryCode(code)) {
        return { error: 'Code pays invalide' };
      }

      const countryName = this.geoService.getCountryName(code);

      return {
        countryCode: code.toUpperCase(),
        countryName,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération nom pays: ${error.message}`);
      return { error: error.message || 'Erreur lors de la récupération du nom du pays' };
    }
  }
}

