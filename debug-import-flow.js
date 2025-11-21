const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugImportFlow() {
  try {
    console.log('🔍 Debug du flux d\'importation...\n');
    
    // 1. Vérifier les produits CJ disponibles
    const availableProducts = await prisma.cJProductStore.findMany({
      where: { status: 'available' }
    });
    console.log(`📦 Produits CJ disponibles: ${availableProducts.length}`);
    
    // 2. Vérifier les produits CJ importés
    const importedProducts = await prisma.cJProductStore.findMany({
      where: { status: 'imported' }
    });
    console.log(`✅ Produits CJ importés: ${importedProducts.length}`);
    
    // 3. Vérifier les produits KAMRI en status pending
    const pendingProducts = await prisma.product.findMany({
      where: { status: 'pending' },
      include: {
        supplier: true,
        category: true,
        cjMapping: true
      }
    });
    console.log(`⏳ Produits KAMRI en attente (pending): ${pendingProducts.length}`);
    
    if (pendingProducts.length > 0) {
      console.log('\n📋 Détails des produits pending:');
      pendingProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}`);
        console.log(`   - Status: ${product.status}`);
        console.log(`   - Fournisseur: ${product.supplier?.name}`);
        console.log(`   - Catégorie: ${product.category?.name || 'Non assignée'}`);
        console.log(`   - Prix: $${product.price}`);
        console.log(`   - Créé: ${product.createdAt}`);
        console.log(`   - Mapping CJ: ${product.cjMapping ? 'Oui' : 'Non'}`);
        console.log('   ---');
      });
    }
    
    // 4. Vérifier les produits KAMRI avec d'autres statuts
    const otherProducts = await prisma.product.findMany({
      where: { 
        status: { not: 'pending' }
      },
      include: {
        supplier: true
      }
    });
    console.log(`\n📦 Autres produits KAMRI: ${otherProducts.length}`);
    
    if (otherProducts.length > 0) {
      const statusCounts = {};
      otherProducts.forEach(product => {
        statusCounts[product.status] = (statusCounts[product.status] || 0) + 1;
      });
      console.log('📊 Répartition par status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}`);
      });
    }
    
    // 5. Compter le total pour vérification
    const totalProducts = await prisma.product.count();
    console.log(`\n📈 Total produits KAMRI: ${totalProducts}`);
    
  } catch (error) {
    console.error('❌ Erreur lors du debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugImportFlow();