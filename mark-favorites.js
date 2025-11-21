const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function markProductsAsFavorites() {
  try {
    console.log('🔄 Marquage des produits comme favoris...');
    
    // Récupérer tous les produits CJ
    const products = await prisma.cJProductStore.findMany();
    console.log(`📦 ${products.length} produits trouvés`);
    
    // Marquer les 10 premiers comme favoris (ou tous si moins de 10)
    const productsToMark = products.slice(0, 10);
    
    for (const product of productsToMark) {
      await prisma.cJProductStore.update({
        where: { id: product.id },
        data: { isFavorite: true }
      });
      console.log(`✅ ${product.name} marqué comme favori`);
    }
    
    console.log(`🎉 ${productsToMark.length} produits marqués comme favoris`);
    
    // Vérifier le résultat
    const favorites = await prisma.cJProductStore.findMany({
      where: { isFavorite: true }
    });
    console.log(`⭐ ${favorites.length} favoris dans la base de données`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

markProductsAsFavorites();
