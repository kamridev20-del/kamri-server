const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearCJProducts() {
  try {
    console.log('🗑️ Nettoyage des produits CJ Dropshipping...');
    
    // 1. Vider les produits du magasin CJ
    console.log('📦 Suppression des produits du magasin CJ...');
    const cjProducts = await prisma.cJProductStore.deleteMany();
    console.log(`✅ ${cjProducts.count} produits du magasin CJ supprimés`);
    
    // 2. Vider les favoris CJ (si la table existe)
    let cjFavorites = { count: 0 };
    try {
      console.log('⭐ Suppression des favoris CJ...');
      cjFavorites = await prisma.cJFavorite.deleteMany();
      console.log(`✅ ${cjFavorites.count} favoris CJ supprimés`);
    } catch (error) {
      console.log('ℹ️  Table CJFavorite non trouvée, ignorée');
    }
    
    // 3. Vider les mappings CJ (si la table existe)
    let cjMappings = { count: 0 };
    try {
      console.log('🔗 Suppression des mappings CJ...');
      cjMappings = await prisma.cJProductMapping.deleteMany();
      console.log(`✅ ${cjMappings.count} mappings CJ supprimés`);
    } catch (error) {
      console.log('ℹ️  Table CJProductMapping non trouvée, ignorée');
    }
    
    // 4. Vider les logs de webhooks CJ (si la table existe)
    let webhookLogs = { count: 0 };
    try {
      console.log('📝 Suppression des logs de webhooks CJ...');
      webhookLogs = await prisma.cJWebhookLog.deleteMany();
      console.log(`✅ ${webhookLogs.count} logs de webhooks supprimés`);
    } catch (error) {
      console.log('ℹ️  Table CJWebhookLog non trouvée, ignorée');
    }
    
    console.log('\n🎉 Nettoyage CJ terminé avec succès !');
    console.log('📊 Résumé des suppressions :');
    console.log(`   - Produits magasin CJ: ${cjProducts.count}`);
    console.log(`   - Favoris CJ: ${cjFavorites.count}`);
    console.log(`   - Mappings CJ: ${cjMappings.count}`);
    console.log(`   - Logs webhooks: ${webhookLogs.count}`);
    
    console.log('\n💡 Vous pouvez maintenant synchroniser vos favoris depuis votre compte CJ !');
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearCJProducts();