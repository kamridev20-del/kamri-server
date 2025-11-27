const { PrismaClient } = require('@prisma/client');

// Utiliser l'URL Railway
const DATABASE_URL = "postgresql://postgres:avUQefgltUYjOGVtXyouUFwtEyeLshdY@yamabiko.proxy.rlwy.net:28846/railway";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

// Import dynamique du service
async function loadCJClient() {
  // Simuler le service comme s'il tournait
  const axios = require('axios');
  const crypto = require('crypto');
  
  // Récupérer le token depuis la base de données
  const config = await prisma.cJConfig.findFirst();
  
  if (!config || !config.accessToken) {
    throw new Error('❌ Pas d\'access token en base de données');
  }
  
  // Vérifier si le token est expiré
  if (config.tokenExpiry && new Date(config.tokenExpiry) < new Date()) {
    throw new Error('❌ Token expiré - Redémarrez le serveur pour le rafraîchir');
  }
  
  console.log('✅ Configuration CJ trouvée');
  console.log(`   Token valide jusqu'à: ${config.tokenExpiry}\n`);
  
  // Créer un client axios
  const client = axios.create({
    baseURL: 'https://developers.cjdropshipping.com/api2.0/v1',
    timeout: 30000,
  });
  
  return { client, accessToken: config.accessToken };
}

function calculateRating(reviews) {
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

async function syncAllReviews() {
  try {
    console.log('🔄 Synchronisation des avis via le backend CJ...\n');

    // Charger le client CJ
    const { client, accessToken } = await loadCJClient();

    // Récupérer tous les produits avec cjProductId
    const products = await prisma.product.findMany({
      where: {
        cjProductId: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        cjProductId: true,
        rating: true,
        reviewsCount: true
      }
      // Pas de limite - synchroniser TOUS les produits
    });

    console.log(`📦 ${products.length} produits trouvés\n`);

    let successCount = 0;
    let withReviewsCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const progress = `[${i + 1}/${products.length}]`;
      
      console.log(`${progress} ${product.name.substring(0, 50)}...`);
      console.log(`   CJ PID: ${product.cjProductId}`);

      try {
        // Récupérer les reviews depuis l'API CJ
        const response = await client.get('/product/productComments', {
          params: {
            pid: product.cjProductId,
            pageNum: 1,
            pageSize: 50
          },
          headers: {
            'CJ-Access-Token': accessToken
          }
        });

        const reviews = response.data?.data?.list || [];

        if (reviews.length > 0) {
          const { rating, count } = calculateRating(reviews);
          
          // Mettre à jour le produit
          await prisma.product.update({
            where: { id: product.id },
            data: {
              cjReviews: JSON.stringify(reviews),
              rating: rating,
              reviewsCount: count
            }
          });

          console.log(`   ✅ ${count} avis synchronisés - Rating: ${rating}/5`);
          withReviewsCount++;
        } else {
          // Mettre à jour avec 0 avis
          await prisma.product.update({
            where: { id: product.id },
            data: {
              cjReviews: '[]',
              rating: 0,
              reviewsCount: 0
            }
          });
          console.log(`   ℹ️  0 avis`);
        }

        successCount++;

        // Pause entre les requêtes pour éviter le rate limit
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.log(`   ❌ Erreur: ${error.response?.data?.message || error.message}`);
      }

      console.log('');
    }

    console.log('\n📊 Résumé:');
    console.log(`   ✅ Succès: ${successCount}/${products.length}`);
    console.log(`   ⭐ Avec avis: ${withReviewsCount}`);

  } catch (error) {
    console.error('\n❌ Erreur globale:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

syncAllReviews();

