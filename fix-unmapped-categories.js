const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixUnmappedCategories() {
  console.log('🔧 Correction des compteurs de catégories non mappées...\n');

  try {
    // 1. Récupérer toutes les entrées de unmappedExternalCategory
    const unmappedCategories = await prisma.unmappedExternalCategory.findMany();
    
    console.log(`📋 ${unmappedCategories.length} catégories non mappées trouvées\n`);

    for (const category of unmappedCategories) {
      console.log(`🔍 Vérification: ${category.externalCategory}`);
      console.log(`   Compteur actuel: ${category.productCount}`);
      
      // 2. Récupérer le nom du fournisseur
      const supplier = await prisma.supplier.findUnique({
        where: { id: category.supplierId }
      });
      
      // 3. Compter les vrais produits avec cette catégorie externe
      const actualCount = await prisma.product.count({
        where: {
          externalCategory: category.externalCategory,
          supplierId: category.supplierId
        }
      });
      
      console.log(`   Compteur réel: ${actualCount}`);
      console.log(`   Fournisseur: ${supplier?.name || 'Non trouvé'}`);
      
      if (actualCount !== category.productCount) {
        if (actualCount === 0) {
          // Supprimer l'entrée si plus aucun produit
          await prisma.unmappedExternalCategory.delete({
            where: {
              id: category.id
            }
          });
          console.log(`   ❌ Entrée supprimée (plus de produits)`);
        } else {
          // Mettre à jour le compteur
          await prisma.unmappedExternalCategory.update({
            where: {
              id: category.id
            },
            data: {
              productCount: actualCount
            }
          });
          console.log(`   ✅ Compteur mis à jour: ${category.productCount} → ${actualCount}`);
        }
      } else {
        console.log(`   ✓ Compteur déjà correct`);
      }
      console.log('');
    }

    // 3. Vérifier s'il y a des produits avec catégories externes qui ne sont pas dans unmappedExternalCategory
    const productsWithExternalCategories = await prisma.product.findMany({
      where: {
        externalCategory: {
          not: null
        },
        categoryId: null // Non mappés
      },
      select: {
        externalCategory: true,
        supplierId: true
      }
    });

    // Grouper par catégorie + fournisseur
    const categoryGroups = {};
    productsWithExternalCategories.forEach(product => {
      const key = `${product.externalCategory}|${product.supplierId}`;
      if (!categoryGroups[key]) {
        categoryGroups[key] = {
          externalCategory: product.externalCategory,
          supplierId: product.supplierId,
          count: 0
        };
      }
      categoryGroups[key].count++;
    });

    // 4. Créer les entrées manquantes
    for (const key in categoryGroups) {
      const group = categoryGroups[key];
      
      const existing = await prisma.unmappedExternalCategory.findFirst({
        where: {
          externalCategory: group.externalCategory,
          supplierId: group.supplierId
        }
      });

      if (!existing) {
        await prisma.unmappedExternalCategory.create({
          data: {
            externalCategory: group.externalCategory,
            supplierId: group.supplierId,
            productCount: group.count
          }
        });
        console.log(`➕ Nouvelle entrée créée: ${group.externalCategory} (${group.count} produits)`);
      }
    }

    // 5. Vérification finale
    console.log('\n📊 État final:');
    const finalCategories = await prisma.unmappedExternalCategory.findMany({
      orderBy: {
        productCount: 'desc'
      }
    });

    finalCategories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.externalCategory}`);
      console.log(`   - Produits: ${cat.productCount}`);
      console.log(`   - Fournisseur ID: ${cat.supplierId}`);
      console.log(`   - Détecté: ${cat.detectedAt}`);
      console.log('');
    });

    console.log('✅ Synchronisation terminée !');

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUnmappedCategories();