import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GeoLocationResult {
  countryCode: string;
  countryName: string;
  currency?: string; // Code devise depuis l'API (ex: USD, EUR, XAF)
  ip?: string;
  source: 'ipapi' | 'manual' | 'address';
}

@Injectable()
export class GeoLocationService {
  private readonly logger = new Logger(GeoLocationService.name);
  private readonly ipapiUrl = 'https://api.ipapi.com/api';

  constructor(private configService: ConfigService) {}

  /**
   * Détecte le pays depuis l'adresse IP
   * Utilise ipapi.com avec clé d'API
   */
  async detectCountryFromIP(ip?: string): Promise<GeoLocationResult | null> {
    try {
      const accessKey = this.configService.get<string>('IPAPI_ACCESS_KEY');
      if (!accessKey) {
        this.logger.warn('⚠️ IPAPI_ACCESS_KEY non configurée, utilisation du fallback');
        return {
          countryCode: 'FR',
          countryName: 'France',
          source: 'ipapi',
        };
      }

      // Utiliser 'check' si aucune IP n'est fournie pour détecter l'IP de la requête
      const targetIp = ip || 'check';
      this.logger.log(`🌍 Détection pays depuis IP: ${targetIp === 'check' ? 'requête actuelle' : targetIp}`);
      
      const url = `${this.ipapiUrl}/${targetIp}`;
      const response = await axios.get(url, {
        params: {
          access_key: accessKey,
          // Ne pas limiter les champs pour obtenir l'objet currency complet
          language: 'fr', // Noms de pays en français
          output: 'json', // Format JSON explicite
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'KAMRI-Platform/1.0',
        },
      });

      // Vérifier si c'est une erreur de l'API
      if (response.data && response.data.success === false) {
        const errorInfo = response.data.error?.info || 'Erreur inconnue';
        const errorCode = response.data.error?.code;
        this.logger.error(`❌ Erreur API ipapi.com (code ${errorCode}): ${errorInfo}`);
        
        // Si limite mensuelle atteinte, retourner un fallback
        if (errorCode === 104) {
          this.logger.warn('⚠️ Limite mensuelle ipapi.com atteinte, utilisation du fallback');
        }
        
        return {
          countryCode: 'FR',
          countryName: 'France',
          source: 'ipapi',
        };
      }

      if (response.data && response.data.country_code) {
        // Extraire la devise depuis l'objet currency si disponible
        const currencyCode = response.data.currency?.code || response.data.currency;
        
        const result: GeoLocationResult = {
          countryCode: response.data.country_code,
          countryName: response.data.country_name || response.data.country_code,
          currency: currencyCode, // Devise depuis l'API (ex: USD, EUR, XAF)
          ip: response.data.ip || ip,
          source: 'ipapi',
        };

        this.logger.log(`✅ Pays détecté: ${result.countryCode} (${result.countryName}) - Devise: ${result.currency || 'N/A'} via ipapi.com`);
        return result;
      }

      this.logger.warn('⚠️ Réponse ipapi.com invalide');
      return {
        countryCode: 'FR',
        countryName: 'France',
        source: 'ipapi',
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur détection pays: ${error.message || error}`);
      
      // En cas d'erreur, retourner un fallback
      return {
        countryCode: 'FR',
        countryName: 'France',
        source: 'ipapi',
      };
    }
  }

  /**
   * Valide un code pays (ISO 3166-1 alpha-2)
   */
  isValidCountryCode(code: string): boolean {
    // Liste des codes pays valides (ISO 3166-1 alpha-2)
    const validCodes = [
      'FR', 'US', 'GB', 'DE', 'IT', 'ES', 'CN', 'JP', 'KR', 'AU', 'CA', 'MX',
      'BR', 'IN', 'RU', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL',
      'PT', 'GR', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'EE', 'LV',
      'LT', 'LU', 'MT', 'CY', 'IS', 'LI', 'MC', 'AD', 'SM', 'VA', 'TR', 'UA',
      'BY', 'MD', 'AL', 'MK', 'RS', 'ME', 'BA', 'XK', 'GE', 'AM', 'AZ', 'KZ',
      'UZ', 'TM', 'TJ', 'KG', 'AF', 'PK', 'BD', 'LK', 'NP', 'BT', 'MV', 'MM',
      'TH', 'LA', 'KH', 'VN', 'MY', 'SG', 'BN', 'ID', 'PH', 'TW', 'HK', 'MO',
      'MN', 'KP', 'NZ', 'FJ', 'PG', 'SB', 'VU', 'NC', 'PF', 'WS', 'TO', 'KI',
      'TV', 'NR', 'PW', 'FM', 'MH', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE',
      'IQ', 'IR', 'JO', 'LB', 'SY', 'IL', 'PS', 'EG', 'SD', 'LY', 'TN', 'DZ',
      'MA', 'EH', 'MR', 'ML', 'NE', 'TD', 'SN', 'GM', 'GW', 'GN', 'SL', 'LR',
      'CI', 'GH', 'TG', 'BJ', 'NG', 'CM', 'GQ', 'GA', 'CG', 'CD', 'CF', 'SS',
      'ET', 'ER', 'DJ', 'SO', 'KE', 'UG', 'RW', 'BI', 'TZ', 'MW', 'ZM', 'ZW',
      'BW', 'NA', 'SZ', 'LS', 'ZA', 'MG', 'MU', 'SC', 'KM', 'YT', 'RE', 'MZ',
      'AO', 'ST', 'CV', 'GW', 'GN', 'LR', 'SL', 'CI', 'GH', 'TG', 'BJ', 'NG',
      'CM', 'GQ', 'GA', 'CG', 'CD', 'CF', 'SS', 'ET', 'ER', 'DJ', 'SO', 'KE',
      'UG', 'RW', 'BI', 'TZ', 'MW', 'ZM', 'ZW', 'BW', 'NA', 'SZ', 'LS', 'ZA',
      'MG', 'MU', 'SC', 'KM', 'YT', 'RE', 'MZ', 'AO', 'ST', 'CV',
    ];

    return validCodes.includes(code.toUpperCase());
  }

  /**
   * Obtient le nom du pays depuis son code
   */
  getCountryName(code: string): string {
    const countryNames: Record<string, string> = {
      'FR': 'France',
      'US': 'États-Unis',
      'GB': 'Royaume-Uni',
      'DE': 'Allemagne',
      'IT': 'Italie',
      'ES': 'Espagne',
      'CN': 'Chine',
      'JP': 'Japon',
      'KR': 'Corée du Sud',
      'AU': 'Australie',
      'CA': 'Canada',
      'MX': 'Mexique',
      'BR': 'Brésil',
      'IN': 'Inde',
      'NL': 'Pays-Bas',
      'BE': 'Belgique',
      'CH': 'Suisse',
      'AT': 'Autriche',
      'SE': 'Suède',
      'NO': 'Norvège',
      'DK': 'Danemark',
      'FI': 'Finlande',
      'PL': 'Pologne',
      'PT': 'Portugal',
      'GR': 'Grèce',
      'IE': 'Irlande',
      'CZ': 'République tchèque',
      'HU': 'Hongrie',
      'RO': 'Roumanie',
      'BG': 'Bulgarie',
      'HR': 'Croatie',
      'SK': 'Slovaquie',
      'SI': 'Slovénie',
      'EE': 'Estonie',
      'LV': 'Lettonie',
      'LT': 'Lituanie',
      'LU': 'Luxembourg',
      'MT': 'Malte',
      'CY': 'Chypre',
      'IS': 'Islande',
      'TR': 'Turquie',
      'UA': 'Ukraine',
      'RU': 'Russie',
    };

    return countryNames[code.toUpperCase()] || code;
  }
}

