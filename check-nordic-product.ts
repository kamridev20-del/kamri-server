import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNordicProduct() {
  console.log('🔍 === VÉRIFICATION PRODUIT NORDIC-STYLE ===\n');

  try {
    const product = await prisma.product.findFirst({
      where: {
        name: {
          contains: 'Nordic-style Light Luxury Maple Leaf',
        },
      },
      include: {
        productVariants: true,
        cjMapping: true,
      },
    });

    if (!product) {
      console.log('❌ Produit non trouvé');
      return;
    }

    console.log(`✅ Produit trouvé: ${product.name}`);
    console.log(`   ID: ${product.id}`);
    console.log(`   cjProductId: ${product.cjProductId}`);
    console.log(`   cjMapping.cjProductId: ${product.cjMapping?.cjProductId || 'N/A'}`);
    console.log(`   Variants (${product.productVariants.length}):\n`);

    for (const variant of product.productVariants) {
      const isSuspect = variant.cjVariantId?.includes('_') || variant.cjVariantId?.startsWith('TH');
      const suspectText = isSuspect ? '⚠️ SUSPECT' : '✅ OK';
      
      console.log(`   Variant ID: ${variant.id}`);
      console.log(`     cjVariantId: ${variant.cjVariantId || 'NULL'} ${suspectText}`);
      console.log(`     SKU: ${variant.sku || 'N/A'}`);
      console.log(`     isActive: ${variant.isActive}`);
      console.log(`     Format: ${variant.cjVariantId ? (
        variant.cjVariantId.includes('_') ? 'Contient _ (suspect)' :
        variant.cjVariantId.startsWith('TH') ? 'Commence par TH (suspect)' :
        /^\d+$/.test(variant.cjVariantId) ? 'Numérique (OK)' :
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(variant.cjVariantId) ? 'UUID (OK)' :
        'Autre format'
      ) : 'N/A'}`);
      console.log('');
    }

    // Vérifier si le VID est identique au PID
    const hasExactMatch = product.productVariants.some(
      v => v.cjVariantId === product.cjProductId
    );

    if (hasExactMatch) {
      console.log('❌ PROBLÈME: Au moins un variant a un VID identique au PID !');
    } else {
      console.log('✅ Aucun variant avec VID = PID');
    }

    // Vérifier les VID suspects
    const suspectVariants = product.productVariants.filter(
      v => v.cjVariantId && (v.cjVariantId.includes('_') || v.cjVariantId.startsWith('TH'))
    );

    if (suspectVariants.length > 0) {
      console.log(`⚠️ ${suspectVariants.length} variant(s) avec format suspect détecté(s)`);
      console.log('Le système de correction automatique devrait les corriger depuis l\'API CJ.');
    } else {
      console.log('✅ Tous les VID ont un format valide');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNordicProduct();

