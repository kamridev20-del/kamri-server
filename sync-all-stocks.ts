import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api';

async function syncAllStocks() {
  console.log('🚀 === SYNCHRONISATION MASSIVE DES STOCKS ===\n');
  
  // Récupérer tous les produits CJ avec un cjProductId
  const products = await prisma.product.findMany({
    where: {
      cjProductId: { not: null },
      source: 'cj-dropshipping'
    },
    select: {
      id: true,
      name: true,
      cjProductId: true,
      productVariants: {
        select: { id: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`📦 ${products.length} produits CJ trouvés\n`);
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const progress = `[${i + 1}/${products.length}]`;
    
    console.log(`${progress} 🔄 ${product.name.substring(0, 50)}...`);
    console.log(`   ID: ${product.id}`);
    console.log(`   CJ PID: ${product.cjProductId}`);
    console.log(`   Variants: ${product.productVariants.length}`);
    
    if (product.productVariants.length === 0) {
      console.log(`   ⏭️  Aucun variant, skip\n`);
      skippedCount++;
      continue;
    }
    
    try {
      // Appeler l'endpoint de sync
      const response = await axios.post(
        `${API_URL}/cj-dropshipping/products/${product.id}/sync-variants-stock`,
        {},
        { timeout: 30000 }
      );
      
      if (response.data.success) {
        console.log(`   ✅ ${response.data.data.updated} variants synchronisés\n`);
        successCount++;
      } else {
        console.log(`   ⚠️  ${response.data.message}\n`);
        skippedCount++;
      }
      
      // Pause pour respecter le rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error: any) {
      console.log(`   ❌ Erreur: ${error.message}\n`);
      errorCount++;
    }
  }
  
  console.log('\n========================================');
  console.log('✅ SYNCHRONISATION TERMINÉE');
  console.log('========================================');
  console.log(`✅ Succès: ${successCount}`);
  console.log(`❌ Erreurs: ${errorCount}`);
  console.log(`⏭️  Ignorés: ${skippedCount}`);
  console.log(`📊 Total: ${products.length}`);
  
  await prisma.$disconnect();
}

syncAllStocks().catch(console.error);

