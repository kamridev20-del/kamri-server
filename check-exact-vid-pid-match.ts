import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkExactVidPidMatch() {
  console.log('🔍 === RECHERCHE VID = PID EXACT ===\n');

  try {
    // Requête SQL pour trouver les cas où VID = PID exactement
    const exactMatches = await prisma.$queryRaw<Array<{
      name: string;
      product_id: string;
      variant_id: string;
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
        AND pv."cjVariantId" IS NOT NULL
        AND p."cjProductId" = pv."cjVariantId"
      LIMIT 20;
    `;

    if (exactMatches.length > 0) {
      console.log(`❌ PROBLÈME DÉTECTÉ : ${exactMatches.length} variant(s) ont un VID identique au PID !\n`);
      console.log('Produit | cjProductId | cjVariantId');
      console.log('─'.repeat(80));
      
      for (const row of exactMatches) {
        const name = (row.name || 'Sans nom').substring(0, 50);
        console.log(`${name.padEnd(50)} | ${row.product_id} | ${row.variant_id}`);
      }
      
      console.log('\n⚠️ Ces variants ont un cjVariantId identique au cjProductId.');
      console.log('Cela signifie que le VID stocké est en fait le PID du produit.');
      console.log('Il faut corriger cela en récupérant le vrai VID depuis l\'API CJ.');
    } else {
      console.log('✅ Aucun variant avec VID = PID exact trouvé.');
      console.log('Le problème n\'est pas que le VID est identique au PID.');
    }

    // Vérifier aussi les VID qui commencent par le PID (format suspect)
    console.log('\n\n🔍 === RECHERCHE VID QUI COMMENCENT PAR PID ===\n');
    const startsWithPid = await prisma.$queryRaw<Array<{
      name: string;
      product_id: string;
      variant_id: string;
    }>>`
      SELECT 
        p.name,
        p."cjProductId" as product_id,
        pv."cjVariantId" as variant_id
      FROM "products" p
      JOIN "product_variants" pv ON pv."productId" = p.id
      WHERE p."cjProductId" IS NOT NULL
        AND pv."cjVariantId" IS NOT NULL
        AND pv."cjVariantId" LIKE p."cjProductId" || '%'
        AND p."cjProductId" != pv."cjVariantId"
      LIMIT 20;
    `;

    if (startsWithPid.length > 0) {
      console.log(`⚠️ ${startsWithPid.length} variant(s) ont un VID qui commence par le PID (format suspect) :\n`);
      console.log('Produit | cjProductId | cjVariantId');
      console.log('─'.repeat(80));
      
      for (const row of startsWithPid) {
        const name = (row.name || 'Sans nom').substring(0, 50);
        console.log(`${name.padEnd(50)} | ${row.product_id} | ${row.variant_id}`);
      }
      
      console.log('\n⚠️ Ces VID ont un format suspect (commencent par le PID).');
      console.log('Le système de correction automatique devrait les détecter et les corriger.');
    } else {
      console.log('✅ Aucun VID suspect trouvé (qui commence par le PID).');
    }

    // Statistiques globales
    console.log('\n\n📊 === STATISTIQUES GLOBALES ===\n');
    const stats = await prisma.$queryRaw<Array<{
      total_variants: bigint;
      variants_with_vid: bigint;
      variants_without_vid: bigint;
      exact_matches: bigint;
    }>>`
      SELECT 
        COUNT(*) as total_variants,
        COUNT(pv."cjVariantId") as variants_with_vid,
        COUNT(*) - COUNT(pv."cjVariantId") as variants_without_vid,
        SUM(CASE WHEN p."cjProductId" = pv."cjVariantId" THEN 1 ELSE 0 END) as exact_matches
      FROM "products" p
      JOIN "product_variants" pv ON pv."productId" = p.id
      WHERE p."cjProductId" IS NOT NULL;
    `;

    if (stats.length > 0) {
      const s = stats[0];
      console.log(`Total variants CJ: ${s.total_variants}`);
      console.log(`Variants avec cjVariantId: ${s.variants_with_vid}`);
      console.log(`Variants sans cjVariantId: ${s.variants_without_vid}`);
      console.log(`Variants avec VID = PID (PROBLÈME): ${s.exact_matches}`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkExactVidPidMatch();

