const { PrismaClient } = require('@prisma/client');

async function resetAndTestImport() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 === RESET ET TEST IMPORT CJ ===\n');
    
    const cjSupplier = await prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' }
    });
    
    // 1. Supprimer les produits CJ existants (pour test propre)
    const deletedProducts = await prisma.product.deleteMany({
      where: { supplierId: cjSupplier.id }
    });
    console.log(`🗑️ ${deletedProducts.count} produits CJ supprimés`);
    
    // 2. Reset du magasin CJ - remettre tous en available
    const resetStore = await prisma.cJProductStore.updateMany({
      where: {},
      data: { status: 'available' }
    });
    console.log(`🔄 ${resetStore.count} produits remis en statut 'available'`);
    
    // 3. Reset des catégories non mappées
    const deletedCategories = await prisma.unmappedExternalCategory.deleteMany({
      where: { supplierId: cjSupplier.id }
    });
    console.log(`🗑️ ${deletedCategories.count} catégories non mappées supprimées`);
    
    // 4. Vérifier l'état initial
    const storeProducts = await prisma.cJProductStore.findMany({
      where: { status: 'available' },
      select: { name: true, category: true }
    });
    
    console.log(`\n📦 Produits prêts pour import: ${storeProducts.length}`);
    storeProducts.forEach(p => {
      console.log(`   - ${p.name} | Catégorie: "${p.category}"`);
    });
    
    console.log('\n✅ État reseté ! Maintenant testez l\'import depuis la page fournisseurs.');
    console.log('Puis exécutez: node check-after-import.js');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAndTestImport();