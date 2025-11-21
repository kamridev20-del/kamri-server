const { PrismaClient } = require('@prisma/client');

async function checkCategoryMapping() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 === VÉRIFICATION MAPPING CATÉGORIES ===\n');
    
    // 1. Vérifier le fournisseur CJ
    const cjSupplier = await prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' }
    });
    console.log('🏢 Fournisseur CJ Dropshipping:', cjSupplier ? `ID: ${cjSupplier.id}` : 'NON TROUVÉ');
    
    // 2. Vérifier les produits CJ dans le magasin
    const cjStoreProducts = await prisma.cJProductStore.findMany({
      select: { id: true, name: true, category: true, status: true }
    });
    console.log(`\n📦 Produits dans CJProductStore: ${cjStoreProducts.length}`);
    cjStoreProducts.slice(0, 3).forEach(p => {
      console.log(`   - ${p.name} | Catégorie: "${p.category}" | Status: ${p.status}`);
    });
    
    // 3. Vérifier les produits CJ importés dans Product
    const cjProducts = await prisma.product.findMany({
      where: cjSupplier ? { supplierId: cjSupplier.id } : { supplierId: 'cj-dropshipping' },
      select: { id: true, name: true, categoryId: true, source: true },
      take: 5
    });
    console.log(`\n🛍️ Produits CJ importés dans Product: ${cjProducts.length}`);
    cjProducts.forEach(p => {
      console.log(`   - ${p.name} | Catégorie ID: ${p.categoryId || 'NULL'} | Source: ${p.source}`);
    });
    
    // 4. Vérifier les catégories non mappées
    const unmappedCategories = await prisma.unmappedExternalCategory.findMany({
      where: cjSupplier ? { supplierId: cjSupplier.id } : { supplierId: 'cj-dropshipping' }
    });
    console.log(`\n🏷️ Catégories non mappées pour CJ: ${unmappedCategories.length}`);
    unmappedCategories.forEach(cat => {
      console.log(`   - "${cat.externalCategory}" | Produits: ${cat.productCount} | Supplier ID: ${cat.supplierId}`);
    });
    
    // 5. Vérifier TOUTES les catégories non mappées (au cas où il y aurait un problème d'ID)
    const allUnmappedCategories = await prisma.unmappedExternalCategory.findMany();
    console.log(`\n📋 TOUTES les catégories non mappées: ${allUnmappedCategories.length}`);
    allUnmappedCategories.forEach(cat => {
      console.log(`   - "${cat.externalCategory}" | Produits: ${cat.productCount} | Supplier ID: ${cat.supplierId}`);
    });
    
    // 6. Vérifier les mappings existants
    const existingMappings = await prisma.categoryMapping.findMany({
      where: cjSupplier ? { supplierId: cjSupplier.id } : { supplierId: 'cj-dropshipping' }
    });
    console.log(`\n🔗 Mappings existants pour CJ: ${existingMappings.length}`);
    existingMappings.forEach(mapping => {
      console.log(`   - "${mapping.externalCategory}" -> "${mapping.internalCategory}"`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCategoryMapping();