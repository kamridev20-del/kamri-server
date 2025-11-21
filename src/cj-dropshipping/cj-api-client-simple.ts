import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface CJResponse<T = any> {
  code: number;
  result: boolean;
  message: string;
  data: T;
  requestId?: string;
}

export interface CJAPIConfig {
  tier?: 'free' | 'plus' | 'prime' | 'advanced';
  debug?: boolean;
  platformToken?: string;
}

export class CJAPIClientSimple {
  private readonly logger = new Logger(CJAPIClientSimple.name);
  private readonly baseURL = 'https://developers.cjdropshipping.com/api2.0/v1';
  private readonly axiosInstance: AxiosInstance;
  
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiry?: Date;
  private config: CJAPIConfig;

  constructor(
    private readonly email: string,
    private readonly apiKey: string,
    config: CJAPIConfig = {}
  ) {
    this.config = { tier: 'free', debug: false, ...config };
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Connexion à l'API CJ
   */
  async login(): Promise<void> {
    try {
      this.logger.log('🔑 Connexion à l\'API CJ...');
      
      const response = await this.axiosInstance.post('/authentication/getAccessToken', {
        email: this.email,
        apiKey: this.apiKey,
      });

      const { data } = response.data;
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.tokenExpiry = new Date(data.accessTokenExpiryDate);

      this.logger.log('✅ Connexion réussie');
    } catch (error) {
      this.logger.error('❌ Erreur de connexion:', error);
      throw error;
    }
  }

  /**
   * Rafraîchir le token d'accès
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('Aucun refresh token disponible');
    }

    try {
      this.logger.log('🔄 Rafraîchissement du token...');
      
      const response = await this.axiosInstance.post('/authentication/refreshAccessToken', {
        refreshToken: this.refreshToken,
      });

      const { data } = response.data;
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.tokenExpiry = new Date(data.accessTokenExpiryDate);

      this.logger.log('✅ Token rafraîchi avec succès');
    } catch (error) {
      this.logger.error('❌ Erreur de rafraîchissement du token:', error);
      // Si le refresh échoue, on relogin
      await this.login();
    }
  }

  /**
   * Effectuer une requête à l'API CJ
   */
  async makeRequest<T = any>(
    endpoint: string,
    data?: any,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST'
  ): Promise<CJResponse<T>> {
    // Vérifier et rafraîchir le token si nécessaire
    if (!this.accessToken || (this.tokenExpiry && new Date() >= this.tokenExpiry)) {
      this.logger.log('🔄 Token expiré ou manquant, rafraîchissement...');
      await this.refreshAccessToken();
    }

    const headers: any = {
      'CJ-Access-Token': this.accessToken,
    };

    if (this.config.platformToken) {
      headers['platformToken'] = this.config.platformToken;
    }

    try {
      const response = await this.axiosInstance.request({
        method,
        url: endpoint,
        data,
        headers,
      });

      return response.data;
    } catch (error) {
      this.logger.error('❌ Erreur requête API:', error);
      throw error;
    }
  }

  /**
   * Rechercher des produits
   */
  async searchProducts(keyword: string, options: any = {}): Promise<CJResponse<any>> {
    return this.makeRequest('/product/list', {
      keyword,
      ...options
    });
  }

  /**
   * Obtenir les détails d'un produit
   */
  async getProductDetails(pid: string): Promise<CJResponse<any>> {
    return this.makeRequest(`/product/queryProductDetail?pid=${pid}`);
  }
}
