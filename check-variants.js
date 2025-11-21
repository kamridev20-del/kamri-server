const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVariantsInProduct() {
  console.log('🔍 Vérification des variants dans les produits CJ...\n');

  try {
    // 1. Récupérer un produit avec ses variants
    const cjProduct = await prisma.cJProductStore.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!cjProduct) {
      console.log('❌ Aucun produit CJ trouvé');
      return;
    }

    console.log('📦 Produit trouvé:');
    console.log(`   - Nom: ${cjProduct.name}`);
    console.log(`   - CJ Product ID: ${cjProduct.cjProductId}`);
    console.log('');

    // 2. Analyser les variants stockés
    console.log('🔧 Analyse des variants stockés:');
    if (cjProduct.variants) {
      try {
        const variants = typeof cjProduct.variants === 'string' 
          ? JSON.parse(cjProduct.variants) 
          : cjProduct.variants;
        
        console.log(`✅ Nombre de variants: ${variants.length}`);
        
        if (variants.length > 0) {
          console.log('\n📋 Premier variant:');
          const firstVariant = variants[0];
          console.log(`   - vid: ${firstVariant.vid}`);
          console.log(`   - variantSku: ${firstVariant.variantSku}`);
          console.log(`   - variantNameEn: ${firstVariant.variantNameEn}`);
          console.log(`   - variantKey: ${firstVariant.variantKey}`);
          console.log(`   - variantSellPrice: ${firstVariant.variantSellPrice}`);
          console.log(`   - variantWeight: ${firstVariant.variantWeight}`);
          console.log(`   - variantImage: ${firstVariant.variantImage}`);
        }
        
        // 3. Tester notre API pour voir si les variants sont bien retournés
        console.log('\n🌐 Test de notre API...');
        const response = await fetch(`http://localhost:3001/api/cj-dropshipping/products/${cjProduct.cjProductId}/details`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const apiData = await response.json();
          console.log(`✅ API Response - Variants: ${apiData.variants?.length || 0}`);
          
          if (apiData.variants && apiData.variants.length > 0) {
            console.log('\n📋 Premier variant depuis API:');
            const apiVariant = apiData.variants[0];
            console.log(`   - vid: ${apiVariant.vid}`);
            console.log(`   - variantSku: ${apiVariant.variantSku}`);
            console.log(`   - variantNameEn: ${apiVariant.variantNameEn}`);
            console.log(`   - variantKey: ${apiVariant.variantKey}`);
            console.log(`   - variantSellPrice: ${apiVariant.variantSellPrice}`);
            console.log(`   - variantWeight: ${apiVariant.variantWeight}`);
          }
        } else {
          console.log('❌ Erreur API:', response.status);
        }
        
      } catch (parseError) {
        console.log('❌ Erreur parsing variants:', parseError.message);
        console.log('Raw variants data:', cjProduct.variants);
      }
    } else {
      console.log('❌ Aucun variant trouvé dans le produit');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVariantsInProduct();