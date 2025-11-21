import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseCJVariants() {
  console.log('🔍 === DIAGNOSTIC DES VARIANTS CJ ===\n');

  try {
    // Requête 1: Voir la structure des produits CJ avec leurs variants
    console.log('📦 Produits CJ avec variants (5 premiers):');
    const productsWithVariants = await prisma.product.findMany({
      where: {
        cjProductId: { not: null },
      },
      include: {
        productVariants: {
          take: 3, // Limiter à 3 variants par produit
        },
        cjMapping: true,
      },
      take: 5,
    });

    for (const product of productsWithVariants) {
      console.log(`\n📦 Produit: ${product.name?.substring(0, 60)}...`);
      console.log(`   ID: ${product.id}`);
      console.log(`   cjProductId: ${product.cjProductId}`);
      console.log(`   Variants (${product.productVariants.length}):`);
      
      for (const variant of product.productVariants) {
        console.log(`     - Variant ID: ${variant.id}`);
        console.log(`       SKU: ${variant.sku || 'N/A'}`);
        console.log(`       cjVariantId: ${variant.cjVariantId || '❌ MANQUANT'}`);
        console.log(`       isActive: ${variant.isActive}`);
        console.log(`       Format VID: ${variant.cjVariantId ? (variant.cjVariantId.includes('_') ? '⚠️ SUSPECT (contient _)' : variant.cjVariantId.includes('-') ? '✅ UUID' : '✅ Numérique') : 'N/A'}`);
      }
    }

    // Requête 2: Compter les variants avec/sans cjVariantId
    console.log('\n\n📊 === STATISTIQUES ===');
    const totalVariants = await prisma.productVariant.count({
      where: {
        product: {
          cjProductId: { not: null },
        },
      },
    });

    const variantsWithCJId = await prisma.productVariant.count({
      where: {
        product: {
          cjProductId: { not: null },
        },
        cjVariantId: { not: null },
      },
    });

    const variantsWithoutCJId = totalVariants - variantsWithCJId;

    console.log(`Total variants CJ: ${totalVariants}`);
    console.log(`Variants avec cjVariantId: ${variantsWithCJId} ✅`);
    console.log(`Variants sans cjVariantId: ${variantsWithoutCJId} ❌`);

    // Requête 3: Trouver des exemples de VID suspects
    console.log('\n\n⚠️ === VID SUSPECTS ===');
    const suspectVariants = await prisma.productVariant.findMany({
      where: {
        product: {
          cjProductId: { not: null },
        },
        cjVariantId: { not: null },
        OR: [
          { cjVariantId: { contains: '_' } },
          { cjVariantId: { contains: 'TH' } },
        ],
      },
      include: {
        product: {
          select: {
            name: true,
            cjProductId: true,
          },
        },
      },
      take: 5,
    });

    if (suspectVariants.length > 0) {
      console.log(`Trouvé ${suspectVariants.length} variants avec VID suspect:`);
      for (const variant of suspectVariants) {
        console.log(`  - Produit: ${variant.product.name?.substring(0, 50)}...`);
        console.log(`    cjVariantId: ${variant.cjVariantId}`);
        console.log(`    SKU: ${variant.sku || 'N/A'}`);
      }
    } else {
      console.log('Aucun VID suspect trouvé ✅');
    }

    // Requête 4: Vérifier un produit spécifique mentionné dans les logs
    console.log('\n\n🎯 === PRODUIT SPÉCIFIQUE (Nordic-style) ===');
    const specificProduct = await prisma.product.findFirst({
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

    if (specificProduct) {
      console.log(`Produit trouvé: ${specificProduct.name}`);
      console.log(`cjProductId: ${specificProduct.cjProductId}`);
      console.log(`Variants (${specificProduct.productVariants.length}):`);
      for (const variant of specificProduct.productVariants) {
        console.log(`  - cjVariantId: ${variant.cjVariantId || '❌ MANQUANT'}`);
        console.log(`    SKU: ${variant.sku || 'N/A'}`);
        console.log(`    isActive: ${variant.isActive}`);
      }
    } else {
      console.log('Produit non trouvé');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseCJVariants();

