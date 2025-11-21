const { PrismaClient } = require('@prisma/client');

async function resetAndTestCategoriesMapping() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 === RESET ET TEST MAPPING CATÉGORIES ===\n');
    
    const cjSupplier = await prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' }
    });
    
    // 1. Supprimer les catégories non mappées existantes
    const deletedCategories = await prisma.unmappedExternalCategory.deleteMany({
      where: { supplierId: cjSupplier.id }
    });
    console.log(`🗑️ ${deletedCategories.count} catégories non mappées supprimées`);
    
    // 2. Remettre les produits du magasin en available
    const resetStore = await prisma.cJProductStore.updateMany({
      where: { status: 'imported' },
      data: { status: 'available' }
    });
    console.log(`🔄 ${resetStore.count} produits remis en 'available'`);
    
    // 3. Vérifier l'état avant nouvel import
    const storeProducts = await prisma.cJProductStore.findMany({
      where: { status: 'available' },
      select: { name: true, category: true }
    });
    
    console.log(`\n📦 Produits prêts pour re-import: ${storeProducts.length}`);
    
    // 4. Lister toutes les catégories uniques
    const uniqueCategories = [...new Set(storeProducts.map(p => p.category).filter(Boolean))];
    console.log(`\n🏷️ Catégories uniques à mapper: ${uniqueCategories.length}`);
    uniqueCategories.forEach(cat => {
      console.log(`   - "${cat}"`);
    });
    
    console.log('\n✅ État reseté ! Maintenant :');
    console.log('1. Allez sur la page fournisseurs');
    console.log('2. Cliquez "Importer" pour CJ');
    console.log('3. Vérifiez la page Catégories pour voir les catégories externes');
    console.log('4. Puis exécutez: node check-categories-after-import.js');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAndTestCategoriesMapping();