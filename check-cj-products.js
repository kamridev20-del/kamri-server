const { PrismaClient } = require('@prisma/client');

async function checkCJProducts() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Vérification des produits CJ dans la base de données...\n');
    
    // Vérifier les produits du magasin CJ
    const cjStoreProducts = await prisma.cJProductStore.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📦 Total produits dans le magasin CJ: ${cjStoreProducts.length}`);
    
    if (cjStoreProducts.length > 0) {
      console.log('\n📋 Liste des produits CJ:');
      cjStoreProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}`);
        console.log(`   - SKU: ${product.sku}`);
        console.log(`   - PID: ${product.pid}`);
        console.log(`   - Prix: $${product.price}`);
        console.log(`   - Status: ${product.status}`);
        console.log(`   - Créé: ${product.createdAt}`);
        console.log(`   - Mis à jour: ${product.updatedAt}`);
        console.log('   ---');
      });
    }
    
    // Vérifier les produits favoris CJ
    const cjFavorites = await prisma.cJFavorite.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n⭐ Total favoris CJ: ${cjFavorites.length}`);
    
    if (cjFavorites.length > 0) {
      console.log('\n📋 Liste des favoris CJ:');
      cjFavorites.forEach((favorite, index) => {
        console.log(`${index + 1}. ${favorite.productName}`);
        console.log(`   - PID: ${favorite.pid}`);
        console.log(`   - Prix: $${favorite.price}`);
        console.log(`   - Status: ${favorite.status}`);
        console.log(`   - Créé: ${favorite.createdAt}`);
        console.log('   ---');
      });
    }
    
    // Vérifier s'il y a des doublons par PID
    const pids = cjStoreProducts.map(p => p.pid);
    const duplicatePids = pids.filter((pid, index) => pids.indexOf(pid) !== index);
    
    if (duplicatePids.length > 0) {
      console.log(`\n⚠️  PIDs dupliqués trouvés: ${duplicatePids.join(', ')}`);
    }
    
    // Vérifier s'il y a des doublons par SKU
    const skus = cjStoreProducts.map(p => p.sku);
    const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index);
    
    if (duplicateSkus.length > 0) {
      console.log(`\n⚠️  SKUs dupliqués trouvés: ${duplicateSkus.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCJProducts();