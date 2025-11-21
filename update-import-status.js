const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Script pour mettre à jour le statut d'import des produits CJ existants
 * Utilise la solution hybride: les produits restent dans CJProductStore mais avec un statut
 */
async function updateImportStatus() {
  console.log('🔄 === MISE À JOUR DU STATUT D\'IMPORT ===\n');

  try {
    // 1. Récupérer tous les produits CJ du magasin
    const storeProducts = await prisma.cJProductStore.findMany({
      select: {
        id: true,
        cjProductId: true,
        name: true,
        importStatus: true,
        importedProductId: true
      }
    });

    console.log(`📦 ${storeProducts.length} produits dans le magasin CJ\n`);

    let updated = 0;
    let alreadyCorrect = 0;

    for (const storeProduct of storeProducts) {
      // 2. Chercher si ce produit CJ a été importé dans Product
      const importedProduct = await prisma.product.findFirst({
        where: { cjProductId: storeProduct.cjProductId },
        select: { id: true, status: true }
      });

      if (importedProduct) {
        // Produit importé - définir le statut selon le status dans Product
        const newStatus = importedProduct.status === 'active' || importedProduct.status === 'published'
          ? 'imported_published'
          : 'imported_draft';

        if (storeProduct.importStatus !== newStatus || storeProduct.importedProductId !== importedProduct.id) {
          await prisma.cJProductStore.update({
            where: { id: storeProduct.id },
            data: {
              importStatus: newStatus,
              importedProductId: importedProduct.id
            }
          });
          console.log(`✅ ${storeProduct.name.substring(0, 50)}... → ${newStatus}`);
          updated++;
        } else {
          alreadyCorrect++;
        }
      } else {
        // Produit non importé
        if (storeProduct.importStatus !== 'not_imported') {
          await prisma.cJProductStore.update({
            where: { id: storeProduct.id },
            data: {
              importStatus: 'not_imported',
              importedProductId: null
            }
          });
          console.log(`📝 ${storeProduct.name.substring(0, 50)}... → not_imported`);
          updated++;
        } else {
          alreadyCorrect++;
        }
      }
    }

    console.log('\n✨ Terminé!');
    console.log(`   - Mis à jour: ${updated}`);
    console.log(`   - Déjà correct: ${alreadyCorrect}`);
    console.log(`   - Total: ${storeProducts.length}\n`);

    // 3. Afficher un résumé par statut
    const statusCounts = await prisma.cJProductStore.groupBy({
      by: ['importStatus'],
      _count: true
    });

    console.log('📊 Répartition par statut:');
    statusCounts.forEach(({ importStatus, _count }) => {
      console.log(`   - ${importStatus}: ${_count}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateImportStatus();

