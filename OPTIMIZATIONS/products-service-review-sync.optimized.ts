// ✅ VERSION OPTIMISÉE - Synchronisation Reviews
// Fichier source : src/products/products.service.ts
// Lignes concernées : 39-78

// ✅ MODIFICATION À APPORTER dans syncProductReviewsInBackground() :

/**
 * ✅ Synchroniser les reviews CJ en arrière-plan après l'import
 * OPTIMISATION : Désactivable via variable d'environnement
 */
private syncProductReviewsInBackground(productId: string, cjProductId: string): void {
  // ✅ OPTIMISATION : Vérifier si la synchronisation est activée
  const enableReviewSync = process.env.ENABLE_REVIEW_SYNC === 'true';
  
  if (!enableReviewSync) {
    this.logger.debug(`⚠️ Synchronisation reviews désactivée pour produit ${productId}`);
    return;
  }
  
  // Lancer en arrière-plan sans bloquer avec setTimeout
  setTimeout(async () => {
    try {
      this.logger.log(`🔄 [REVIEWS-SYNC] Démarrage pour produit ${productId} (CJ: ${cjProductId})`);
      
      // Récupérer les reviews depuis l'API CJ via getProductReviews
      const reviewsResponse = await this.cjApiClient.getProductReviews(cjProductId, 1, 100);
      const reviews = reviewsResponse?.list || [];

      if (reviews && reviews.length > 0) {
        const { rating, count } = this.calculateRatingFromReviews(reviews);

        // Mettre à jour le produit avec les reviews
        await this.prisma.product.update({
          where: { id: productId },
          data: {
            rating,
            cjReviews: JSON.stringify(reviews),
            reviewsCount: count
          }
        });

        this.logger.log(`✅ [REVIEWS-SYNC] ${count} avis synchronisés pour ${productId} - Rating: ${rating}/5`);
      } else {
        this.logger.log(`ℹ️ [REVIEWS-SYNC] Aucun avis disponible pour ${productId}`);
        
        // Mettre à jour quand même pour indiquer qu'on a vérifié
        await this.prisma.product.update({
          where: { id: productId },
          data: {
            cjReviews: '[]',
            reviewsCount: 0
          }
        });
      }
    } catch (error: any) {
      this.logger.error(`❌ [REVIEWS-SYNC] Erreur pour ${productId}:`, error.message);
    }
  }, 0);
}

