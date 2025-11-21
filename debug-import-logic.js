const { PrismaClient } = require('@prisma/client');

async function debugImportLogic() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 === DEBUG LOGIQUE IMPORT ===\n');
    
    const cjSupplier = await prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' }
    });
    
    // 1. Vérifier les produits disponibles dans le magasin
    const availableProducts = await prisma.cJProductStore.findMany({
      where: { status: 'available' },
      select: { id: true, name: true, price: true, category: true }
    });
    
    console.log(`📦 Produits DISPONIBLES dans le magasin: ${availableProducts.length}`);
    availableProducts.forEach(p => {
      console.log(`   - ${p.name} | Prix: ${p.price} | Catégorie: "${p.category}"`);
    });
    
    // 2. Vérifier les produits déjà importés 
    const existingProducts = await prisma.product.findMany({
      where: { supplierId: cjSupplier.id },
      select: { id: true, name: true, price: true, source: true, createdAt: true }
    });
    
    console.log(`\n🛍️ Produits DÉJÀ IMPORTÉS: ${existingProducts.length}`);
    existingProducts.forEach(p => {
      console.log(`   - ${p.name} | Prix: ${p.price} | Source: ${p.source} | Créé: ${p.createdAt.toISOString()}`);
    });
    
    // 3. Simuler la vérification de doublons pour chaque produit disponible
    console.log(`\n🔍 SIMULATION VÉRIFICATION DOUBLONS:`);
    for (const storeProduct of availableProducts) {
      const duplicate = await prisma.product.findFirst({
        where: {
          name: storeProduct.name,
          supplierId: cjSupplier.id,
          price: storeProduct.price
        },
        select: { id: true, name: true, price: true }
      });
      
      if (duplicate) {
        console.log(`   ❌ DOUBLON DÉTECTÉ: "${storeProduct.name}" (Prix: ${storeProduct.price})`);
        console.log(`      Produit existant ID: ${duplicate.id}`);
      } else {
        console.log(`   ✅ NOUVEAU PRODUIT: "${storeProduct.name}" (Prix: ${storeProduct.price})`);
      }
    }
    
    // 4. Vérifier tous les statuts du magasin
    const allStoreProducts = await prisma.cJProductStore.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    console.log(`\n📊 STATUTS DU MAGASIN CJ:`);
    allStoreProducts.forEach(s => {
      console.log(`   - ${s.status}: ${s._count.status} produits`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugImportLogic();