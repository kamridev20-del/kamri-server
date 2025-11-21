import { Controller, Get, Logger, Param, Query } from '@nestjs/common';
import { CJCountriesService } from './cj-countries.service';
import { logError } from './utils/error-handler';

@Controller('cj-dropshipping/countries')
export class CJCountriesController {
  private readonly logger = new Logger(CJCountriesController.name);

  constructor(private readonly cjCountriesService: CJCountriesService) {}

  /**
   * Récupère tous les pays
   */
  @Get()
  async getAllCountries() {
    this.logger.log('🌍 Récupération de tous les pays CJ');
    
    try {
      const countries = await this.cjCountriesService.getAllCountries();
      
      return {
        success: true,
        total: countries.length,
        countries: countries
      };
    } catch (error) {
      logError(this.logger, '❌ Erreur récupération pays', error);
      throw error;
    }
  }

  /**
   * Récupère un pays par code
   */
  @Get('code/:code')
  async getCountryByCode(@Param('code') code: string) {
    this.logger.log(`🔍 Recherche du pays: ${code}`);
    
    try {
      const country = await this.cjCountriesService.getCountryByCode(code);
      
      if (!country) {
        return {
          success: false,
          message: `Pays non trouvé: ${code}`
        };
      }
      
      return {
        success: true,
        country: country
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche pays ${code}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les pays par région
   */
  @Get('region/:region')
  async getCountriesByRegion(@Param('region') region: string) {
    this.logger.log(`🗺️ Récupération des pays de la région: ${region}`);
    
    try {
      const countries = await this.cjCountriesService.getCountriesByRegion(region);
      
      return {
        success: true,
        region: region,
        total: countries.length,
        countries: countries
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération pays par région ${region}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les pays par continent
   */
  @Get('continent/:continent')
  async getCountriesByContinent(@Param('continent') continent: string) {
    this.logger.log(`🌎 Récupération des pays du continent: ${continent}`);
    
    try {
      const countries = await this.cjCountriesService.getCountriesByContinent(continent);
      
      return {
        success: true,
        continent: continent,
        total: countries.length,
        countries: countries
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération pays par continent ${continent}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Recherche de pays
   */
  @Get('search')
  async searchCountries(@Query('q') query: string) {
    this.logger.log(`🔍 Recherche de pays: ${query}`);
    
    try {
      const countries = await this.cjCountriesService.searchCountries(query);
      
      return {
        success: true,
        query: query,
        total: countries.length,
        countries: countries
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche pays: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les pays supportés par CJ
   */
  @Get('supported')
  async getSupportedCountries() {
    this.logger.log('✅ Récupération des pays supportés par CJ');
    
    try {
      const countries = await this.cjCountriesService.getSupportedCountries();
      
      return {
        success: true,
        total: countries.length,
        countries: countries
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération pays supportés: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Synchronise les pays en base de données
   */
  @Get('sync')
  async syncCountries() {
    this.logger.log('🔄 Synchronisation des pays CJ');
    
    try {
      await this.cjCountriesService.syncCountriesToDatabase();
      
      return {
        success: true,
        message: 'Pays synchronisés avec succès'
      };
    } catch (error) {
      this.logger.error(`❌ Erreur synchronisation pays: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }
}
