// ✅ VERSION OPTIMISÉE - ProductViewersService
// Fichier source : src/products/product-viewers.service.ts

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

interface Viewer {
  productId: string;
  sessionId: string;
  lastSeen: Date;
}

@Injectable()
export class ProductViewersService implements OnModuleDestroy {
  private readonly logger = new Logger(ProductViewersService.name);
  
  // Map: productId -> Set de sessionIds
  private viewers: Map<string, Map<string, Date>> = new Map();
  
  // Nettoyage automatique des viewers inactifs (toutes les 30 secondes)
  private readonly VIEWER_TIMEOUT = 30000; // 30 secondes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // ✅ OPTIMISATION : Vérifier si le tracking est activé
    const enableViewerTracking = process.env.ENABLE_VIEWER_TRACKING === 'true';
    
    if (!enableViewerTracking) {
      this.logger.log('⚠️ ProductViewersService désactivé (mode test)');
      this.logger.log('💡 Pour activer : définir ENABLE_VIEWER_TRACKING=true dans .env');
      return;
    }
    
    // ✅ OPTIMISATION : Intervalle configurable (défaut 60s au lieu de 10s)
    const cleanupIntervalMs = parseInt(
      process.env.VIEWER_CLEANUP_INTERVAL || '60000', // 60 secondes par défaut
      10
    );
    
    // Démarrer le nettoyage automatique
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveViewers();
    }, cleanupIntervalMs);
    
    this.logger.log(`✅ ProductViewersService initialisé - Nettoyage toutes les ${cleanupIntervalMs}ms`);
  }

  /**
   * Enregistrer qu'un utilisateur regarde un produit
   */
  addViewer(productId: string, sessionId: string): number {
    // ✅ Si désactivé, retourner 0 sans traitement
    if (!this.cleanupInterval) {
      return 0;
    }
    
    if (!this.viewers.has(productId)) {
      this.viewers.set(productId, new Map());
    }

    const productViewers = this.viewers.get(productId)!;
    productViewers.set(sessionId, new Date());

    const count = productViewers.size;
    this.logger.debug(`👁️ Product ${productId}: ${count} viewer(s) actif(s)`);
    
    return count;
  }

  /**
   * Retirer un viewer (quand l'utilisateur quitte la page)
   */
  removeViewer(productId: string, sessionId: string): number {
    if (!this.cleanupInterval) {
      return 0;
    }
    
    const productViewers = this.viewers.get(productId);
    if (!productViewers) {
      return 0;
    }

    productViewers.delete(sessionId);
    
    // Supprimer le produit s'il n'a plus de viewers
    if (productViewers.size === 0) {
      this.viewers.delete(productId);
      return 0;
    }

    return productViewers.size;
  }

  /**
   * Récupérer le nombre de viewers actifs pour un produit
   */
  getViewersCount(productId: string): number {
    if (!this.cleanupInterval) {
      return 0;
    }
    
    const productViewers = this.viewers.get(productId);
    return productViewers ? productViewers.size : 0;
  }

  /**
   * Nettoyer les viewers inactifs (qui n'ont pas envoyé de heartbeat récemment)
   */
  private cleanupInactiveViewers(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [productId, viewers] of this.viewers.entries()) {
      for (const [sessionId, lastSeen] of viewers.entries()) {
        const timeSinceLastSeen = now.getTime() - lastSeen.getTime();
        
        if (timeSinceLastSeen > this.VIEWER_TIMEOUT) {
          viewers.delete(sessionId);
          cleanedCount++;
        }
      }

      // Supprimer le produit s'il n'a plus de viewers
      if (viewers.size === 0) {
        this.viewers.delete(productId);
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`🧹 Nettoyage: ${cleanedCount} viewer(s) inactif(s) supprimé(s)`);
    }
  }

  /**
   * Arrêter le service (pour les tests)
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}


