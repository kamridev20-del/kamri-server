import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function findValidCJProduct() {
  console.log('🔍 === RECHERCHE PRODUIT CJ VALIDE ===\n');
  
  // 1. Récupérer le token CJ
  const config = await prisma.cJConfig.findFirst();
  
  if (!config || !config.accessToken) {
    console.error('❌ Token CJ introuvable');
    return;
  }
  
  const token = config.accessToken;
  
  // 2. Récupérer un produit depuis l'API CJ directement
  try {
    console.log('📡 Récupération produits depuis l\'API CJ...\n');
    
    const response = await axios.get(
      'https://developers.cjdropshipping.com/api2.0/v1/product/list',
      {
        headers: {
          'CJ-Access-Token': token
        },
        params: {
          pageNum: 1,
          pageSize: 5,
          categoryId: '' // Tous les produits
        }
      }
    );
    
    if (!response.data.data || !response.data.data.list) {
      console.error('❌ Aucun produit trouvé');
      return;
    }
    
    console.log(`✅ ${response.data.data.list.length} produit(s) trouvé(s)\n`);
    
    // 3. Pour chaque produit, récupérer les détails
    for (const product of response.data.data.list) {
      console.log('─────────────────────────────────────────');
      console.log(`📦 Produit: ${product.productNameEn}`);
      console.log(`   PID: ${product.pid}`);
      console.log(`   Prix: $${product.sellPrice}`);
      
      // Récupérer les variants
      try {
        const detailsResponse = await axios.get(
          'https://developers.cjdropshipping.com/api2.0/v1/product/query',
          {
            headers: {
              'CJ-Access-Token': token
            },
            params: {
              pid: product.pid
            }
          }
        );
        
        if (detailsResponse.data.data?.variants?.length > 0) {
          const variant = detailsResponse.data.data.variants[0];
          console.log(`   ✅ Variant disponible:`);
          console.log(`      VID: ${variant.vid}`);
          console.log(`      SKU: ${variant.variantSku}`);
          console.log(`      Stock: ${variant.variantStock || 'N/A'}`);
          
          // Vérifier si ce produit existe dans KAMRI
          const existsInKamri = await prisma.product.findFirst({
            where: {
              cjProductId: product.pid
            }
          });
          
          if (existsInKamri) {
            console.log(`   ✅ EXISTE DANS KAMRI !`);
          } else {
            console.log(`   ⚠️ N'existe pas dans KAMRI`);
          }
          
          console.log('\n   💡 Pour tester, crée une commande avec ce produit dans KAMRI\n');
        }
      } catch (err: any) {
        console.error(`   ❌ Erreur récupération variants: ${err.message}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

findValidCJProduct()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

