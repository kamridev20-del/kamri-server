/**
 * Script pour vider toutes les commandes
 * 
 * ⚠️ ATTENTION : Ce script supprime TOUTES les données liées aux commandes :
 * - Commandes (Orders)
 * - Articles de commande (OrderItem)
 * - Mappings de commandes CJ (CJOrderMapping)
 * 
 * ✅ CONSERVÉ :
 * - Utilisateurs (Users)
 * - Adresses (Addresses)
 * - Produits (Products)
 * - Toutes les autres données
 * 
 * Usage: npx ts-node src/scripts/clear-all-orders.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllOrders() {
  console.log('🚀 Début du nettoyage de toutes les commandes...\n');

  try {
    // ⚠️ ORDRE IMPORTANT : Supprimer dans l'ordre pour respecter les contraintes de clés étrangères

    // 1. Supprimer les mappings de commandes CJ (CJOrderMapping)
    console.log('🔗 Suppression des mappings de commandes CJ (CJOrderMapping)...');
    const deletedCJOrderMappings = await prisma.cJOrderMapping.deleteMany({});
    console.log(`   ✅ ${deletedCJOrderMappings.count} mappings de commandes CJ supprimés`);

    // 2. Supprimer les articles de commande (OrderItem)
    console.log('📦 Suppression des articles de commande (OrderItem)...');
    const deletedOrderItems = await prisma.orderItem.deleteMany({});
    console.log(`   ✅ ${deletedOrderItems.count} articles de commande supprimés`);

    // 3. Supprimer les commandes (Order)
    console.log('🛒 Suppression des commandes (Order)...');
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`   ✅ ${deletedOrders.count} commandes supprimées`);

    console.log('\n✨ Nettoyage terminé avec succès !');
    console.log('\n📊 Résumé :');
    console.log(`   - Commandes supprimées : ${deletedOrders.count}`);
    console.log(`   - Articles de commande supprimés : ${deletedOrderItems.count}`);
    console.log(`   - Mappings de commandes CJ supprimés : ${deletedCJOrderMappings.count}`);

    console.log('\n✅ Toutes les commandes ont été supprimées.');
    console.log('💡 Les utilisateurs (Users) et adresses (Addresses) ont été CONSERVÉS.');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage :', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
clearAllOrders()
  .then(() => {
    console.log('\n🎉 Script terminé avec succès !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale :', error);
    process.exit(1);
  });

