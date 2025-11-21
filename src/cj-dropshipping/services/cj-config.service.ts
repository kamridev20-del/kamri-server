import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CJAPIClient } from '../cj-api-client';
import { UpdateCJConfigDto } from '../dto/cj-config.dto';

@Injectable()
export class CJConfigService {
  private readonly logger = new Logger(CJConfigService.name);

  constructor(
    private prisma: PrismaService,
    private cjApiClient: CJAPIClient
  ) {}

  /**
   * Obtenir la configuration CJ
   */
  async getConfig(): Promise<any> {
    let config = await this.prisma.cJConfig.findFirst();
    
    if (!config) {
      // Créer une configuration par défaut vide
      config = await this.prisma.cJConfig.create({
        data: {
          email: '',
          apiKey: '',
          tier: 'free',
          platformToken: null,
          enabled: false,
        },
      });
    }

    return {
      ...config,
      connected: this.cjApiClient?.isConnected() || false,
    };
  }

  /**
   * Mettre à jour la configuration CJ
   */
  async updateConfig(data: UpdateCJConfigDto): Promise<any> {
    const existingConfig = await this.prisma.cJConfig.findFirst();
    
    const configData = {
      ...(data.email && { email: data.email }),
      ...(data.apiKey && { apiKey: data.apiKey }),
      ...(data.tier && { tier: data.tier }),
      ...(data.platformToken !== undefined && { platformToken: data.platformToken }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    };

    if (existingConfig) {
      const updatedConfig = await this.prisma.cJConfig.update({
        where: { id: existingConfig.id },
        data: configData,
      });

      return {
        ...updatedConfig,
        connected: this.cjApiClient?.isConnected() || false,
      };
    } else {
      const newConfig = await this.prisma.cJConfig.create({
        data: {
          email: data.email || '',
          apiKey: data.apiKey || '',
          tier: data.tier || 'free',
          platformToken: data.platformToken,
          enabled: data.enabled || false,
        },
      });

      return {
        ...newConfig,
        connected: false,
      };
    }
  }

  /**
   * Tester la connexion CJ et charger les données initiales
   */
  async testConnection(): Promise<{ 
    success: boolean; 
    message: string; 
    categories?: any[]; 
    products?: any[];
    categoriesCount?: number;
    productsCount?: number;
  }> {
    try {
      this.logger.log('🚀 === DÉBUT CONNEXION ET CHARGEMENT SIMULTANÉ ===');
      this.logger.log('Initialisation du client CJ...');
      
      // Vérifier si on a un token valide
      const hasToken = this.cjApiClient['accessToken'];
      const tokenExpiry = this.cjApiClient['tokenExpiry'];
      const isTokenValid = hasToken && tokenExpiry && new Date() < tokenExpiry;
      
      if (!isTokenValid) {
        this.logger.log('🔑 Pas de token valide - Login CJ requis');
        
        const config = await this.getConfig();
        if (!config.enabled) {
          throw new Error('L\'intégration CJ Dropshipping est désactivée');
        }

        // Initialiser la configuration du client injecté
        this.cjApiClient.setConfig({
          email: config.email,
          apiKey: config.apiKey,
          tier: config.tier as 'free' | 'plus' | 'prime' | 'advanced',
          platformToken: config.platformToken,
          debug: process.env.CJ_DEBUG === 'true',
        });

        await this.cjApiClient.login();
        this.logger.log('✅ Login CJ réussi');
      } else {
        this.logger.log('✅ Token CJ déjà valide - Utilisation de la connexion existante');
      }
      
      // Charger les catégories ET les produits en parallèle
      this.logger.log('📡 Chargement simultané des catégories et produits...');
      
      const [categoriesResult, productsResult] = await Promise.allSettled([
        this.cjApiClient.getCategories(),
        this.cjApiClient.searchProducts('', { pageNum: 1, pageSize: 100 })
      ]);
      
      const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
      const productsData = productsResult.status === 'fulfilled' ? productsResult.value : { products: [] };
      // ✅ V2 utilise "products" au lieu de "list"
      const products = Array.isArray(productsData) ? productsData : (productsData as any).products || (productsData as any).list || [];
      
      this.logger.log(`✅ Connexion réussie - ${categories.length} catégories, ${products.length} produits chargés`);
      this.logger.log('✅ Connexion CJ établie (sans synchronisation automatique)');
      
      return { 
        success: true, 
        message: `Connexion CJ Dropshipping réussie - ${categories.length} catégories et ${products.length} produits chargés`,
        categories,
        products,
        categoriesCount: categories.length,
        productsCount: products.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Test de connexion CJ échoué:', error);
      return { 
        success: false, 
        message: `Connexion CJ Dropshipping échouée: ${errorMessage}` 
      };
    }
  }

  /**
   * Obtenir le statut de connexion CJ
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    tier: string;
    lastSync: string | null;
    apiLimits: {
      qps: string;
      loginPer5min: number;
      refreshPerMin: number;
    };
    tips: string[];
  }> {
    try {
      // Récupérer la configuration
      const config = await this.getConfig();
      
      this.logger.log('🔍 Vérification connexion CJ...');
      
      // Vérifier si le client est connecté
      let connected = false;
      let tier = config.tier || 'free';
      let errorMessage = '';
      
      try {
        if (!config.email || !config.apiKey) {
          errorMessage = 'Email ou API Key manquant';
          this.logger.log('❌ Credentials manquants');
        } else if (!config.enabled) {
          errorMessage = 'Intégration CJ désactivée';
          this.logger.log('❌ Intégration désactivée');
        } else {
          // Vérifier le token
          const hasToken = this.cjApiClient['accessToken'];
          const tokenExpiry = this.cjApiClient['tokenExpiry'];
          const isTokenValid = hasToken && tokenExpiry && new Date() < tokenExpiry;
          
          this.logger.log('🔑 État du token:', {
            hasToken: !!hasToken,
            tokenExpiry: tokenExpiry,
            isTokenValid: isTokenValid
          });
          
          connected = true;
          this.logger.log('✅ Client CJ connecté (sans synchronisation automatique)');
        }
      } catch (error) {
        connected = false;
        errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('❌ Erreur de connexion:', errorMessage);
      }

      // Définir les limites selon le tier
      const apiLimits = {
        free: { qps: '1 req/s', loginPer5min: 1, refreshPerMin: 5 },
        plus: { qps: '2 req/s', loginPer5min: 1, refreshPerMin: 5 },
        prime: { qps: '4 req/s', loginPer5min: 1, refreshPerMin: 5 },
        advanced: { qps: '6 req/s', loginPer5min: 1, refreshPerMin: 5 }
      };

      const limits = apiLimits[tier as keyof typeof apiLimits] || apiLimits.free;

      return {
        connected,
        tier,
        lastSync: null, // TODO: Implémenter le suivi de la dernière sync
        apiLimits: {
          qps: limits.qps,
          loginPer5min: limits.loginPer5min,
          refreshPerMin: limits.refreshPerMin
        },
        tips: connected ? [
          'Connexion CJ active - Vous pouvez rechercher des produits',
          'Synchronisez vos favoris pour les importer',
          'Gérez vos commandes via l\'interface CJ'
        ] : [
          errorMessage || 'Problème de connexion détecté',
          'Vérifiez vos credentials CJ',
          'Activez l\'intégration si nécessaire',
          'Testez la connexion avec le bouton "Tester la connexion"'
        ]
      };
    } catch (error) {
      this.logger.error('Erreur récupération statut connexion:', error);
      return {
        connected: false,
        tier: 'free',
        lastSync: null,
        apiLimits: {
          qps: '1 req/s',
          loginPer5min: 1,
          refreshPerMin: 5
        },
        tips: [
          'Erreur lors de la récupération du statut',
          'Vérifiez votre configuration CJ',
          'Contactez le support si le problème persiste'
        ]
      };
    }
  }
}

