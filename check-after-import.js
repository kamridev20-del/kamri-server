const { PrismaClient } = require('@prisma/client');

async function checkAfterImport() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 === VÉRIFICATION APRÈS IMPORT ===\n');
    
    const cjSupplier = await prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' }
    });
    
    // 1. Compter les produits après import
    const productsAfter = await prisma.product.count({
      where: { supplierId: cjSupplier.id }
    });
    console.log(`📊 Produits CJ dans Product après import: ${productsAfter}`);
    
    // 2. Vérifier les produits avec et sans catégorie
    const productsWithCategory = await prisma.product.count({
      where: { 
        supplierId: cjSupplier.id,
        categoryId: { not: null }
      }
    });
    
    const productsWithoutCategory = await prisma.product.count({
      where: { 
        supplierId: cjSupplier.id,
        categoryId: null
      }
    });
    
    console.log(`✅ Produits AVEC catégorie: ${productsWithCategory}`);
    console.log(`❌ Produits SANS catégorie: ${productsWithoutCategory}`);
    
    // 3. Détails des produits récemment importés
    const recentProducts = await prisma.product.findMany({
      where: { supplierId: cjSupplier.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        categoryId: true,
        category: { select: { name: true } },
        createdAt: true
      }
    });
    
    console.log(`\n📦 5 produits les plus récents:`);
    recentProducts.forEach(p => {
      console.log(`   - ${p.name.substring(0, 50)}...`);
      console.log(`     Catégorie: ${p.category?.name || 'NON MAPPÉE'} (ID: ${p.categoryId || 'NULL'})`);
      console.log(`     Créé: ${p.createdAt.toISOString()}`);
      console.log('');
    });
    
    // 4. État du magasin CJ
    const storeStatus = await prisma.cJProductStore.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    console.log(`\n🏪 État du magasin CJ:`);
    storeStatus.forEach(s => {
      console.log(`   - ${s.status}: ${s._count.status} produits`);
    });
    
    // 5. Catégories non mappées mises à jour
    const unmappedCategories = await prisma.unmappedExternalCategory.findMany({
      where: { supplierId: cjSupplier.id }
    });
    
    console.log(`\n🏷️ Catégories non mappées: ${unmappedCategories.length}`);
    unmappedCategories.forEach(cat => {
      console.log(`   - "${cat.externalCategory}" | ${cat.productCount} produits`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAfterImport();