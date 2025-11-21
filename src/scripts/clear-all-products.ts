/**
 * Script pour vider toutes les tables liées aux produits
 * 
 * ⚠️ ATTENTION : Ce script supprime TOUTES les données liées aux produits :
 * - Produits
 * - Variants de produits
 * - Images
 * - Mappings CJ
 * - Mappings de catégories
 * - Catégories non mappées
 * - Produits CJ en store
 * - Articles du panier
 * - Articles de commande
 * - Avis
 * - Liste de souhaits
 * 
 * Les commandes (Orders) et utilisateurs (Users) sont CONSERVÉS.
 * 
 * Usage: npx ts-node src/scripts/clear-all-products.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllProducts() {
  console.log('🚀 Début du nettoyage de toutes les tables liées aux produits...\n');

  try {
    // ⚠️ ORDRE IMPORTANT : Supprimer dans l'ordre pour respecter les contraintes de clés étrangères

    // 1. Supprimer les articles de commande (OrderItem)
    console.log('📦 Suppression des articles de commande (OrderItem)...');
    const deletedOrderItems = await prisma.orderItem.deleteMany({});
    console.log(`   ✅ ${deletedOrderItems.count} articles de commande supprimés`);

    // 2. Supprimer les articles du panier (CartItem)
    console.log('🛒 Suppression des articles du panier (CartItem)...');
    const deletedCartItems = await prisma.cartItem.deleteMany({});
    console.log(`   ✅ ${deletedCartItems.count} articles du panier supprimés`);

    // 3. Supprimer les avis (Review)
    console.log('⭐ Suppression des avis (Review)...');
    const deletedReviews = await prisma.review.deleteMany({});
    console.log(`   ✅ ${deletedReviews.count} avis supprimés`);

    // 4. Supprimer la liste de souhaits (Wishlist)
    console.log('❤️  Suppression de la liste de souhaits (Wishlist)...');
    const deletedWishlist = await prisma.wishlist.deleteMany({});
    console.log(`   ✅ ${deletedWishlist.count} éléments de liste de souhaits supprimés`);

    // 5. Supprimer les images (Image)
    console.log('🖼️  Suppression des images (Image)...');
    const deletedImages = await prisma.image.deleteMany({});
    console.log(`   ✅ ${deletedImages.count} images supprimées`);

    // 6. Supprimer les variants de produits (ProductVariant)
    console.log('🔀 Suppression des variants de produits (ProductVariant)...');
    const deletedVariants = await prisma.productVariant.deleteMany({});
    console.log(`   ✅ ${deletedVariants.count} variants supprimés`);

    // 7. Supprimer les mappings CJ (CJProductMapping)
    console.log('🔗 Suppression des mappings CJ (CJProductMapping)...');
    const deletedCJMappings = await prisma.cJProductMapping.deleteMany({});
    console.log(`   ✅ ${deletedCJMappings.count} mappings CJ supprimés`);

    // 8. Supprimer les produits (Product)
    console.log('📦 Suppression des produits (Product)...');
    const deletedProducts = await prisma.product.deleteMany({});
    console.log(`   ✅ ${deletedProducts.count} produits supprimés`);

    // 9. Supprimer les mappings de catégories (CategoryMapping)
    console.log('🗂️  Suppression des mappings de catégories (CategoryMapping)...');
    const deletedCategoryMappings = await prisma.categoryMapping.deleteMany({});
    console.log(`   ✅ ${deletedCategoryMappings.count} mappings de catégories supprimés`);

    // 10. Supprimer les catégories non mappées (UnmappedExternalCategory)
    console.log('❓ Suppression des catégories non mappées (UnmappedExternalCategory)...');
    const deletedUnmapped = await prisma.unmappedExternalCategory.deleteMany({});
    console.log(`   ✅ ${deletedUnmapped.count} catégories non mappées supprimées`);

    // 11. Supprimer les produits CJ en store (CJProductStore)
    console.log('🏪 Suppression des produits CJ en store (CJProductStore)...');
    const deletedCJStore = await prisma.cJProductStore.deleteMany({});
    console.log(`   ✅ ${deletedCJStore.count} produits CJ en store supprimés`);

    // 12. Supprimer les notifications de mise à jour de produits (ProductUpdateNotification)
    console.log('🔔 Suppression des notifications de mise à jour (ProductUpdateNotification)...');
    const deletedNotifications = await prisma.productUpdateNotification.deleteMany({});
    console.log(`   ✅ ${deletedNotifications.count} notifications supprimées`);

    console.log('\n✨ Nettoyage terminé avec succès !');
    console.log('\n📊 Résumé :');
    console.log(`   - Produits supprimés : ${deletedProducts.count}`);
    console.log(`   - Variants supprimés : ${deletedVariants.count}`);
    console.log(`   - Images supprimées : ${deletedImages.count}`);
    console.log(`   - Mappings CJ supprimés : ${deletedCJMappings.count}`);
    console.log(`   - Mappings de catégories supprimés : ${deletedCategoryMappings.count}`);
    console.log(`   - Catégories non mappées supprimées : ${deletedUnmapped.count}`);
    console.log(`   - Produits CJ en store supprimés : ${deletedCJStore.count}`);
    console.log(`   - Articles de commande supprimés : ${deletedOrderItems.count}`);
    console.log(`   - Articles du panier supprimés : ${deletedCartItems.count}`);
    console.log(`   - Avis supprimés : ${deletedReviews.count}`);
    console.log(`   - Éléments de liste de souhaits supprimés : ${deletedWishlist.count}`);
    console.log(`   - Notifications supprimées : ${deletedNotifications.count}`);

    console.log('\n✅ La base de données est maintenant vide de tous les produits et données associées.');
    console.log('💡 Les commandes (Orders) et utilisateurs (Users) ont été CONSERVÉS.');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage :', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
clearAllProducts()
  .then(() => {
    console.log('\n🎉 Script terminé avec succès !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale :', error);
    process.exit(1);
  });

