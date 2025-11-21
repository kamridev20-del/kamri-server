const { PrismaClient } = require('@prisma/client');

async function checkCategoriesAfterImport() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 === VÉRIFICATION CATÉGORIES APRÈS IMPORT ===\n');
    
    const cjSupplier = await prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' }
    });
    
    // 1. Compter les produits CJ
    const totalProducts = await prisma.product.count({
      where: { supplierId: cjSupplier.id }
    });
    console.log(`📦 Total produits CJ: ${totalProducts}`);
    
    // 2. Vérifier les catégories non mappées
    const unmappedCategories = await prisma.unmappedExternalCategory.findMany({
      where: { supplierId: cjSupplier.id },
      orderBy: { externalCategory: 'asc' }
    });
    
    console.log(`\n🏷️ Catégories non mappées créées: ${unmappedCategories.length}`);
    unmappedCategories.forEach(cat => {
      console.log(`   - "${cat.externalCategory}" | ${cat.productCount} produits`);
    });
    
    // 3. Vérifier les produits sans catégorie
    const productsWithoutCategory = await prisma.product.count({
      where: { 
        supplierId: cjSupplier.id,
        categoryId: null
      }
    });
    console.log(`\n❌ Produits sans catégorie: ${productsWithoutCategory}`);
    
    // 4. Vérifier les produits avec catégorie
    const productsWithCategory = await prisma.product.count({
      where: { 
        supplierId: cjSupplier.id,
        categoryId: { not: null }
      }
    });
    console.log(`✅ Produits avec catégorie: ${productsWithCategory}`);
    
    // 5. Détail de quelques produits
    const sampleProducts = await prisma.product.findMany({
      where: { supplierId: cjSupplier.id },
      select: {
        name: true,
        externalCategory: true,
        categoryId: true,
        category: { select: { name: true } }
      },
      take: 3
    });
    
    console.log(`\n📋 Échantillon de produits:`);
    sampleProducts.forEach(p => {
      console.log(`   - ${p.name.substring(0, 40)}...`);
      console.log(`     Catégorie externe: "${p.externalCategory}"`);
      console.log(`     Catégorie interne: ${p.category?.name || 'NON MAPPÉE'} (ID: ${p.categoryId || 'NULL'})`);
      console.log('');
    });
    
    if (unmappedCategories.length > 0) {
      console.log('🎉 SUCCESS ! Les catégories externes sont maintenant visibles dans la page Catégories pour le mapping !');
    } else {
      console.log('❌ PROBLÈME : Aucune catégorie externe créée. Vérifiez les logs du serveur.');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCategoriesAfterImport();