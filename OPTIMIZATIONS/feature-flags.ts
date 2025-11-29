// ✅ FICHIER DE CONFIGURATION - Feature Flags
// Utiliser ce fichier pour centraliser la gestion des fonctionnalités

/**
 * Feature Flags pour activer/désactiver des fonctionnalités
 * Utile pour réduire la consommation de ressources en mode test
 */
export const FeatureFlags = {
  /**
   * Synchronisation automatique des taux de change
   * Défaut : false (désactivé en mode test)
   */
  currencySync: process.env.ENABLE_CURRENCY_SYNC === 'true',
  
  /**
   * Traitement des webhooks CJ Dropshipping
   * Défaut : false (désactivé en mode test)
   */
  cjWebhooks: process.env.ENABLE_CJ_WEBHOOKS === 'true',
  
  /**
   * Synchronisation automatique des reviews produits
   * Défaut : false (désactivé en mode test)
   */
  reviewSync: process.env.ENABLE_REVIEW_SYNC === 'true',
  
  /**
   * Tracking des viewers produits (nombre de personnes regardant)
   * Défaut : false (désactivé en mode test)
   */
  viewerTracking: process.env.ENABLE_VIEWER_TRACKING === 'true',
  
  /**
   * Logs verbeux pour debugging
   * Défaut : false
   */
  verboseLogs: process.env.CJ_VERBOSE_LOGS === 'true',
};

/**
 * Vérifier si une fonctionnalité est activée
 */
export function isFeatureEnabled(feature: keyof typeof FeatureFlags): boolean {
  return FeatureFlags[feature];
}

/**
 * Obtenir le statut de toutes les fonctionnalités
 */
export function getFeatureFlagsStatus() {
  return {
    ...FeatureFlags,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  };
}

