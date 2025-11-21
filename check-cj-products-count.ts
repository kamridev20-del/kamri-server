import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCJProducts() {
  console.log('🔍 === VÉRIFICATION PRODUITS CJ ===\n');
  
  const totalProducts = await prisma.product.count();
  console.log(`📦 Total produits: ${totalProducts}`);
  
  const cjProducts = await prisma.product.count({
    where: {
      cjProductId: { not: null },
      source: 'cj-dropshipping'
    }
  });
  console.log(`🏷️  Produits CJ (avec cjProductId): ${cjProducts}`);
  
  const cjProductsWithVariants = await prisma.product.count({
    where: {
      cjProductId: { not: null },
      source: 'cj-dropshipping',
      productVariants: {
        some: {}
      }
    }
  });
  console.log(`📊 Produits CJ avec variants: ${cjProductsWithVariants}`);
  
  // Quelques exemples
  const examples = await prisma.product.findMany({
    where: {
      cjProductId: { not: null },
      source: 'cj-dropshipping'
    },
    select: {
      id: true,
      name: true,
      cjProductId: true,
      _count: {
        select: { productVariants: true }
      }
    },
    take: 5
  });
  
  console.log('\n📋 Exemples de produits CJ:');
  for (const product of examples) {
    console.log(`   - ${product.name.substring(0, 40)}...`);
    console.log(`     ID: ${product.id}`);
    console.log(`     CJ PID: ${product.cjProductId}`);
    console.log(`     Variants: ${product._count.productVariants}`);
    console.log('');
  }
  
  await prisma.$disconnect();
}

checkCJProducts().catch(console.error);

