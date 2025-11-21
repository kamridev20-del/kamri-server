import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetCJProducts() {
  console.log('🗑️  === NETTOYAGE PRODUITS CJ ===\n');
  console.log('⚠️  ATTENTION : Ceci va supprimer tous les produits CJ et leurs variants !');
  console.log('');
  
  try {
    // Compter d'abord
    const totalProducts = await prisma.product.count();
    const cjProducts = await prisma.product.count({
      where: {
        source: 'cj-dropshipping'
      }
    });
    
    const totalVariants = await prisma.productVariant.count();
    const cjStore = await prisma.cJProductStore.count();
    
    console.log('📊 État actuel de la base:');
    console.log(`   - Total produits: ${totalProducts}`);
    console.log(`   - Produits CJ: ${cjProducts}`);
    console.log(`   - Total variants: ${totalVariants}`);
    console.log(`   - CJ Product Store: ${cjStore}`);
    console.log('');
    
    console.log('🔄 Suppression en cours...\n');
    
    // 1. Supprimer les ProductVariant (relation)
    const deletedVariants = await prisma.productVariant.deleteMany({
      where: {
        product: {
          source: 'cj-dropshipping'
        }
      }
    });
    console.log(`✅ ${deletedVariants.count} variants supprimés`);
    
    // 2. Supprimer les CJProductMapping
    const deletedMappings = await prisma.cJProductMapping.deleteMany();
    console.log(`✅ ${deletedMappings.count} mappings CJ supprimés`);
    
    // 3. Supprimer les produits CJ
    const deletedProducts = await prisma.product.deleteMany({
      where: {
        source: 'cj-dropshipping'
      }
    });
    console.log(`✅ ${deletedProducts.count} produits CJ supprimés`);
    
    // 4. Vider le CJProductStore (optionnel)
    const deletedStore = await prisma.cJProductStore.deleteMany();
    console.log(`✅ ${deletedStore.count} produits CJ Store supprimés`);
    
    console.log('');
    console.log('🎉 === NETTOYAGE TERMINÉ ===');
    console.log('');
    console.log('📊 État final:');
    const remainingProducts = await prisma.product.count();
    const remainingVariants = await prisma.productVariant.count();
    console.log(`   - Produits restants: ${remainingProducts}`);
    console.log(`   - Variants restants: ${remainingVariants}`);
    console.log('');
    console.log('✅ Vous pouvez maintenant réimporter depuis CJ !');
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetCJProducts();

