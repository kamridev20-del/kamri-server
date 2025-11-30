const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function testDashboardStats() {
  console.log('🔍 Début du diagnostic des erreurs de stats...\n');
  
  try {
    // Test 1: Connexion à la base de données
    console.log('📊 Test 1: Connexion à la base de données...');
    await prisma.$connect();
    console.log('✅ Connexion réussie\n');

    // Test 2: Compter les produits actifs
    console.log('📊 Test 2: Compter les produits actifs...');
    try {
      const totalProducts = await prisma.product.count({
        where: { status: 'active' },
      });
      console.log(`✅ Produits actifs: ${totalProducts}\n`);
    } catch (error) {
      console.error('❌ Erreur comptage produits actifs:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 3: Compter les produits promo
    console.log('📊 Test 3: Compter les produits promo...');
    try {
      const promoProducts = await prisma.product.count({
        where: { 
          badge: 'promo',
          status: 'active'
        },
      });
      console.log(`✅ Produits promo: ${promoProducts}\n`);
    } catch (error) {
      console.error('❌ Erreur comptage produits promo:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 4: Compter les commandes
    console.log('📊 Test 4: Compter les commandes...');
    try {
      const totalOrders = await prisma.order.count();
      console.log(`✅ Commandes totales: ${totalOrders}\n`);
    } catch (error) {
      console.error('❌ Erreur comptage commandes:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 5: Compter les fournisseurs connectés
    console.log('📊 Test 5: Compter les fournisseurs connectés...');
    try {
      const connectedSuppliers = await prisma.supplier.count({
        where: { status: 'connected' },
      });
      console.log(`✅ Fournisseurs connectés: ${connectedSuppliers}\n`);
    } catch (error) {
      console.error('❌ Erreur comptage fournisseurs:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 6: Compter les utilisateurs
    console.log('📊 Test 6: Compter les utilisateurs...');
    try {
      const totalUsers = await prisma.user.count();
      console.log(`✅ Utilisateurs totaux: ${totalUsers}\n`);
    } catch (error) {
      console.error('❌ Erreur comptage utilisateurs:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 7: Compter les utilisateurs actifs
    console.log('📊 Test 7: Compter les utilisateurs actifs...');
    try {
      const activeUsers = await prisma.user.count({
        where: { status: 'active' },
      });
      console.log(`✅ Utilisateurs actifs: ${activeUsers}\n`);
    } catch (error) {
      console.error('❌ Erreur comptage utilisateurs actifs:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 8: Agrégation revenus totaux
    console.log('📊 Test 8: Agrégation revenus totaux...');
    try {
      const totalRevenue = await prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { not: 'cancelled' } },
      });
      console.log(`✅ Revenus totaux: ${totalRevenue?._sum?.total || 0}\n`);
    } catch (error) {
      console.error('❌ Erreur agrégation revenus:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 9: Agrégation revenus du mois
    console.log('📊 Test 9: Agrégation revenus du mois...');
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyRevenue = await prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'cancelled' },
          createdAt: {
            gte: currentMonthStart,
          },
        },
      });
      console.log(`✅ Revenus du mois: ${monthlyRevenue?._sum?.total || 0}\n`);
    } catch (error) {
      console.error('❌ Erreur agrégation revenus du mois:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 10: Vérifier le schéma de la table Product
    console.log('📊 Test 10: Vérifier le schéma de la table Product...');
    try {
      const sampleProduct = await prisma.product.findFirst({
        select: {
          id: true,
          name: true,
          status: true,
          badge: true,
          createdAt: true,
        },
      });
      if (sampleProduct) {
        console.log('✅ Schéma Product OK');
        console.log(`   Exemple: ${JSON.stringify(sampleProduct, null, 2)}\n`);
      } else {
        console.log('⚠️ Aucun produit trouvé dans la base\n');
      }
    } catch (error) {
      console.error('❌ Erreur vérification schéma Product:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 11: Vérifier le schéma de la table Order
    console.log('📊 Test 11: Vérifier le schéma de la table Order...');
    try {
      const sampleOrder = await prisma.order.findFirst({
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
        },
      });
      if (sampleOrder) {
        console.log('✅ Schéma Order OK');
        console.log(`   Exemple: ${JSON.stringify(sampleOrder, null, 2)}\n`);
      } else {
        console.log('⚠️ Aucune commande trouvée dans la base\n');
      }
    } catch (error) {
      console.error('❌ Erreur vérification schéma Order:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 12: Vérifier le schéma de la table Supplier
    console.log('📊 Test 12: Vérifier le schéma de la table Supplier...');
    try {
      const sampleSupplier = await prisma.supplier.findFirst({
        select: {
          id: true,
          name: true,
          status: true,
        },
      });
      if (sampleSupplier) {
        console.log('✅ Schéma Supplier OK');
        console.log(`   Exemple: ${JSON.stringify(sampleSupplier, null, 2)}\n`);
      } else {
        console.log('⚠️ Aucun fournisseur trouvé dans la base\n');
      }
    } catch (error) {
      console.error('❌ Erreur vérification schéma Supplier:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 13: Test Promise.all (comme dans le code réel)
    console.log('📊 Test 13: Test Promise.all (simulation du code réel)...');
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const results = await Promise.all([
        prisma.product.count({ where: { status: 'active' } }),
        prisma.product.count({ where: { badge: 'promo', status: 'active' } }),
        prisma.order.count(),
        prisma.supplier.count({ where: { status: 'connected' } }),
        prisma.user.count(),
        prisma.user.count({ where: { status: 'active' } }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { status: { not: 'cancelled' } },
        }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: {
            status: { not: 'cancelled' },
            createdAt: { gte: currentMonthStart },
          },
        }),
      ]);

      console.log('✅ Promise.all réussi');
      console.log(`   Résultats: ${JSON.stringify(results, null, 2)}\n`);
    } catch (error) {
      console.error('❌ Erreur Promise.all:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 14: Test getTopCategories
    console.log('📊 Test 14: Test getTopCategories...');
    try {
      const categories = await prisma.category.findMany({ take: 20 });
      console.log(`✅ ${categories.length} catégories trouvées`);

      const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
          try {
            const activeCount = await prisma.product.count({
              where: { categoryId: category.id, status: 'active' },
            });
            return { name: category.name, productCount: activeCount };
          } catch (catError) {
            console.error(`   ⚠️ Erreur pour catégorie ${category.name}:`, catError.message);
            return { name: category.name, productCount: 0 };
          }
        })
      );

      console.log(`✅ Top catégories calculées: ${categoriesWithCount.length}\n`);
    } catch (error) {
      console.error('❌ Erreur getTopCategories:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 15: Test getProfile
    console.log('📊 Test 15: Test getProfile...');
    try {
      const user = await prisma.user.findFirst({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });
      if (user) {
        console.log('✅ Profil utilisateur récupéré');
        console.log(`   Utilisateur: ${user.email}\n`);
      } else {
        console.log('⚠️ Aucun utilisateur trouvé\n');
      }
    } catch (error) {
      console.error('❌ Erreur getProfile:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 16: Test getSettings
    console.log('📊 Test 16: Test getSettings...');
    try {
      const settings = await prisma.settings.findFirst();
      if (settings) {
        console.log('✅ Settings récupérées');
        console.log(`   Company: ${settings.companyName}\n`);
      } else {
        console.log('⚠️ Aucun settings trouvé\n');
      }
    } catch (error) {
      console.error('❌ Erreur getSettings:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    // Test 17: Test getDuplicateStats
    console.log('📊 Test 17: Test getDuplicateStats...');
    try {
      const [totalProducts, cjProducts, recentImports] = await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { source: 'cj-dropshipping' } }),
        prisma.product.findMany({
          where: { 
            lastImportAt: { not: null },
            source: 'cj-dropshipping'
          },
          orderBy: { lastImportAt: 'desc' },
          take: 10,
          select: {
            id: true,
            name: true,
            importStatus: true,
            lastImportAt: true,
            cjProductId: true
          }
        })
      ]);

      console.log('✅ getDuplicateStats réussi');
      console.log(`   Total produits: ${totalProducts}`);
      console.log(`   Produits CJ: ${cjProducts}`);
      console.log(`   Imports récents: ${recentImports.length}\n`);
    } catch (error) {
      console.error('❌ Erreur getDuplicateStats:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      console.log('');
    }

    console.log('✅ Diagnostic terminé !');

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    console.error('   Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Déconnexion de la base de données');
  }
}

// Exécuter le diagnostic
testDashboardStats()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script terminé avec erreur:', error);
    process.exit(1);
  });


