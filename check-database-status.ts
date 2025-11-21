import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
  console.log('📊 === ÉTAT DE LA BASE DE DONNÉES ===\n');
  
  try {
    // Tables supprimées
    console.log('✅ TABLES NETTOYÉES:');
    console.log(`   Product: ${await prisma.product.count()}`);
    console.log(`   ProductVariant: ${await prisma.productVariant.count()}`);
    console.log(`   CategoryMapping: ${await prisma.categoryMapping.count()}`);
    console.log(`   WebhookLog: ${await prisma.webhookLog.count()}`);
    console.log(`   ProductUpdateNotification: ${await prisma.productUpdateNotification.count()}`);
    console.log(`   UnmappedExternalCategory: ${await prisma.unmappedExternalCategory.count()}`);
    console.log(`   CJProductStore: ${await prisma.cJProductStore.count()}`);
    console.log(`   CJProductMapping: ${await prisma.cJProductMapping.count()}`);
    console.log(`   OrderItem: ${await prisma.orderItem.count()}`);
    console.log(`   CartItem: ${await prisma.cartItem.count()}`);
    console.log(`   Wishlist: ${await prisma.wishlist.count()}`);
    console.log(`   Review: ${await prisma.review.count()}`);
    console.log(`   Image: ${await prisma.image.count()}`);
    
    console.log('\n✅ TABLES CONSERVÉES:');
    console.log(`   User: ${await prisma.user.count()}`);
    console.log(`   Category: ${await prisma.category.count()}`);
    console.log(`   Supplier: ${await prisma.supplier.count()}`);
    console.log(`   Order: ${await prisma.order.count()}`);
    console.log(`   Settings: ${await prisma.settings.count()}`);
    
    console.log('\n🎉 Base de données prête pour réimport !');
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStatus();

