/**
 * Événement de progression de synchronisation
 */
export interface CJSyncProgressEvent {
  stage: 'fetching' | 'importing' | 'completed';  // Étape actuelle
  current: number;                                 // Numéro du produit actuel
  total: number;                                   // Total de produits
  percentage: number;                              // Pourcentage (0-100)
  productName: string;                             // Nom du produit en cours
  synced: number;                                  // Nombre de réussis
  failed: number;                                  // Nombre d'échecs
  estimatedTimeRemaining: number;                  // Temps restant en secondes
  speed: number;                                   // Vitesse (produits/seconde)
}

/**
 * Résultat final de synchronisation
 */
export interface CJSyncResult {
  done: true;
  success: boolean;
  synced: number;
  failed: number;
  total: number;
  duration: number;                                // Durée totale en secondes
  errors?: Array<{
    pid: string;
    name: string;
    error: string;
  }>;
  message: string;
}

/**
 * Type d'événement SSE (union)
 */
export type CJSyncEvent = CJSyncProgressEvent | CJSyncResult;

