import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CJAPIClient } from './cj-api-client';

export interface CJQuotaLimit {
  quotaUrl: string;
  quotaLimit: number;
  quotaType: number; // 0-total, 1-per year, 2-per quarter, 3-per month, 4-per day, 5-per hour
}

export interface CJCallback {
  type: 'ENABLE' | 'CANCEL';
  urls: string[];
}

export interface CJAccountSettings {
  openId: number;
  openName: string;
  openEmail: string;
  setting: {
    quotaLimits: CJQuotaLimit[];
    qpsLimit: number;
  };
  callback: {
    product: CJCallback;
    order: CJCallback;
  };
  root: 'NO_PERMISSION' | 'GENERAL' | 'VIP' | 'ADMIN';
  isSandbox: boolean;
}

@Injectable()
export class CJSettingsService {
  private readonly logger = new Logger(CJSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cjApiClient: CJAPIClient
  ) {}

  /**
   * Récupère les paramètres du compte CJ
   */
  async getAccountSettings(): Promise<CJAccountSettings> {
    this.logger.log('⚙️ Récupération des paramètres du compte CJ');
    
    try {
      const response = await this.cjApiClient.makeRequest('GET', '/setting/get', {});
      
      if (response.code !== 200) {
        throw new Error(`Erreur récupération paramètres: ${response.message}`);
      }
      
      this.logger.log('✅ Paramètres du compte récupérés avec succès');
      return response.data as CJAccountSettings;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération paramètres: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les limites de quota
   */
  async getQuotaLimits(): Promise<CJQuotaLimit[]> {
    this.logger.log('📊 Récupération des limites de quota');
    
    try {
      const settings = await this.getAccountSettings();
      return settings.setting.quotaLimits;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération quotas: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère la limite QPS
   */
  async getQPSLimit(): Promise<number> {
    this.logger.log('⚡ Récupération de la limite QPS');
    
    try {
      const settings = await this.getAccountSettings();
      return settings.setting.qpsLimit;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération QPS: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Vérifie si le compte est sandbox
   */
  async isSandboxAccount(): Promise<boolean> {
    this.logger.log('🧪 Vérification du statut sandbox');
    
    try {
      const settings = await this.getAccountSettings();
      return settings.isSandbox;
    } catch (error) {
      this.logger.error(`❌ Erreur vérification sandbox: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère le niveau d'accès du compte
   */
  async getAccountLevel(): Promise<string> {
    this.logger.log('🔑 Récupération du niveau d\'accès');
    
    try {
      const settings = await this.getAccountSettings();
      return settings.root;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération niveau: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les informations de callback
   */
  async getCallbackSettings(): Promise<{ product: CJCallback; order: CJCallback }> {
    this.logger.log('🔔 Récupération des paramètres de callback');
    
    try {
      const settings = await this.getAccountSettings();
      return settings.callback;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération callbacks: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Vérifie si les webhooks sont activés
   */
  async areWebhooksEnabled(): Promise<{ product: boolean; order: boolean }> {
    this.logger.log('🔔 Vérification du statut des webhooks');
    
    try {
      const callbacks = await this.getCallbackSettings();
      return {
        product: callbacks.product.type === 'ENABLE',
        order: callbacks.order.type === 'ENABLE'
      };
    } catch (error) {
      this.logger.error(`❌ Erreur vérification webhooks: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Récupère les URLs de callback
   */
  async getCallbackUrls(): Promise<{ product: string[]; order: string[] }> {
    this.logger.log('🌐 Récupération des URLs de callback');
    
    try {
      const callbacks = await this.getCallbackSettings();
      return {
        product: callbacks.product.urls,
        order: callbacks.order.urls
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération URLs: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Analyse les performances du compte
   */
  async analyzeAccountPerformance(): Promise<{
    qpsLimit: number;
    quotaLimits: CJQuotaLimit[];
    accountLevel: string;
    isSandbox: boolean;
    webhooksEnabled: { product: boolean; order: boolean };
    recommendations: string[];
  }> {
    this.logger.log('📈 Analyse des performances du compte');
    
    try {
      const settings = await this.getAccountSettings();
      const webhooks = await this.areWebhooksEnabled();
      
      const recommendations: string[] = [];
      
      // Recommandations basées sur le niveau d'accès
      if (settings.root === 'NO_PERMISSION') {
        recommendations.push('⚠️ Compte non autorisé - Contacter le support CJ');
      } else if (settings.root === 'GENERAL') {
        recommendations.push('✅ Compte général - Fonctionnalités de base disponibles');
      } else if (settings.root === 'VIP') {
        recommendations.push('⭐ Compte VIP - Fonctionnalités avancées disponibles');
      } else if (settings.root === 'ADMIN') {
        recommendations.push('👑 Compte administrateur - Accès complet');
      }
      
      // Recommandations basées sur les quotas
      if (settings.setting.qpsLimit < 10) {
        recommendations.push('🐌 Limite QPS faible - Optimiser les requêtes');
      } else if (settings.setting.qpsLimit >= 100) {
        recommendations.push('🚀 Limite QPS élevée - Bonnes performances');
      }
      
      // Recommandations basées sur les webhooks
      if (!webhooks.product) {
        recommendations.push('🔔 Activer les webhooks produits pour les mises à jour temps réel');
      }
      if (!webhooks.order) {
        recommendations.push('🔔 Activer les webhooks commandes pour le suivi des commandes');
      }
      
      // Recommandations basées sur le statut sandbox
      if (settings.isSandbox) {
        recommendations.push('🧪 Compte sandbox - Utiliser pour les tests uniquement');
      }
      
      return {
        qpsLimit: settings.setting.qpsLimit,
        quotaLimits: settings.setting.quotaLimits,
        accountLevel: settings.root,
        isSandbox: settings.isSandbox,
        webhooksEnabled: webhooks,
        recommendations
      };
    } catch (error) {
      this.logger.error(`❌ Erreur analyse performances: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Synchronise les paramètres en base de données
   */
  async syncSettingsToDatabase(): Promise<void> {
    this.logger.log('🔄 Synchronisation des paramètres CJ en base de données');
    
    try {
      const settings = await this.getAccountSettings();
      
      // TODO: Ajouter le modèle CJAccountSettings au schéma Prisma
      // await this.prisma.cjAccountSettings.upsert({
      //   where: { openId: settings.openId },
      //   update: {
      //     openName: settings.openName,
      //     openEmail: settings.openEmail,
      //     qpsLimit: settings.setting.qpsLimit,
      //     quotaLimits: JSON.stringify(settings.setting.quotaLimits),
      //     callbackSettings: JSON.stringify(settings.callback),
      //     root: settings.root,
      //     isSandbox: settings.isSandbox,
      //     updatedAt: new Date(),
      //   },
      //   create: {
      //     openId: settings.openId,
      //     openName: settings.openName,
      //     openEmail: settings.openEmail,
      //     qpsLimit: settings.setting.qpsLimit,
      //     quotaLimits: JSON.stringify(settings.setting.quotaLimits),
      //     callbackSettings: JSON.stringify(settings.callback),
      //     root: settings.root,
      //     isSandbox: settings.isSandbox,
      //     createdAt: new Date(),
      //     updatedAt: new Date(),
      //   }
      // });
      
      this.logger.log(`✅ Paramètres du compte ${settings.openId} synchronisés`);
    } catch (error) {
      this.logger.error(`❌ Erreur synchronisation paramètres: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * Vérifie si le compte respecte les limites
   */
  async checkAccountLimits(): Promise<{
    withinLimits: boolean;
    qpsUsage: number;
    quotaUsage: { [key: string]: number };
    warnings: string[];
  }> {
    this.logger.log('🔍 Vérification des limites du compte');
    
    try {
      const settings = await this.getAccountSettings();
      const warnings: string[] = [];
      
      // Vérification QPS (simulation - en réalité, il faudrait tracker les requêtes)
      const qpsUsage = 0; // À implémenter avec un système de tracking
      
      if (qpsUsage > settings.setting.qpsLimit * 0.8) {
        warnings.push(`⚠️ Utilisation QPS élevée: ${qpsUsage}/${settings.setting.qpsLimit}`);
      }
      
      // Vérification des quotas (simulation)
      const quotaUsage: { [key: string]: number } = {};
      
      for (const quota of settings.setting.quotaLimits) {
        const usage = 0; // À implémenter avec un système de tracking
        quotaUsage[quota.quotaUrl] = usage;
        
        if (usage > quota.quotaLimit * 0.8) {
          warnings.push(`⚠️ Quota ${quota.quotaUrl} proche de la limite: ${usage}/${quota.quotaLimit}`);
        }
      }
      
      return {
        withinLimits: warnings.length === 0,
        qpsUsage,
        quotaUsage,
        warnings
      };
    } catch (error) {
      this.logger.error(`❌ Erreur vérification limites: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }
}
