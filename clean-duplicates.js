const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDuplicateProducts() {
  try {
    console.log('🧹 Nettoyage des produits en double...\n');
    
    // 1. Récupérer tous les produits pending
    const allPendingProducts = await prisma.product.findMany({
      where: { status: 'pending' },
      include: {
        supplier: true,
        cjMapping: true
      },
      orderBy: { createdAt: 'asc' } // Le plus ancien en premier
    });
    
    console.log(`📦 Total produits pending trouvés: ${allPendingProducts.length}`);
    
    // 2. Grouper par nom + fournisseur + prix pour identifier les doublons
    const productGroups = {};
    
    allPendingProducts.forEach(product => {
      const key = `${product.name}_${product.supplierId}_${product.price}`;
      if (!productGroups[key]) {
        productGroups[key] = [];
      }
      productGroups[key].push(product);
    });
    
    // 3. Identifier et supprimer les doublons (garder le premier, supprimer les autres)
    let totalDeleted = 0;
    
    for (const [key, products] of Object.entries(productGroups)) {
      if (products.length > 1) {
        console.log(`\n📋 Groupe "${products[0].name.substring(0, 50)}..."`);
        console.log(`   - Trouvé ${products.length} doublons`);
        
        // Garder le premier (plus ancien), supprimer les autres
        const toKeep = products[0];
        const toDelete = products.slice(1);
        
        console.log(`   - Garder: ID ${toKeep.id} (créé ${toKeep.createdAt})`);
        console.log(`   - Supprimer: ${toDelete.length} doublons`);
        
        // Supprimer les mappings CJ des doublons d'abord
        for (const product of toDelete) {
          if (product.cjMapping) {
            await prisma.cJProductMapping.delete({
              where: { id: product.cjMapping.id }
            });
          }
        }
        
        // Supprimer les produits en double
        const deletedIds = toDelete.map(p => p.id);
        const deleted = await prisma.product.deleteMany({
          where: {
            id: { in: deletedIds }
          }
        });
        
        totalDeleted += deleted.count;
        console.log(`   ✅ ${deleted.count} doublons supprimés`);
      }
    }
    
    console.log(`\n🎉 Nettoyage terminé !`);
    console.log(`📊 Résumé:`);
    console.log(`   - Produits analysés: ${allPendingProducts.length}`);
    console.log(`   - Doublons supprimés: ${totalDeleted}`);
    console.log(`   - Produits uniques restants: ${allPendingProducts.length - totalDeleted}`);
    
    // 4. Remettre les produits CJ en statut 'available' pour pouvoir les réimporter proprement
    console.log(`\n🔄 Remise en statut 'available' des produits CJ...`);
    const updated = await prisma.cJProductStore.updateMany({
      where: { status: 'imported' },
      data: { status: 'available' }
    });
    console.log(`✅ ${updated.count} produits CJ remis en statut 'available'`);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicateProducts();