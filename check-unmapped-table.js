const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUnmappedTable() {
  try {
    console.log('🔍 Vérification de la table unmappedExternalCategory...\n');
    
    const unmappedCategories = await prisma.unmappedExternalCategory.findMany({
      include: {
        supplier: true
      },
      orderBy: {
        productCount: 'desc'
      }
    });
    
    console.log(`📦 Catégories non mappées trouvées: ${unmappedCategories.length}`);
    
    if (unmappedCategories.length > 0) {
      console.log('\n📋 Détails:');
      unmappedCategories.forEach((category, index) => {
        console.log(`${index + 1}. ${category.externalCategory}`);
        console.log(`   - Produits comptés: ${category.productCount}`);
        console.log(`   - Fournisseur: ${category.supplier?.name}`);
        console.log(`   - Dernière MAJ: ${category.updatedAt}`);
        console.log('   ---');
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUnmappedTable();