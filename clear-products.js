const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearAllProducts() {
  try {
    console.log('🗑️ Début du vidage de la base de données...');
    
    // Vider les tables dans l'ordre correct (respecter les contraintes de clés étrangères)
    
    // 1. Vider les mappings CJ
    console.log('📦 Suppression des mappings CJ...');
    const cjMappings = await prisma.cJProductMapping.deleteMany();
    console.log(`✅ ${cjMappings.count} mappings CJ supprimés`);
    
    // 2. Vider les mappings de commandes CJ
    console.log('📦 Suppression des mappings de commandes CJ...');
    const cjOrderMappings = await prisma.cJOrderMapping.deleteMany();
    console.log(`✅ ${cjOrderMappings.count} mappings de commandes CJ supprimés`);
    
    // 3. Vider les logs de webhooks CJ
    console.log('📦 Suppression des logs de webhooks CJ...');
    const webhookLogs = await prisma.cJWebhookLog.deleteMany();
    console.log(`✅ ${webhookLogs.count} logs de webhooks supprimés`);
    
    // 4. Vider le magasin CJ
    console.log('📦 Suppression des produits du magasin CJ...');
    const cjProducts = await prisma.cJProductStore.deleteMany();
    console.log(`✅ ${cjProducts.count} produits du magasin CJ supprimés`);
    
    // 5. Vider les produits KAMRI
    console.log('📦 Suppression des produits KAMRI...');
    const products = await prisma.product.deleteMany();
    console.log(`✅ ${products.count} produits KAMRI supprimés`);
    
    // 6. Vider les variantes de produits
    console.log('📦 Suppression des variantes de produits...');
    const variants = await prisma.productVariant.deleteMany();
    console.log(`✅ ${variants.count} variantes supprimées`);
    
    // 7. Vider les stocks
    console.log('📦 Suppression des stocks...');
    const stocks = await prisma.stock.deleteMany();
    console.log(`✅ ${stocks.count} stocks supprimés`);
    
    // 8. Vider les commandes
    console.log('📦 Suppression des commandes...');
    const orders = await prisma.order.deleteMany();
    console.log(`✅ ${orders.count} commandes supprimées`);
    
    // 9. Vider les paniers
    console.log('📦 Suppression des paniers...');
    const carts = await prisma.cart.deleteMany();
    console.log(`✅ ${carts.count} paniers supprimés`);
    
    // 10. Vider les favoris
    console.log('📦 Suppression des favoris...');
    const wishlist = await prisma.wishlist.deleteMany();
    console.log(`✅ ${wishlist.count} favoris supprimés`);
    
    console.log('🎉 Base de données vidée avec succès !');
    console.log('📊 Résumé des suppressions :');
    console.log(`   - Mappings CJ: ${cjMappings.count}`);
    console.log(`   - Mappings commandes CJ: ${cjOrderMappings.count}`);
    console.log(`   - Logs webhooks: ${webhookLogs.count}`);
    console.log(`   - Produits magasin CJ: ${cjProducts.count}`);
    console.log(`   - Produits KAMRI: ${products.count}`);
    console.log(`   - Variantes: ${variants.count}`);
    console.log(`   - Stocks: ${stocks.count}`);
    console.log(`   - Commandes: ${orders.count}`);
    console.log(`   - Paniers: ${carts.count}`);
    console.log(`   - Favoris: ${wishlist.count}`);
    
  } catch (error) {
    console.error('❌ Erreur lors du vidage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllProducts();
