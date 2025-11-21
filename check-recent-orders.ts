import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecentOrders() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🔍 VÉRIFICATION COMMANDES RÉCENTES');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Commandes des dernières 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: tenMinutesAgo,
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                cjMapping: true,
                productVariants: {
                  where: {
                    isActive: true,
                    cjVariantId: { not: null },
                  },
                },
              },
            },
          },
        },
        cjMapping: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    if (orders.length === 0) {
      console.log('ℹ️ Aucune commande créée dans les 10 dernières minutes');
      console.log('\n💡 Pour tester, créez une commande via:');
      console.log('   - Frontend admin: /admin/products');
      console.log('   - API: POST /api/orders');
      return;
    }

    console.log(`✅ ${orders.length} commande(s) trouvée(s):\n`);

    for (const order of orders) {
      console.log(`📦 Commande: ${order.id}`);
      console.log(`   Créée le: ${order.createdAt.toLocaleString()}`);
      console.log(`   Total: ${order.total}€`);
      console.log(`   Statut: ${order.status}`);
      console.log(`   Items: ${order.items.length}`);

      // Vérifier produits CJ
      const hasCJ = order.items.some(item => 
        item.product.cjMapping !== null || 
        (item.product.cjProductId !== null && item.product.source === 'cj-dropshipping')
      );

      console.log(`   Produits CJ: ${hasCJ ? '✅ OUI' : '❌ NON'}`);

      // Vérifier mapping CJ
      if (order.cjMapping) {
        console.log(`   ✅ Commande CJ créée:`);
        console.log(`      CJ Order ID: ${order.cjMapping.cjOrderId}`);
        console.log(`      CJ Order Number: ${order.cjMapping.cjOrderNumber}`);
        console.log(`      Statut CJ: ${order.cjMapping.status}`);
        console.log(`      Tracking: ${order.cjMapping.trackNumber || 'N/A'}`);
      } else if (hasCJ) {
        console.log(`   ⚠️ Commande CJ NON créée (mais devrait l'être)`);
        console.log(`   💡 Créez-la manuellement:`);
        console.log(`      POST /api/orders/${order.id}/create-cj`);
      } else {
        console.log(`   ℹ️ Pas de produits CJ - skip normal`);
      }

      // Détails des items
      console.log(`   Items:`);
      for (const item of order.items) {
        const isCJ = item.product.cjMapping !== null || 
                    (item.product.cjProductId !== null && item.product.source === 'cj-dropshipping');
        console.log(`      - ${item.product.name} (${isCJ ? 'CJ' : 'Non-CJ'})`);
        if (isCJ) {
          console.log(`        CJ Product ID: ${item.product.cjProductId}`);
          console.log(`        Variants CJ: ${item.product.productVariants.length}`);
          if (item.product.productVariants.length > 0) {
            console.log(`        VID: ${item.product.productVariants[0].cjVariantId}`);
          }
        }
      }

      console.log('');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentOrders();

