const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProducts() {
  try {
    console.log('🔍 Vérification des produits dans la base de données...');
    
    // Vérifier la table CJProductStore
    const products = await prisma.cJProductStore.findMany();
    console.log(`📦 ${products.length} produits trouvés dans CJProductStore`);
    
    if (products.length > 0) {
      console.log('📋 Premiers produits:');
      products.slice(0, 3).forEach((product, index) => {
        console.log(`${index + 1}. ${product.name} (${product.cjProductId})`);
      });
    }
    
    // Vérifier la structure de la table
    const tableInfo = await prisma.$queryRaw`PRAGMA table_info(CJProductStore)`;
    console.log('🔍 Structure de la table:');
    console.log(tableInfo);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProducts();
