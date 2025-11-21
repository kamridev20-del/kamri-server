import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVidVsPid() {
  console.log('🔍 === VÉRIFICATION VID vs PID ===\n');

  try {
    // Requête pour comparer cjVariantId avec cjProductId
    const products = await prisma.product.findMany({
      where: {
        cjProductId: { not: null },
      },
      include: {
        productVariants: {
          take: 3, // Limiter à 3 variants par produit
        },
      },
      take: 10,
    });

    console.log('📊 Résultats de la comparaison:\n');
    console.log('Produit | cjProductId | cjVariantId | Sont identiques?');
    console.log('─'.repeat(80));

    let countSame = 0;
    let countDifferent = 0;
    let countNull = 0;

    for (const product of products) {
      const productId = product.cjProductId || 'N/A';
      const productName = (product.name || 'Sans nom').substring(0, 40);

      if (product.productVariants.length === 0) {
        console.log(`${productName.padEnd(40)} | ${String(productId).padEnd(12)} | ${'AUCUN VARIANT'.padEnd(12)} | N/A`);
        countNull++;
        continue;
      }

      for (const variant of product.productVariants) {
        const variantId = variant.cjVariantId || 'NULL';
        const areSame = productId === variantId;
        const sameText = areSame ? '❌ OUI (PROBLÈME!)' : '✅ NON';

        console.log(
          `${productName.padEnd(40)} | ${String(productId).padEnd(12)} | ${String(variantId).padEnd(12)} | ${sameText}`
        );

        if (areSame) {
          countSame++;
        } else {
          countDifferent++;
        }
      }
    }

    console.log('\n');
    console.log('📊 === STATISTIQUES ===');
    console.log(`Variants avec VID = PID (PROBLÈME): ${countSame} ❌`);
    console.log(`Variants avec VID ≠ PID (OK): ${countDifferent} ✅`);
    console.log(`Produits sans variants: ${countNull}`);

    // Requête SQL directe pour avoir plus de détails
    console.log('\n\n🔍 === REQUÊTE SQL DIRECTE ===');
    const rawResults = await prisma.$queryRaw<Array<{
      name: string;
      product_id: string;
      variant_id: string | null;
      are_same: boolean;
    }>>`
      SELECT 
        p.name,
        p."cjProductId" as product_id,
        pv."cjVariantId" as variant_id,
        (p."cjProductId" = pv."cjVariantId") as are_same
      FROM "products" p
      JOIN "product_variants" pv ON pv."productId" = p.id
      WHERE p."cjProductId" IS NOT NULL
      LIMIT 10;
    `;

    console.log('\nRésultats SQL direct:');
    console.log('─'.repeat(80));
    for (const row of rawResults) {
      const sameText = row.are_same ? '❌ OUI (PROBLÈME!)' : '✅ NON';
      console.log(
        `${(row.name || 'Sans nom').substring(0, 40).padEnd(40)} | ${String(row.product_id).padEnd(12)} | ${String(row.variant_id || 'NULL').padEnd(12)} | ${sameText}`
      );
    }

    // Compter les problèmes
    const problematicVariants = rawResults.filter(r => r.are_same);
    if (problematicVariants.length > 0) {
      console.log('\n\n⚠️ === PROBLÈME DÉTECTÉ ===');
      console.log(`${problematicVariants.length} variant(s) ont un cjVariantId identique au cjProductId !`);
      console.log('Cela signifie que le VID stocké est en fait le PID du produit.');
      console.log('Il faut corriger cela en récupérant le vrai VID depuis l\'API CJ.');
    } else {
      console.log('\n\n✅ Aucun problème détecté - Les VID sont différents des PID');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVidVsPid();

