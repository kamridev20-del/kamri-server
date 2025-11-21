import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

async function getCJAccessToken(email: string, apiKey: string): Promise<string> {
  const response = await axios.post(
    `${CJ_BASE_URL}/authentication/getAccessToken`,
    { email, apiKey },
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  if (response.data?.code === 200 && response.data?.data?.accessToken) {
    return response.data.data.accessToken;
  }
  
  throw new Error(`Erreur authentification CJ: ${response.data?.message || 'Erreur inconnue'}`);
}

async function getVariantById(accessToken: string, vid: string): Promise<any> {
  const response = await axios.get(
    `${CJ_BASE_URL}/product/variant/queryByVid?vid=${vid}`,
    {
      headers: {
        'CJ-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (response.data?.code === 200 && response.data?.data) {
    return response.data.data;
  }
  
  throw new Error(`Variant ${vid} introuvable: ${response.data?.message || 'Erreur inconnue'}`);
}

async function validateCJVids(orderId: string) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🔍 VALIDATION VID CJ');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!orderId) {
    console.log('❌ Veuillez fournir un ID de commande');
    console.log('Usage: npx ts-node server/validate-cj-vids.ts <orderId>');
    process.exit(1);
  }

  try {
    // Charger la config CJ
    const config = await prisma.cJConfig.findFirst();
    if (!config || !config.enabled) {
      console.log('❌ Configuration CJ non trouvée ou désactivée');
      process.exit(1);
    }

    // Obtenir le token d'accès
    let accessToken = config.accessToken;
    
    // Vérifier si le token est valide
    if (!accessToken || !config.tokenExpiry || new Date() >= new Date(config.tokenExpiry)) {
      console.log('🔑 Token expiré ou manquant - Connexion à CJ...');
      accessToken = await getCJAccessToken(config.email, config.apiKey);
      console.log('✅ Authentification réussie');
    } else {
      console.log('✅ Utilisation du token existant');
    }

    // Charger la commande
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                productVariants: {
                  where: {
                    cjVariantId: { not: null },
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      console.log(`❌ Commande ${orderId} introuvable`);
      process.exit(1);
    }

    console.log(`✅ Commande trouvée: ${order.id}\n`);

    // Valider chaque vid
    for (const item of order.items) {
      const product = item.product;
      const isCJ = product.cjProductId !== null && product.source === 'cj-dropshipping';

      if (!isCJ) continue;

      console.log(`\n📦 Produit: ${product.name}`);
      console.log(`   CJ Product ID: ${product.cjProductId}`);

      if (product.productVariants.length === 0) {
        console.log(`   ❌ Aucun variant avec cjVariantId`);
        continue;
      }

      for (const variant of product.productVariants) {
        const vid = variant.cjVariantId;
        if (!vid) continue;

        console.log(`\n   🔍 Validation vid: ${vid}`);
        
        try {
          const variantDetails = await getVariantById(accessToken, vid);
          console.log(`   ✅ VID VALIDE dans CJ`);
          console.log(`      Nom: ${variantDetails.variantNameEn || variantDetails.variantName || 'N/A'}`);
          console.log(`      SKU: ${variantDetails.variantSku || 'N/A'}`);
          console.log(`      Prix: $${variantDetails.variantSellPrice || 'N/A'}`);
        } catch (error: any) {
          console.log(`   ❌ VID INVALIDE ou INEXISTANT dans CJ`);
          console.log(`      Erreur: ${error.response?.data?.message || error.message}`);
        }

        // Attendre un peu pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   ✅ VALIDATION TERMINÉE');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const orderId = process.argv[2];
validateCJVids(orderId);

