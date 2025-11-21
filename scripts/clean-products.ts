import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script pour supprimer tous les produits de la base de données
 * ⚠️ ATTENTION : Cette opération est irréversible !
 *
 * Ce script supprime UNIQUEMENT les produits et leurs relations directes :
 * - Tous les produits (Product)
 * - Tous les produits CJ Store (CJProductStore)
 * - Les relations avec onDelete: Cascade (automatique) :
 *   - ProductVariant
 *   - Image
 *   - CartItem
 *   - Review
 *   - Wishlist
 *   - CJProductMapping
 * - Les OrderItem (supprimés pour éviter les références cassées)
 * - Les CategoryMapping (mappings entre catégories externes et internes)
 * - Les UnmappedExternalCategory (catégories externes non mappées)
 *
 * Optionnel : Suppression des logs de webhooks (pour repartir vraiment de zéro)
 *
 * ⚠️ CONSERVÉ : Les autres données sont conservées (utilisateurs, catégories, fournisseurs, commandes, etc.)
 */
async function cleanAllProducts(cleanWebhooks: boolean = false) {
  console.log('🧹 === NETTOYAGE DE TOUS LES PRODUITS ===\n');

  try {
    // 1️⃣ Compter les produits avant suppression
    const productCount = await prisma.product.count();
    const variantCount = await prisma.productVariant.count();
    const imageCount = await prisma.image.count();
    const cartItemCount = await prisma.cartItem.count();
    const reviewCount = await prisma.review.count();
    const wishlistCount = await prisma.wishlist.count();
    const cjMappingCount = await prisma.cJProductMapping.count();
    const cjStoreCount = await prisma.cJProductStore.count();
    const orderItemCount = await prisma.orderItem.count();
    const categoryMappingCount = await prisma.categoryMapping.count();
    const unmappedCategoryCount = await prisma.unmappedExternalCategory.count();
    const webhookLogCount = await prisma.webhookLog.count();
    const cjWebhookLogCount = await prisma.cJWebhookLog.count();

    console.log('📊 Statistiques AVANT suppression :');
    console.log(`   - Produits (Product): ${productCount}`);
    console.log(`   - Produits CJ Store (CJProductStore): ${cjStoreCount}`);
    console.log(`   - Variantes: ${variantCount}`);
    console.log(`   - Images: ${imageCount}`);
    console.log(`   - Articles panier: ${cartItemCount}`);
    console.log(`   - Avis: ${reviewCount}`);
    console.log(`   - Listes de souhaits: ${wishlistCount}`);
    console.log(`   - Mappings CJ: ${cjMappingCount}`);
    console.log(`   - Mappings catégories (CategoryMapping): ${categoryMappingCount}`);
    console.log(`   - Catégories non mappées (UnmappedExternalCategory): ${unmappedCategoryCount}`);
    console.log(`   - Articles commande: ${orderItemCount}`);
    if (cleanWebhooks) {
      console.log(`   - Logs webhooks: ${webhookLogCount}`);
      console.log(`   - Logs webhooks CJ (ancien): ${cjWebhookLogCount}`);
    }
    console.log('');

    if (productCount === 0 && cjStoreCount === 0 && categoryMappingCount === 0 && unmappedCategoryCount === 0) {
      console.log('✅ Aucun produit à supprimer. La base est déjà vide.\n');

      // Si on nettoie aussi les webhooks
      if (cleanWebhooks) {
        console.log('🗑️  Suppression des logs de webhooks...');
        const deletedWebhooks = await prisma.webhookLog.deleteMany({});
        const deletedCJWebhooks = await prisma.cJWebhookLog.deleteMany({});
        console.log(`   ✅ ${deletedWebhooks.count} logs webhooks supprimés`);
        console.log(`   ✅ ${deletedCJWebhooks.count} logs webhooks CJ (ancien) supprimés\n`);
      }

      return;
    }

    // 2️⃣ Supprimer les OrderItem d'abord (pas de cascade, mais ils deviennent orphelins)
    // Note: On les supprime pour éviter les références cassées, mais on pourrait aussi les garder
    console.log('🗑️  Suppression des articles de commande (pour éviter les références cassées)...');
    const deletedOrderItems = await prisma.orderItem.deleteMany({});
    console.log(`   ✅ ${deletedOrderItems.count} articles de commande supprimés\n`);

    // 3️⃣ Supprimer tous les produits (les relations avec cascade seront supprimées automatiquement)
    console.log('🗑️  Suppression de tous les produits (Product)...');
    const deletedProducts = await prisma.product.deleteMany({});
    console.log(`   ✅ ${deletedProducts.count} produits supprimés\n`);

    // 3️⃣ Supprimer tous les produits CJ Store
    console.log('🗑️  Suppression de tous les produits CJ Store (CJProductStore)...');
    const deletedCJStore = await prisma.cJProductStore.deleteMany({});
    console.log(`   ✅ ${deletedCJStore.count} produits CJ Store supprimés\n`);

    // 4️⃣ Supprimer les mappings de catégories
    console.log('🗑️  Suppression des mappings de catégories (CategoryMapping)...');
    const deletedCategoryMappings = await prisma.categoryMapping.deleteMany({});
    console.log(`   ✅ ${deletedCategoryMappings.count} mappings de catégories supprimés\n`);

    // 5️⃣ Supprimer les catégories externes non mappées
    console.log('🗑️  Suppression des catégories externes non mappées (UnmappedExternalCategory)...');
    const deletedUnmappedCategories = await prisma.unmappedExternalCategory.deleteMany({});
    console.log(`   ✅ ${deletedUnmappedCategories.count} catégories non mappées supprimées\n`);

    // 6️⃣ Optionnel : Supprimer les logs de webhooks si demandé
    if (cleanWebhooks) {
      console.log('🗑️  Suppression des logs de webhooks...');
      const deletedWebhooks = await prisma.webhookLog.deleteMany({});
      const deletedCJWebhooks = await prisma.cJWebhookLog.deleteMany({});
      console.log(`   ✅ ${deletedWebhooks.count} logs webhooks supprimés`);
      console.log(`   ✅ ${deletedCJWebhooks.count} logs webhooks CJ (ancien) supprimés\n`);
    }

    // 7️⃣ Vérifier que tout est bien supprimé
    const remainingProducts = await prisma.product.count();
    const remainingCJStore = await prisma.cJProductStore.count();
    const remainingVariants = await prisma.productVariant.count();
    const remainingImages = await prisma.image.count();
    const remainingCartItems = await prisma.cartItem.count();
    const remainingReviews = await prisma.review.count();
    const remainingWishlists = await prisma.wishlist.count();
    const remainingCJMappings = await prisma.cJProductMapping.count();
    const remainingCategoryMappings = await prisma.categoryMapping.count();
    const remainingUnmappedCategories = await prisma.unmappedExternalCategory.count();
    const remainingWebhooks = cleanWebhooks ? await prisma.webhookLog.count() : webhookLogCount;

    console.log('📊 Statistiques APRÈS suppression :');
    console.log(`   - Produits (Product): ${remainingProducts}`);
    console.log(`   - Produits CJ Store (CJProductStore): ${remainingCJStore}`);
    console.log(`   - Variantes: ${remainingVariants}`);
    console.log(`   - Images: ${remainingImages}`);
    console.log(`   - Articles panier: ${remainingCartItems}`);
    console.log(`   - Avis: ${remainingReviews}`);
    console.log(`   - Listes de souhaits: ${remainingWishlists}`);
    console.log(`   - Mappings CJ: ${remainingCJMappings}`);
    console.log(`   - Mappings catégories (CategoryMapping): ${remainingCategoryMappings}`);
    console.log(`   - Catégories non mappées (UnmappedExternalCategory): ${remainingUnmappedCategories}`);
    if (cleanWebhooks) {
      console.log(`   - Logs webhooks: ${remainingWebhooks}`);
    }
    console.log('');

    if (remainingProducts === 0 && remainingCJStore === 0 && remainingCategoryMappings === 0 && remainingUnmappedCategories === 0) {
      console.log('✅ Nettoyage terminé avec succès ! Tous les produits ont été supprimés.\n');
      if (cleanWebhooks) {
        console.log('✅ Tous les logs de webhooks ont été supprimés.\n');
      }
      console.log('💡 Vous pouvez maintenant réimporter les produits depuis CJ Dropshipping.\n');
    } else {
      console.log('⚠️  Attention : Il reste des produits dans la base de données.\n');
    }

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
// Pour nettoyer aussi les webhooks, passez true en argument : cleanAllProducts(true)
const cleanWebhooks = process.argv.includes('--clean-webhooks') || process.argv.includes('-w');
cleanAllProducts(cleanWebhooks)
  .then(() => {
    console.log('✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });

