const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProductCategories() {
  try {
    console.log('🔍 Vérification des catégories des produits...\n');
    
    // 1. Vérifier les produits CJ avec catégories
    const products = await prisma.product.findMany({
      where: {
        source: 'cj-dropshipping'
      },
      select: {
        id: true,
        name: true,
        categoryId: true,
        tags: true,
        category: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log(`📦 Total produits CJ: ${products.length}\n`);
    
    // 2. Compter produits avec/sans catégorie
    const withCategory = products.filter(p => p.categoryId);
    const withoutCategory = products.filter(p => !p.categoryId);
    
    console.log(`✅ Produits avec catégorie: ${withCategory.length}`);
    console.log(`❌ Produits sans catégorie: ${withoutCategory.length}\n`);
    
    // 3. Vérifier les catégories dans les tags
    console.log('🏷️  Analyse des catégories dans les tags:');
    const categoriesFromTags = new Set();
    products.forEach(p => {
      if (p.tags) {
        try {
          const tags = typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags;
          if (Array.isArray(tags) && tags.length > 0) {
            // La première tag est souvent la catégorie CJ
            categoriesFromTags.add(tags[0]);
          }
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      }
    });
    
    console.log(`   Catégories uniques trouvées dans les tags: ${categoriesFromTags.size}`);
    if (categoriesFromTags.size > 0) {
      const categoriesArray = Array.from(categoriesFromTags);
      categoriesArray.slice(0, 10).forEach((cat, i) => {
        console.log(`   ${i + 1}. ${cat}`);
      });
      if (categoriesArray.length > 10) {
        console.log(`   ... et ${categoriesArray.length - 10} autres`);
      }
    }
    
    console.log('\n');
    
    // 4. Vérifier les mappings existants
    const mappings = await prisma.categoryMapping.findMany({
      where: {
        supplier: {
          name: 'CJ Dropshipping'
        }
      },
      include: {
        supplier: true
      }
    });
    
    console.log(`🔗 Mappings existants pour CJ: ${mappings.length}`);
    if (mappings.length > 0) {
      mappings.forEach((mapping, i) => {
        console.log(`   ${i + 1}. ${mapping.externalCategory} → ${mapping.internalCategory}`);
      });
    }
    
    console.log('\n');
    
    // 5. Identifier les catégories non mappées
    const mappedCategories = new Set(mappings.map(m => m.externalCategory));
    const unmappedCategories = Array.from(categoriesFromTags).filter(
      cat => !mappedCategories.has(cat)
    );
    
    console.log(`📊 Catégories non mappées: ${unmappedCategories.length}`);
    if (unmappedCategories.length > 0) {
      unmappedCategories.slice(0, 10).forEach((cat, i) => {
        const productCount = products.filter(p => {
          if (!p.tags) return false;
          try {
            const tags = typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags;
            return Array.isArray(tags) && tags[0] === cat;
          } catch (e) {
            return false;
          }
        }).length;
        console.log(`   ${i + 1}. ${cat} (${productCount} produits)`);
      });
      if (unmappedCategories.length > 10) {
        console.log(`   ... et ${unmappedCategories.length - 10} autres`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductCategories();

