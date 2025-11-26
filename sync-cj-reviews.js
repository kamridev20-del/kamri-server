const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

// Utiliser l'URL publique Railway
const DATABASE_URL = "postgresql://postgres:avUQefgltUYjOGVtXyouUFwtEyeLshdY@yamabiko.proxy.rlwy.net:28846/railway";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

// URL de ton API backend
const API_BASE_URL = 'https://kamri-server-production.up.railway.app';

function calculateRatingFromReviews(reviews) {
  if (!reviews || reviews.length === 0) {
    return { rating: 0, count: 0 };
  }

  const totalScore = reviews.reduce((sum, review) => {
    const score = parseFloat(review.score || review.rating || '0');
    return sum + score;
  }, 0);

  const averageRating = totalScore / reviews.length;
  
  return {
    rating: Math.round(averageRating * 10) / 10,
    count: reviews.length
  };
}

async function syncProductReviews() {
  console.log('🔄 Synchronisation des reviews CJ...\n');

  try {
    // Récupérer tous les produits avec un cjProductId
    const products = await prisma.product.findMany({
      where: {
        cjProductId: {
          not: null
        },
        status: 'active' // Seulement les produits actifs
      },
      select: {
        id: true,
        name: true,
        cjProductId: true,
        rating: true,
        reviewsCount: true,
      },
      take: 20 // Limiter à 20 pour ne pas surcharger
    });

    console.log(`📦 ${products.length} produits CJ trouvés\n`);

    let updated = 0;
    let failed = 0;
    let noReviews = 0;

    for (const product of products) {
      try {
        console.log(`🔍 ${product.name.substring(0, 50)}...`);
        
        // Récupérer les reviews depuis l'API CJ
        const response = await axios.get(
          `${API_BASE_URL}/api/cj-dropshipping/products/${product.cjProductId}/reviews`,
          { timeout: 10000 }
        );

        if (response.data && response.data.reviews) {
          const reviews = response.data.reviews;
          const { rating, count } = calculateRatingFromReviews(reviews);

          if (count > 0) {
            // Mettre à jour le produit avec les reviews
            await prisma.product.update({
              where: { id: product.id },
              data: {
                cjReviews: JSON.stringify(reviews),
                rating: rating,
                reviewsCount: count
              }
            });

            console.log(`   ✅ ${count} avis synchronisés - Rating: ${rating}/5\n`);
            updated++;
          } else {
            console.log(`   ⏭️  Aucun avis disponible\n`);
            noReviews++;
          }
        } else {
          console.log(`   ⚠️  Pas de reviews dans la réponse\n`);
          noReviews++;
        }

        // Pause pour ne pas surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}\n`);
        failed++;
      }
    }

    console.log('\n📊 Résumé:');
    console.log(`   ✅ Produits mis à jour: ${updated}`);
    console.log(`   ⏭️  Sans avis: ${noReviews}`);
    console.log(`   ❌ Échecs: ${failed}`);
    console.log(`   📦 Total: ${products.length}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

syncProductReviews();

