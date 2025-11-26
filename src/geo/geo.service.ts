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
      // Essayer d'abord avec ipapi.com (si clé disponible)
      const accessKey = this.configService.get<string>('IPAPI_ACCESS_KEY');
      
      if (accessKey) {
        this.logger.log(`🔑 Utilisation ipapi.com avec clé API`);
        try {
          const targetIp = ip || 'check';
          const url = `${this.ipapiUrl}/${targetIp}`;
          const response = await axios.get(url, {
            params: {
              access_key: accessKey,
              language: 'fr',
              output: 'json',
            },
            timeout: 5000,
            headers: {
              'User-Agent': 'KAMRI-Platform/1.0',
            },
          });
          
          if (response.data && response.data.country_code) {
            const currencyCode = response.data.currency?.code || response.data.currency;
            const result: GeoLocationResult = {
              countryCode: response.data.country_code,
              countryName: response.data.country_name || response.data.country_code,
              currency: currencyCode,
              ip: response.data.ip || ip,
              source: 'ipapi',
            };
            this.logger.log(`✅ Pays détecté: ${result.countryCode} (${result.countryName}) - Devise: ${result.currency || 'N/A'} via ipapi.com`);
            return result;
          }
        } catch (apiError: any) {
          this.logger.warn(`⚠️ ipapi.com échoué (${apiError.message}), utilisation de ipapi.co gratuit`);
        }
      }
      
      // Fallback : utiliser ipapi.co (gratuit, pas de clé)
      this.logger.log(`🌍 Utilisation ipapi.co (gratuit) pour IP: ${ip || 'auto'}`);
      const targetUrl = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
      const response = await axios.get(targetUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'KAMRI-Platform/1.0',
        },
      });

      // Traiter la réponse de ipapi.co (format différent)
      if (response.data && (response.data.country || response.data.country_code)) {
        const countryCode = response.data.country_code || response.data.country;
        const currencyCode = response.data.currency;
        
        const result: GeoLocationResult = {
          countryCode: countryCode,
          countryName: response.data.country_name || countryCode,
          currency: currencyCode,
          ip: response.data.ip || ip,
          source: 'ipapi',
        };

        this.logger.log(`✅ Pays détecté: ${result.countryCode} (${result.countryName}) - Devise: ${result.currency || 'N/A'} via ipapi.co`);
        return result;
      }

      this.logger.warn('⚠️ Réponse API invalide');
      return {
        countryCode: 'FR',
        countryName: 'France',
        currency: 'EUR',
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

