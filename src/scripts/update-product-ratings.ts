import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script pour calculer et mettre à jour les ratings des produits existants
 * depuis leurs reviews CJ stockées en JSON
 */

function calculateRatingFromReviews(reviews: any[]): { rating: number; count: number } {
  if (!reviews || reviews.length === 0) {
    return { rating: 0, count: 0 };
  }

  const totalScore = reviews.reduce((sum, review) => {
    const score = parseFloat(review.score || review.rating || '0');
    return sum + score;
  }, 0);

  const averageRating = totalScore / reviews.length;
  
  return {
    rating: Math.round(averageRating * 10) / 10, // Arrondir à 1 décimale
    count: reviews.length
  };
}

async function updateProductRatings() {
  console.log('🔄 Mise à jour des ratings des produits...\n');

  try {
    // Récupérer tous les produits avec des reviews CJ
    const products = await prisma.product.findMany({
      where: {
        cjReviews: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        cjReviews: true,
        rating: true,
        reviewsCount: true,
      }
    });

    console.log(`📦 ${products.length} produits avec des reviews trouvés\n`);

    let updated = 0;
    let unchanged = 0;

    for (const product of products) {
      try {
        // Parser les reviews JSON
        const reviews = JSON.parse(product.cjReviews || '[]');
        const { rating, count } = calculateRatingFromReviews(reviews);

        // Mettre à jour seulement si les valeurs ont changé
        if (product.rating !== rating || product.reviewsCount !== count) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              rating,
              reviewsCount: count
            }
          });

          console.log(`✅ ${product.name.substring(0, 50)}...`);
          console.log(`   Rating: ${rating}/5 (${count} avis)\n`);
          updated++;
        } else {
          unchanged++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${product.name}:`, error);
      }
    }

    console.log('\n📊 Résumé:');
    console.log(`   ✅ Produits mis à jour: ${updated}`);
    console.log(`   ⏭️  Produits inchangés: ${unchanged}`);
    console.log(`   📦 Total: ${products.length}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
updateProductRatings()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });





