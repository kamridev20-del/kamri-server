const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function ensureCJSupplierExists() {
  // Vérifier si le fournisseur CJ Dropshipping existe
  let cjSupplier = await prisma.supplier.findFirst({
    where: { name: 'CJ Dropshipping' }
  });

  if (!cjSupplier) {
    console.log('🏢 Création automatique du fournisseur CJ Dropshipping...');
    cjSupplier = await prisma.supplier.create({
      data: {
        name: 'CJ Dropshipping',
        description: 'Fournisseur CJ Dropshipping pour vente réelle',
        apiUrl: 'https://developers.cjdropshipping.com',
        apiKey: 'cj-api-key',
        status: 'connected',
        lastSync: new Date(),
      }
    });
    console.log(`✅ Fournisseur CJ créé automatiquement avec ID: ${cjSupplier.id}`);
  } else {
    // S'assurer que le statut est 'connected' 
    if (cjSupplier.status !== 'connected') {
      await prisma.supplier.update({
        where: { id: cjSupplier.id },
        data: { 
          status: 'connected',
          lastSync: new Date(),
        }
      });
      console.log(`✅ Statut du fournisseur CJ mis à jour vers 'connected'`);
    }
  }

  return cjSupplier;
}

async function getStats() {
  console.log('📊 [TEST] getStats appelé');
  
  try {
    // S'assurer que le fournisseur CJ Dropshipping existe et est connecté
    try {
      console.log('📊 [TEST] Appel ensureCJSupplierExists...');
      await ensureCJSupplierExists();
      console.log('✅ [TEST] ensureCJSupplierExists terminé');
    } catch (error) {
      console.warn('⚠️ [TEST] Impossible de créer/vérifier le fournisseur CJ:', error.message);
      console.warn('   Stack:', error.stack);
    }
    
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    console.log('📊 [TEST] Exécution des requêtes Prisma avec Promise.all...');
    console.log('   Dates:', {
      now: now.toISOString(),
      currentMonthStart: currentMonthStart.toISOString(),
      lastMonthStart: lastMonthStart.toISOString(),
      lastMonthEnd: lastMonthEnd.toISOString(),
    });
    
    const startTime = Date.now();
    
    const [
      totalProducts,
      promoProducts,
      totalOrders,
      connectedSuppliers,
      totalUsers,
      activeUsers,
      totalRevenue,
      monthlyRevenue,
      // Statistiques du mois précédent pour comparaison
      lastMonthProducts,
      lastMonthPromoProducts,
      lastMonthOrders,
      lastMonthSuppliers,
      lastMonthRevenue,
    ] = await Promise.all([
      prisma.product.count({
        where: { status: 'active' },
      }),
      prisma.product.count({
        where: { 
          badge: 'promo',
          status: 'active'
        },
      }),
      prisma.order.count(),
      prisma.supplier.count({
        where: { status: 'connected' },
      }),
      prisma.user.count(),
      prisma.user.count({
        where: { status: 'active' },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { not: 'cancelled' } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'cancelled' },
          createdAt: {
            gte: currentMonthStart,
          },
        },
      }),
      // Mois précédent
      prisma.product.count({
        where: { 
          status: 'active',
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
      prisma.product.count({
        where: { 
          badge: 'promo',
          status: 'active',
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
      prisma.order.count({
        where: {
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
      prisma.supplier.count({
        where: { 
          status: 'connected',
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'cancelled' },
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
    ]);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('✅ [TEST] Requêtes Prisma terminées en', duration, 'ms');
    console.log('📊 [TEST] Résultats:', {
      totalProducts,
      promoProducts,
      totalOrders,
      connectedSuppliers,
      totalUsers,
      activeUsers,
      totalRevenue: totalRevenue?._sum?.total,
      monthlyRevenue: monthlyRevenue?._sum?.total,
      lastMonthProducts,
      lastMonthPromoProducts,
      lastMonthOrders,
      lastMonthSuppliers,
      lastMonthRevenue: lastMonthRevenue?._sum?.total,
    });

    // Calculer les pourcentages de changement
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const result = {
      totalProducts: totalProducts || 0,
      promoProducts: promoProducts || 0,
      totalOrders: totalOrders || 0,
      connectedSuppliers: connectedSuppliers || 0,
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      totalRevenue: totalRevenue?._sum?.total || 0,
      monthlyRevenue: monthlyRevenue?._sum?.total || 0,
      // Changements par rapport au mois précédent
      changes: {
        products: calculateChange(totalProducts || 0, lastMonthProducts || 0),
        promoProducts: calculateChange(promoProducts || 0, lastMonthPromoProducts || 0),
        orders: calculateChange(totalOrders || 0, lastMonthOrders || 0),
        suppliers: (connectedSuppliers || 0) - (lastMonthSuppliers || 0),
        revenue: calculateChange(monthlyRevenue?._sum?.total || 0, lastMonthRevenue?._sum?.total || 0),
      },
    };

    console.log('✅ [TEST] Stats calculées et retournées');
    console.log('📊 [TEST] Résultat final:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('❌ [TEST] Erreur dans getStats:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    console.error('   Code:', error.code);
    console.error('   Meta:', error.meta);
    throw error;
  }
}

async function testExactGetStats() {
  console.log('🔍 Test exact de getStats()...\n');
  
  try {
    await prisma.$connect();
    console.log('✅ Connexion à la base de données réussie\n');
    
    const result = await getStats();
    
    console.log('\n✅ Test réussi !');
    console.log('📊 Résultat:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('\n❌ Test échoué !');
    console.error('Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Déconnexion de la base de données');
  }
}

testExactGetStats()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script terminé avec erreur:', error);
    process.exit(1);
  });

