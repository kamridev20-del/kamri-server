const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkImportCompleteness() {
  console.log('🔍 Vérification de la complétude des données importées CJ...\n');

  try {
    // 1. Récupérer un produit CJ pour analyser ce qui est sauvegardé
    const cjProduct = await prisma.cJProductStore.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!cjProduct) {
      console.log('❌ Aucun produit CJ trouvé');
      return;
    }

    console.log('📦 Produit CJ analysé:');
    console.log(`   - Nom: ${cjProduct.name}`);
    console.log(`   - CJ Product ID: ${cjProduct.cjProductId}`);
    console.log('');

    // 2. Analyser chaque champ important
    console.log('📊 Analyse des données sauvegardées:');
    
    // Informations de base
    console.log('🏷️ Informations de base:');
    console.log(`   - Nom: ${cjProduct.name ? '✅' : '❌'} ${cjProduct.name || 'Manquant'}`);
    console.log(`   - Description: ${cjProduct.description ? '✅' : '❌'} ${cjProduct.description ? 'Présente' : 'Manquante'}`);
    console.log(`   - Prix: ${cjProduct.price ? '✅' : '❌'} $${cjProduct.price || 'Manquant'}`);
    console.log(`   - Prix original: ${cjProduct.originalPrice ? '✅' : '❌'} $${cjProduct.originalPrice || 'Manquant'}`);
    console.log(`   - Image: ${cjProduct.image ? '✅' : '❌'} ${cjProduct.image ? 'Présente' : 'Manquante'}`);
    console.log(`   - Catégorie: ${cjProduct.category ? '✅' : '❌'} ${cjProduct.category || 'Manquante'}`);
    console.log('');

    // Informations CJ spécifiques
    console.log('🔧 Informations CJ spécifiques:');
    console.log(`   - Product SKU: ${cjProduct.productSku ? '✅' : '❌'} ${cjProduct.productSku || 'Manquant'}`);
    console.log(`   - Product Weight: ${cjProduct.productWeight ? '✅' : '❌'} ${cjProduct.productWeight || 'Manquant'}`);
    console.log(`   - Packing Weight: ${cjProduct.packingWeight ? '✅' : '❌'} ${cjProduct.packingWeight || 'Manquant'}`);
    console.log(`   - Product Type: ${cjProduct.productType ? '✅' : '❌'} ${cjProduct.productType || 'Manquant'}`);
    console.log(`   - Product Unit: ${cjProduct.productUnit ? '✅' : '❌'} ${cjProduct.productUnit || 'Manquant'}`);
    console.log(`   - Material Name EN: ${cjProduct.materialNameEn ? '✅' : '❌'} ${cjProduct.materialNameEn || 'Manquant'}`);
    console.log(`   - Packing Name EN: ${cjProduct.packingNameEn ? '✅' : '❌'} ${cjProduct.packingNameEn || 'Manquant'}`);
    console.log(`   - Product Key EN: ${cjProduct.productKeyEn ? '✅' : '❌'} ${cjProduct.productKeyEn || 'Manquant'}`);
    console.log('');

    // Prix et marketing
    console.log('💰 Prix et marketing:');
    console.log(`   - Suggest Sell Price: ${cjProduct.suggestSellPrice ? '✅' : '❌'} ${cjProduct.suggestSellPrice || 'Manquant'}`);
    console.log(`   - Listed Num: ${cjProduct.listedNum ? '✅' : '❌'} ${cjProduct.listedNum || 'Manquant'}`);
    console.log(`   - Supplier Name: ${cjProduct.supplierName ? '✅' : '❌'} ${cjProduct.supplierName || 'Manquant'}`);
    console.log('');

    // Variants
    console.log('🎨 Variants:');
    if (cjProduct.variants) {
      try {
        const variants = typeof cjProduct.variants === 'string' 
          ? JSON.parse(cjProduct.variants) 
          : cjProduct.variants;
        
        console.log(`   - Variants: ✅ ${variants.length} variants sauvegardés`);
        
        if (variants.length > 0) {
          const firstVariant = variants[0];
          console.log('   📋 Premier variant contient:');
          Object.keys(firstVariant).forEach(key => {
            const value = firstVariant[key];
            const hasValue = value !== null && value !== undefined && value !== '';
            console.log(`      - ${key}: ${hasValue ? '✅' : '❌'} ${hasValue ? (typeof value === 'object' ? 'Objet présent' : String(value).slice(0, 30) + '...') : 'Manquant'}`);
          });
        }
      } catch (e) {
        console.log(`   - Variants: ❌ Erreur parsing: ${e.message}`);
      }
    } else {
      console.log('   - Variants: ❌ Manquants');
    }
    console.log('');

    // Reviews
    console.log('⭐ Reviews:');
    if (cjProduct.reviews) {
      try {
        const reviews = typeof cjProduct.reviews === 'string' 
          ? JSON.parse(cjProduct.reviews) 
          : cjProduct.reviews;
        console.log(`   - Reviews: ✅ ${reviews.length} avis sauvegardés`);
      } catch (e) {
        console.log(`   - Reviews: ❌ Erreur parsing: ${e.message}`);
      }
    } else {
      console.log('   - Reviews: ❌ Manquants');
    }

    // Tags
    console.log('🏷️ Tags:');
    if (cjProduct.tags) {
      try {
        const tags = typeof cjProduct.tags === 'string' 
          ? JSON.parse(cjProduct.tags) 
          : cjProduct.tags;
        console.log(`   - Tags: ✅ ${tags.length} tags sauvegardés`);
      } catch (e) {
        console.log(`   - Tags: ❌ Erreur parsing: ${e.message}`);
      }
    } else {
      console.log('   - Tags: ❌ Manquants');
    }

    // Autres infos
    console.log('');
    console.log('📐 Autres informations:');
    console.log(`   - Dimensions: ${cjProduct.dimensions ? '✅' : '❌'} ${cjProduct.dimensions || 'Manquantes'}`);
    console.log(`   - Brand: ${cjProduct.brand ? '✅' : '❌'} ${cjProduct.brand || 'Manquante'}`);
    console.log(`   - Creator Time: ${cjProduct.createrTime ? '✅' : '❌'} ${cjProduct.createrTime || 'Manquant'}`);
    console.log('');

    // 3. Vérifier si le produit est aussi dans le magasin principal
    console.log('🏪 Vérification dans le magasin principal:');
    const mainProduct = await prisma.product.findFirst({
      where: { name: cjProduct.name },
      include: { supplier: true }
    });

    if (mainProduct) {
      console.log(`   ✅ Présent dans le magasin principal:`);
      console.log(`      - ID: ${mainProduct.id}`);
      console.log(`      - Nom: ${mainProduct.name}`);
      console.log(`      - Prix: $${mainProduct.price}`);
      console.log(`      - Status: ${mainProduct.status}`);
      console.log(`      - Fournisseur: ${mainProduct.supplier?.name}`);
      
      // Vérifier si les détails sont transférés
      console.log('\n   📊 Comparaison des données:');
      console.log(`      - Description: CJ=${!!cjProduct.description} vs Main=${!!mainProduct.description}`);
      console.log(`      - Image: CJ=${!!cjProduct.image} vs Main=${!!mainProduct.imageUrl}`);
    } else {
      console.log('   ❌ Pas encore dans le magasin principal');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkImportCompleteness();