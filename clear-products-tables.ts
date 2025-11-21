import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function clearProductsTables() {
  try {
    console.log('🧹 Début du nettoyage des tables...\n');

    // 1. Supprimer ProductVariant (doit être fait avant Product à cause de la FK)
    console.log('📦 Suppression des ProductVariant...');
    const deletedVariants = await prisma.productVariant.deleteMany({});
    console.log(`✅ ${deletedVariants.count} variant(s) supprimé(s)\n`);

    // 2. Supprimer ProductUpdateNotification (peut avoir une FK optionnelle vers Product)
    console.log('🔔 Suppression des ProductUpdateNotification...');
    const deletedNotifications = await prisma.productUpdateNotification.deleteMany({});
    console.log(`✅ ${deletedNotifications.count} notification(s) supprimée(s)\n`);

    // 3. Supprimer WebhookLog (indépendant)
    console.log('📝 Suppression des WebhookLog...');
    const deletedWebhooks = await prisma.webhookLog.deleteMany({});
    console.log(`✅ ${deletedWebhooks.count} webhook log(s) supprimé(s)\n`);

    // 4. Supprimer les Images liées aux produits (si nécessaire)
    console.log('🖼️  Suppression des Images liées aux produits...');
    const deletedImages = await prisma.image.deleteMany({});
    console.log(`✅ ${deletedImages.count} image(s) supprimée(s)\n`);

    // 5. Supprimer Product (en dernier car d'autres tables peuvent en dépendre)
    // Note: ProductVariant a onDelete: Cascade, donc sera supprimé automatiquement
    // mais on l'a déjà supprimé manuellement pour être sûr
    console.log('🛍️ Suppression des Product...');
    const deletedProducts = await prisma.product.deleteMany({});
    console.log(`✅ ${deletedProducts.count} produit(s) supprimé(s)\n`);

    console.log('✨ Nettoyage terminé avec succès !');
    console.log('\n📊 Résumé:');
    console.log(`   - ProductVariant: ${deletedVariants.count} supprimé(s)`);
    console.log(`   - ProductUpdateNotification: ${deletedNotifications.count} supprimée(s)`);
    console.log(`   - WebhookLog: ${deletedWebhooks.count} supprimé(s)`);
    console.log(`   - Image: ${deletedImages.count} supprimée(s)`);
    console.log(`   - Product: ${deletedProducts.count} supprimé(s)`);

  } catch (error: any) {
    console.error('❌ Erreur lors du nettoyage:', error);
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    if (error.meta) {
      console.error('   Meta:', JSON.stringify(error.meta, null, 2));
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Demander confirmation avant de supprimer
console.log('⚠️  ATTENTION: Ce script va supprimer TOUS les enregistrements des tables suivantes:');
console.log('   - ProductVariant');
console.log('   - ProductUpdateNotification');
console.log('   - WebhookLog');
console.log('   - Product');
console.log('\nCette action est IRRÉVERSIBLE !\n');

// Version avec confirmation (recommandée)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Voulez-vous continuer ? (tapez "OUI" pour confirmer): ', (answer: string) => {
  if (answer.trim().toUpperCase() === 'OUI') {
    rl.close();
    clearProductsTables();
  } else {
    console.log('❌ Opération annulée.');
    rl.close();
    process.exit(0);
  }
});

