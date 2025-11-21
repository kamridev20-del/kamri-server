const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugProductStructure() {
  console.log('🔍 Debug de la structure des produits CJ...\n');

  try {
    // 1. Vérifier la structure de cJProductStore
    const cjProducts = await prisma.cJProductStore.findMany({
      take: 1
    });

    if (cjProducts.length === 0) {
      console.log('❌ Aucun produit dans cJProductStore');
      return;
    }

    const product = cjProducts[0];
    console.log('📦 Premier produit CJ dans la base:');
    console.log('Structure complète:');
    console.log(JSON.stringify(product, null, 2));

    // 2. Vérifier si on a des PIDs valides
    const productsWithPid = await prisma.cJProductStore.findMany({
      where: {
        pid: {
          not: null
        }
      },
      take: 3
    });

    console.log(`\n📋 Produits avec PID trouvés: ${productsWithPid.length}`);
    productsWithPid.forEach((p, index) => {
      console.log(`${index + 1}. PID: ${p.pid}, SKU: ${p.productSku}, Nom: ${p.productName}`);
    });

    // 3. Si on a un PID valide, testons l'API directement
    if (productsWithPid.length > 0) {
      const testPid = productsWithPid[0].pid;
      console.log(`\n🌐 Test avec PID: ${testPid}`);
      
      try {
        const response = await fetch(`http://localhost:3001/api/cj-dropshipping/product-details/${testPid}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log(`Statut HTTP: ${response.status}`);
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Réponse API réussie !');
          console.log('Premiers champs reçus:');
          console.log(`- pid: ${data.pid}`);
          console.log(`- productName: ${data.productName}`);
          console.log(`- sellPrice: ${data.sellPrice}`);
          console.log(`- suggestSellPrice: ${data.suggestSellPrice} (type: ${typeof data.suggestSellPrice})`);
        } else {
          const errorText = await response.text();
          console.log(`❌ Erreur API: ${errorText}`);
        }
      } catch (apiError) {
        console.log(`❌ Erreur réseau: ${apiError.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugProductStructure();