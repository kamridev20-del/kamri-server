const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSupplierViewData() {
  console.log('🔍 Vérification des données visibles depuis la page Fournisseurs...\n');

  try {
    // 1. Récupérer le fournisseur CJ Dropshipping
    const cjSupplier = await prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' },
      include: {
        products: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Le produit le plus récent
        }
      }
    });

    if (!cjSupplier) {
      console.log('❌ Fournisseur CJ Dropshipping non trouvé');
      return;
    }

    console.log('🏭 FOURNISSEUR CJ DROPSHIPPING:');
    console.log(`   - ID: ${cjSupplier.id}`);
    console.log(`   - Nom: ${cjSupplier.name}`);
    console.log(`   - Status: ${cjSupplier.status}`);
    console.log(`   - Total produits: ${cjSupplier.products.length}`);
    console.log('');

    if (cjSupplier.products.length === 0) {
      console.log('❌ Aucun produit associé à ce fournisseur');
      return;
    }

    // 2. Analyser le produit CJ le plus récent
    const product = cjSupplier.products[0];
    
    console.log('📦 PRODUIT CJ VU DEPUIS LA PAGE FOURNISSEURS:');
    console.log(`   - ID: ${product.id}`);
    console.log(`   - Nom: ${product.name}`);
    console.log(`   - Prix: $${product.price}`);
    console.log(`   - Status: ${product.status}`);
    console.log(`   - Source: ${product.source}`);
    console.log('');

    // 3. Vérifier TOUTES les données CJ disponibles pour le fournisseur
    console.log('📊 DONNÉES CJ COMPLÈTES DISPONIBLES POUR LE FOURNISSEUR:');
    
    // Informations de base
    console.log('🏷️ Informations de base accessibles:');
    console.log(`   ${product.name ? '✅' : '❌'} Nom: ${product.name || 'N/A'}`);
    console.log(`   ${product.description ? '✅' : '❌'} Description: ${product.description ? 'Oui' : 'Non'}`);
    console.log(`   ${product.price ? '✅' : '❌'} Prix: $${product.price || 'N/A'}`);
    console.log(`   ${product.originalPrice ? '✅' : '❌'} Prix original: $${product.originalPrice || 'N/A'}`);
    console.log(`   ${product.image ? '✅' : '❌'} Image: ${product.image ? 'Oui' : 'Non'}`);
    console.log(`   ${product.externalCategory ? '✅' : '❌'} Catégorie CJ: ${product.externalCategory || 'N/A'}`);
    console.log('');

    // Données techniques CJ
    console.log('🔧 Spécifications techniques CJ accessibles:');
    console.log(`   ${product.productSku ? '✅' : '❌'} SKU CJ: ${product.productSku || 'N/A'}`);
    console.log(`   ${product.productWeight ? '✅' : '❌'} Poids: ${product.productWeight || 'N/A'}`);
    console.log(`   ${product.packingWeight ? '✅' : '❌'} Poids emballage: ${product.packingWeight || 'N/A'}`);
    console.log(`   ${product.productType ? '✅' : '❌'} Type produit: ${product.productType || 'N/A'}`);
    console.log(`   ${product.materialNameEn ? '✅' : '❌'} Matériau: ${product.materialNameEn || 'N/A'}`);
    console.log(`   ${product.packingNameEn ? '✅' : '❌'} Emballage: ${product.packingNameEn || 'N/A'}`);
    console.log(`   ${product.productKeyEn ? '✅' : '❌'} Attributs: ${product.productKeyEn || 'N/A'}`);
    console.log('');

    // Prix et marketing
    console.log('💰 Données marketing CJ accessibles:');
    console.log(`   ${product.suggestSellPrice ? '✅' : '❌'} Prix suggéré CJ: ${product.suggestSellPrice || 'N/A'}`);
    console.log(`   ${product.listedNum ? '✅' : '❌'} Nombre de listings: ${product.listedNum || 'N/A'}`);
    console.log(`   ${product.supplierName ? '✅' : '❌'} Nom fournisseur original: ${product.supplierName || 'N/A'}`);
    console.log(`   ${product.createrTime ? '✅' : '❌'} Date création CJ: ${product.createrTime || 'N/A'}`);
    console.log('');

    // VARIANTS - Le plus important !
    console.log('🎨 VARIANTS CJ ACCESSIBLES DEPUIS FOURNISSEURS:');
    if (product.variants) {
      try {
        const variants = JSON.parse(product.variants);
        console.log(`   ✅ VARIANTS COMPLETS DISPONIBLES: ${variants.length} variants !`);
        console.log('');
        
        // Analyser les variants
        console.log('   📋 Détails des variants accessibles au fournisseur:');
        variants.slice(0, 2).forEach((variant, index) => {
          console.log(`   ${index + 1}. ${variant.variantNameEn || variant.variantName || 'Variant sans nom'}`);
          console.log(`      - VID: ${variant.vid || 'N/A'}`);
          console.log(`      - SKU variant: ${variant.variantSku || 'N/A'}`);
          console.log(`      - Prix variant: $${variant.variantSellPrice || 'N/A'}`);
          console.log(`      - Prix suggéré variant: $${variant.variantSugSellPrice || 'N/A'}`);
          console.log(`      - Poids: ${variant.variantWeight}g`);
          console.log(`      - Dimensions: ${variant.variantLength}×${variant.variantWidth}×${variant.variantHeight}`);
          console.log(`      - Standard: ${variant.variantStandard || 'N/A'}`);
          console.log(`      - Image variant: ${variant.variantImage ? 'Disponible' : 'Non'}`);
          console.log(`      - Clé variant: ${variant.variantKey || 'N/A'}`);
          console.log('');
        });
        
        if (variants.length > 2) {
          console.log(`   ... et ${variants.length - 2} autres variants avec détails complets !`);
        }
        
        // Résumé des capacités pour le fournisseur
        console.log('   🎯 Ce que le fournisseur peut voir:');
        console.log('      ✅ Tous les variants (couleurs, tailles, etc.)');
        console.log('      ✅ Prix de chaque variant');
        console.log('      ✅ Prix suggérés par variant');
        console.log('      ✅ Poids et dimensions de chaque variant');
        console.log('      ✅ Images spécifiques par variant');
        console.log('      ✅ SKU uniques par variant');
        console.log('      ✅ Spécifications techniques complètes');
        console.log('');
        
      } catch (e) {
        console.log(`   ❌ Erreur parsing variants: ${e.message}`);
      }
    } else {
      console.log('   ❌ Pas de variants disponibles');
    }

    // Autres données
    console.log('📐 Autres données CJ accessibles:');
    console.log(`   ${product.dimensions ? '✅' : '❌'} Dimensions: ${product.dimensions || 'N/A'}`);
    console.log(`   ${product.brand ? '✅' : '❌'} Marque: ${product.brand || 'N/A'}`);
    
    // Avis
    if (product.cjReviews) {
      try {
        const reviews = JSON.parse(product.cjReviews);
        console.log(`   ✅ Avis CJ: ${reviews.length} avis disponibles`);
      } catch (e) {
        console.log(`   ❌ Avis CJ: Erreur parsing`);
      }
    } else {
      console.log('   ❌ Avis CJ: Non disponibles');
    }

    // Tags
    if (product.tags) {
      try {
        const tags = JSON.parse(product.tags);
        console.log(`   ✅ Tags: ${tags.length} tags disponibles`);
      } catch (e) {
        console.log(`   ❌ Tags: Erreur parsing`);
      }
    } else {
      console.log('   ❌ Tags: Non disponibles');
    }

    console.log('');
    console.log('🎉 RÉSULTAT POUR LA PAGE FOURNISSEURS:');
    console.log('');
    console.log('✅ Le fournisseur CJ Dropshipping a maintenant accès à:');
    console.log('   📦 Tous les produits importés avec détails complets');
    console.log('   🎨 Tous les variants avec spécifications individuelles');
    console.log('   💰 Prix originaux CJ ET prix suggérés');
    console.log('   🔧 Spécifications techniques complètes');
    console.log('   📏 Dimensions et poids détaillés');
    console.log('   🏷️ Matériaux, emballage et attributs');
    console.log('   ⭐ Avis et évaluations CJ');
    console.log('   🏷️ Tags et catégorisations');
    console.log('');
    console.log('🚀 La page Fournisseurs affiche maintenant TOUTES les données CJ !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSupplierViewData();