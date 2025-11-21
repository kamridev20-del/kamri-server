const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function populateUnmappedCategories() {
  try {
    console.log('🔍 Analyse des catégories non mappées...\n');
    
    // 1. Trouver le fournisseur CJ Dropshipping
    let supplier = await prisma.supplier.findFirst({
      where: {
        name: 'CJ Dropshipping'
      }
    });
    
    if (!supplier) {
      console.log('⚠️  Fournisseur CJ Dropshipping non trouvé, création...');
      supplier = await prisma.supplier.create({
        data: {
          name: 'CJ Dropshipping',
          apiUrl: 'https://developers.cjdropshipping.com',
          isActive: true,
          type: 'dropshipping'
        }
      });
      console.log(`✅ Fournisseur CJ créé: ${supplier.id}\n`);
    } else {
      console.log(`✅ Fournisseur CJ trouvé: ${supplier.id}\n`);
    }
    
    // 2. Récupérer tous les produits CJ du magasin
    const cjProducts = await prisma.cJProductStore.findMany({
      select: {
        id: true,
        category: true,
        cjProductId: true,
        name: true
      }
    });
    
    console.log(`📦 ${cjProducts.length} produits CJ dans le magasin\n`);
    
    // 3. Compter les produits par catégorie
    const categoryCounts = {};
    cjProducts.forEach(product => {
      if (product.category) {
        categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
      }
    });
    
    console.log(`🏷️  ${Object.keys(categoryCounts).length} catégories uniques trouvées\n`);
    
    // 4. Récupérer les mappings existants
    const existingMappings = await prisma.categoryMapping.findMany({
      where: {
        supplierId: supplier.id
      }
    });
    
    const mappedCategories = new Set(existingMappings.map(m => m.externalCategory));
    console.log(`🔗 ${mappedCategories.size} catégories déjà mappées\n`);
    
    // 5. Identifier les catégories non mappées
    const unmappedCategories = Object.entries(categoryCounts).filter(
      ([category, count]) => !mappedCategories.has(category)
    );
    
    console.log(`📊 ${unmappedCategories.length} catégories non mappées détectées\n`);
    
    // 6. Créer ou mettre à jour les enregistrements unmappedExternalCategory
    let created = 0;
    let updated = 0;
    
    for (const [category, count] of unmappedCategories) {
      try {
        const existing = await prisma.unmappedExternalCategory.findUnique({
          where: {
            supplierId_externalCategory: {
              supplierId: supplier.id,
              externalCategory: category
            }
          }
        });
        
        if (existing) {
          await prisma.unmappedExternalCategory.update({
            where: { id: existing.id },
            data: {
              productCount: count,
              updatedAt: new Date()
            }
          });
          updated++;
          console.log(`   ✏️  Mis à jour: ${category} (${count} produits)`);
        } else {
          await prisma.unmappedExternalCategory.create({
            data: {
              supplierId: supplier.id,
              externalCategory: category,
              productCount: count
            }
          });
          created++;
          console.log(`   ✅ Créé: ${category} (${count} produits)`);
        }
      } catch (error) {
        console.error(`   ❌ Erreur pour ${category}:`, error.message);
      }
    }
    
    console.log('\n✨ Terminé!');
    console.log(`   - Créées: ${created}`);
    console.log(`   - Mises à jour: ${updated}`);
    console.log(`   - Total: ${created + updated}\n`);
    
    // 7. Afficher un résumé
    const allUnmapped = await prisma.unmappedExternalCategory.findMany({
      where: {
        supplierId: supplier.id
      },
      orderBy: {
        productCount: 'desc'
      }
    });
    
    console.log('📋 Catégories non mappées dans la base:');
    allUnmapped.slice(0, 10).forEach((cat, i) => {
      console.log(`   ${i + 1}. ${cat.externalCategory} (${cat.productCount} produits)`);
    });
    if (allUnmapped.length > 10) {
      console.log(`   ... et ${allUnmapped.length - 10} autres`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateUnmappedCategories();

