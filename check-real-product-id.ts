import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRealProductId() {
  const productId = 'cmhxf6r6o09rmjeroo0v2olrn';
  
  console.log('🔍 Vérification du produit:', productId);
  console.log('');
  
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      productVariants: {
        take: 5,
        orderBy: { createdAt: 'asc' }
      },
      cjMapping: true
    }
  });
  
  if (!product) {
    console.log('❌ Produit introuvable');
    await prisma.$disconnect();
    return;
  }
  
  console.log('📦 Produit:', product.name);
  console.log('   ID:', product.id);
  console.log('   cjProductId:', product.cjProductId || '❌ NULL');
  console.log('   Stock global:', product.stock);
  console.log('   Source:', product.source);
  console.log('');
  
  if (product.cjMapping) {
    console.log('🔗 CJ Mapping:');
    console.log('   cjProductId:', product.cjMapping.cjProductId);
    console.log('   cjSku:', product.cjMapping.cjSku);
  } else {
    console.log('❌ Aucun CJ Mapping');
  }
  console.log('');
  
  console.log(`📊 Variants (${product.productVariants.length} affichés):`);
  for (const variant of product.productVariants) {
    console.log(`   - ${variant.name || variant.sku}`);
    console.log(`     Stock: ${variant.stock ?? 'NULL'}`);
    console.log(`     cjVariantId: ${variant.cjVariantId || 'NULL'}`);
    console.log('');
  }
  
  // Chercher le cjProductId à partir des variants
  if (product.productVariants.length > 0 && product.productVariants[0].cjVariantId) {
    const firstVariantId = product.productVariants[0].cjVariantId;
    console.log('💡 Si le cjProductId est NULL, essayez de chercher avec le premier variant ID:');
    console.log('   ', firstVariantId);
    
    // Extraire le PID du variant ID s'il suit un pattern
    const match = firstVariantId.match(/variant-\d+-(\d+)/);
    if (match) {
      console.log('   PID potentiel extrait:', match[1]);
    }
  }
  
  await prisma.$disconnect();
}

checkRealProductId().catch(console.error);

