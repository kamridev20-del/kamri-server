import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SuppliersService } from '../suppliers/suppliers.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private suppliersService: SuppliersService
  ) {}

  async getStats() {
    const startTime = Date.now();
    try {
      console.log('📊 [DashboardService] getStats appelé');
      
      // S'assurer que le fournisseur CJ Dropshipping existe et est connecté
      try {
        console.log('📊 [DashboardService] Appel ensureCJSupplierExists...');
        const supplierStart = Date.now();
        await this.suppliersService.ensureCJSupplierExists();
        console.log(`✅ [DashboardService] ensureCJSupplierExists terminé en ${Date.now() - supplierStart}ms`);
      } catch (error) {
        console.warn('⚠️ [DashboardService] Impossible de créer/vérifier le fournisseur CJ:', error);
        console.warn('   Stack:', error instanceof Error ? error.stack : 'N/A');
      }
      
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      
      console.log('📊 [DashboardService] Exécution des requêtes Prisma...');
      console.log('📊 [DashboardService] Dates calculées:', {
        now: now.toISOString(),
        currentMonthStart: currentMonthStart.toISOString(),
        lastMonthStart: lastMonthStart.toISOString(),
        lastMonthEnd: lastMonthEnd.toISOString(),
      });
      
      const queryStartTime = Date.now();
      console.log('📊 [DashboardService] Début Promise.all...');
      
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
      this.prisma.product.count({
        where: { status: 'active' },
      }),
      this.prisma.product.count({
        where: { 
          badge: 'promo',
          status: 'active'
        },
      }),
      this.prisma.order.count(),
      this.prisma.supplier.count({
        where: { status: 'connected' },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { status: 'active' },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { not: 'cancelled' } },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'cancelled' },
          createdAt: {
            gte: currentMonthStart,
          },
        },
      }),
      // Mois précédent
      this.prisma.product.count({
        where: { 
          status: 'active',
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
      this.prisma.product.count({
        where: { 
          badge: 'promo',
          status: 'active',
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
      this.prisma.supplier.count({
        where: { 
          status: 'connected',
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
      this.prisma.order.aggregate({
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

      const queryDuration = Date.now() - queryStartTime;
      console.log(`✅ [DashboardService] Requêtes Prisma terminées en ${queryDuration}ms`);
      console.log('📊 [DashboardService] Résultats:', {
        totalProducts,
        promoProducts,
        totalOrders,
        connectedSuppliers,
        totalUsers,
        activeUsers,
        totalRevenue: totalRevenue?._sum?.total,
        monthlyRevenue: monthlyRevenue?._sum?.total,
      });

      // Calculer les pourcentages de changement
      const calculateChange = (current: number, previous: number) => {
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
          suppliers: (connectedSuppliers || 0) - (lastMonthSuppliers || 0), // Différence absolue pour les fournisseurs
          revenue: calculateChange(monthlyRevenue?._sum?.total || 0, lastMonthRevenue?._sum?.total || 0),
        },
      };

      const totalDuration = Date.now() - startTime;
      console.log(`✅ [DashboardService] Stats calculées et retournées en ${totalDuration}ms total`);
      return result;
    } catch (error) {
      console.error('❌ [DashboardService] Erreur dans getStats:', error);
      console.error('❌ [DashboardService] Stack:', error instanceof Error ? error.stack : 'N/A');
      console.error('❌ [DashboardService] Message:', error instanceof Error ? error.message : String(error));
      // Retourner des valeurs par défaut en cas d'erreur
      return {
        totalProducts: 0,
        promoProducts: 0,
        totalOrders: 0,
        connectedSuppliers: 0,
        totalUsers: 0,
        activeUsers: 0,
        totalRevenue: 0,
        monthlyRevenue: 0,
        changes: {
          products: 0,
          promoProducts: 0,
          orders: 0,
          suppliers: 0,
          revenue: 0,
        },
      };
    }
  }

  async getRecentActivity() {
    const recentOrders = await this.prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true },
        },
        items: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
    });

    const recentProducts = await this.prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: { name: true },
        },
        supplier: {
          select: { name: true },
        },
      },
    });

    return {
      recentOrders,
      recentProducts,
    };
  }

  async getSalesChart() {
    const last12Months = [];
    const currentDate = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);

      const revenue = await this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'cancelled' },
          createdAt: {
            gte: date,
            lt: nextMonth,
          },
        },
      });

      last12Months.push({
        month: date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        revenue: revenue._sum.total || 0,
      });
    }

    return last12Months;
  }

  async getTopCategories() {
    try {
      console.log('📊 [DashboardService] getTopCategories appelé');
      
      // ✅ Récupérer toutes les catégories
      const categories = await this.prisma.category.findMany({
        take: 20, // Prendre plus pour avoir un meilleur tri
      });

      console.log(`📊 [DashboardService] ${categories.length} catégories trouvées`);

      // ✅ Compter les produits actifs pour chaque catégorie
      const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
          try {
            const activeCount = await this.prisma.product.count({
              where: {
                categoryId: category.id,
                status: 'active',
              },
            });
            return {
              name: category.name,
              productCount: activeCount,
            };
          } catch (error) {
            console.error(`❌ [DashboardService] Erreur comptage produits catégorie ${category.id}:`, error);
            return {
              name: category.name,
              productCount: 0,
            };
          }
        })
      );

      // ✅ Trier par nombre de produits actifs (décroissant) et prendre les 7 premiers
      const sorted = categoriesWithCount
        .sort((a, b) => b.productCount - a.productCount)
        .slice(0, 7);

      console.log(`✅ [DashboardService] Top catégories retournées:`, sorted);
      return sorted;
    } catch (error) {
      console.error('❌ [DashboardService] Erreur dans getTopCategories:', error);
      console.error('❌ [DashboardService] Stack:', error instanceof Error ? error.stack : 'N/A');
      // Retourner un tableau vide en cas d'erreur
      return [];
    }
  }
}
