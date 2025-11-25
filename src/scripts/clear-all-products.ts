/**
 * Script pour vider TOUS les produits de la base de données
 * 
 * ⚠️ ATTENTION : Ce script supprime TOUTES les données liées aux produits :
 * - Produits (tous statuts : pending, active, inactive, rejected, draft)
 * - Variants de produits
 * - Images
 * - Mappings CJ
 * - Produits CJ en store (CJProductStore)
 * - Articles du panier
 * - Articles de commande
 * - Avis (Reviews)
 * - Liste de souhaits
 * - Notifications de mise à jour
 * - Webhooks logs (CJWebhookLog et WebhookLog)
 * 
 * Les commandes (Orders) et utilisateurs (Users) sont CONSERVÉS.
 * Les catégories (Categories) et fournisseurs (Suppliers) sont CONSERVÉS.
 * 
 * Usage: 
 *   npm run db:clear-products
 * 
 * OU avec DATABASE_URL:
 *   DATABASE_URL="postgresql://..." npm run db:clear-products
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllProducts() {
  console.log('🧹 Début du nettoyage complet de tous les produits...\n');
  console.log('⚠️  ATTENTION : Tous les produits seront supprimés (tous statuts confondus)\n');

  try {
    // ⚠️ ORDRE IMPORTANT : Supprimer dans l'ordre pour respecter les contraintes de clés étrangères

    // 1. Supprimer les articles de commande (OrderItem)
    console.log('📦 Suppression des articles de commande (OrderItem)...');
    const deletedOrderItems = await prisma.orderItem.deleteMany({});
    console.log(`   ✅ ${deletedOrderItems.count} articles de commande supprimés`);

    // 2. Supprimer les mappings de commandes CJ (CJOrderMapping)
    console.log('🔗 Suppression des mappings de commandes CJ (CJOrderMapping)...');
    const deletedCJOrderMappings = await prisma.cJOrderMapping.deleteMany({});
    console.log(`   ✅ ${deletedCJOrderMappings.count} mappings de commandes CJ supprimés`);

    // 3. Supprimer les commandes (Order) - seulement si vous voulez aussi supprimer les commandes
    // Décommenter si vous voulez aussi supprimer les commandes
    // console.log('📋 Suppression des commandes (Order)...');
    // const deletedOrders = await prisma.order.deleteMany({});
    // console.log(`   ✅ ${deletedOrders.count} commandes supprimées`);

    // 4. Supprimer les articles du panier (CartItem)
    console.log('🛒 Suppression des articles du panier (CartItem)...');
    const deletedCartItems = await prisma.cartItem.deleteMany({});
    console.log(`   ✅ ${deletedCartItems.count} articles du panier supprimés`);

    // 5. Supprimer les avis (Review)
    console.log('⭐ Suppression des avis (Review)...');
    const deletedReviews = await prisma.review.deleteMany({});
    console.log(`   ✅ ${deletedReviews.count} avis supprimés`);

    // 6. Supprimer la liste de souhaits (Wishlist)
    console.log('❤️  Suppression de la liste de souhaits (Wishlist)...');
    const deletedWishlist = await prisma.wishlist.deleteMany({});
    console.log(`   ✅ ${deletedWishlist.count} éléments de wishlist supprimés`);

    // 7. Supprimer les notifications de mise à jour de produits (ProductUpdateNotification)
    console.log('🔔 Suppression des notifications de mise à jour (ProductUpdateNotification)...');
    const deletedNotifications = await prisma.productUpdateNotification.deleteMany({});
    console.log(`   ✅ ${deletedNotifications.count} notifications supprimées`);

    // 8. Supprimer les mappings de produits CJ (CJProductMapping)
    console.log('🔗 Suppression des mappings de produits CJ (CJProductMapping)...');
    const deletedCJProductMappings = await prisma.cJProductMapping.deleteMany({});
    console.log(`   ✅ ${deletedCJProductMappings.count} mappings de produits CJ supprimés`);

    // 9. Supprimer les images (Image) - Cascade devrait le faire automatiquement, mais on le fait explicitement
    console.log('🖼️  Suppression des images (Image)...');
    const deletedImages = await prisma.image.deleteMany({});
    console.log(`   ✅ ${deletedImages.count} images supprimées`);

    // 10. Supprimer les variants de produits (ProductVariant) - Cascade devrait le faire automatiquement
    console.log('🔀 Suppression des variants de produits (ProductVariant)...');
    const deletedVariants = await prisma.productVariant.deleteMany({});
    console.log(`   ✅ ${deletedVariants.count} variants supprimés`);

    // 11. Supprimer TOUS les produits (Product) - TOUS LES STATUTS
    console.log('📦 Suppression de TOUS les produits (Product) - tous statuts confondus...');
    const deletedProducts = await prisma.product.deleteMany({});
    console.log(`   ✅ ${deletedProducts.count} produits supprimés (tous statuts)`);

    // 12. Supprimer les produits CJ en store (CJProductStore)
    console.log('🏪 Suppression des produits CJ en store (CJProductStore)...');
    const deletedCJStore = await prisma.cJProductStore.deleteMany({});
    console.log(`   ✅ ${deletedCJStore.count} produits CJ en store supprimés`);

    // 13. Supprimer les logs de webhooks CJ (CJWebhookLog)
    console.log('📡 Suppression des logs de webhooks CJ (CJWebhookLog)...');
    try {
      const deletedCJWebhookLogs = await prisma.cJWebhookLog.deleteMany({});
      console.log(`   ✅ ${deletedCJWebhookLogs.count} logs de webhooks CJ supprimés`);
    } catch (error) {
      console.log('   ⚠️  CJWebhookLog n\'existe pas ou déjà supprimé');
    }

    // 14. Supprimer les logs de webhooks généraux (WebhookLog) - optionnel
    console.log('📡 Suppression des logs de webhooks généraux (WebhookLog)...');
    try {
      const deletedWebhookLogs = await prisma.webhookLog.deleteMany({});
      console.log(`   ✅ ${deletedWebhookLogs.count} logs de webhooks généraux supprimés`);
    } catch (error) {
      console.log('   ⚠️  WebhookLog n\'existe pas ou déjà supprimé');
    }

    console.log('\n✅ Nettoyage terminé avec succès !\n');
    console.log('📊 Résumé :');
    console.log(`   - ${deletedOrderItems.count} articles de commande`);
    console.log(`   - ${deletedCJOrderMappings.count} mappings de commandes CJ`);
    console.log(`   - ${deletedCartItems.count} articles du panier`);
    console.log(`   - ${deletedReviews.count} avis`);
    console.log(`   - ${deletedWishlist.count} éléments de wishlist`);
    console.log(`   - ${deletedNotifications.count} notifications`);
    console.log(`   - ${deletedCJProductMappings.count} mappings de produits CJ`);
    console.log(`   - ${deletedImages.count} images`);
    console.log(`   - ${deletedVariants.count} variants`);
    console.log(`   - ${deletedProducts.count} produits (TOUS STATUTS)`);
    console.log(`   - ${deletedCJStore.count} produits CJ en store`);
    console.log('\n✅ La base de données est maintenant vide de tous les produits !');
    console.log('✅ Les catégories, utilisateurs et fournisseurs sont conservés.\n');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
clearAllProducts()
  .then(() => {
    console.log('🎉 Script terminé avec succès !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
