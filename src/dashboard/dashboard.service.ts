import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { VisitsService } from '../visits/visits.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(
    private prisma: PrismaService,
    private suppliersService: SuppliersService,
    private visitsService: VisitsService,
  ) {}

  async getStats() {
    const startTime = Date.now();
    try {
      if (!this.isProduction) {
        this.logger.debug('📊 getStats appelé');
      }
      
      // S'assurer que le fournisseur CJ Dropshipping existe et est connecté
      try {
        if (!this.isProduction) {
          this.logger.debug('📊 Appel ensureCJSupplierExists...');
        }
        const supplierStart = Date.now();
        await this.suppliersService.ensureCJSupplierExists();
        const supplierDuration = Date.now() - supplierStart;
        if (!this.isProduction || supplierDuration > 1000) {
          this.logger.debug(`✅ ensureCJSupplierExists terminé en ${supplierDuration}ms`);
        }
      } catch (error) {
        this.logger.warn('⚠️ Impossible de créer/vérifier le fournisseur CJ:', error instanceof Error ? error.message : String(error));
      }
      
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      
      if (!this.isProduction) {
        this.logger.debug('📊 Exécution des requêtes Prisma...');
      }
      
      const queryStartTime = Date.now();
      if (!this.isProduction) {
        this.logger.debug('📊 Début Promise.all...');
      }
      
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
      // ✅ Logger seulement si la requête est lente (>2s) ou en dev
      if (!this.isProduction || queryDuration > 2000) {
        this.logger.log(`✅ Requêtes Prisma terminées en ${queryDuration}ms`);
      }

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
      // ✅ Logger seulement si la requête est lente (>2s) ou en dev
      if (!this.isProduction || totalDuration > 2000) {
        this.logger.log(`✅ Stats calculées et retournées en ${totalDuration}ms total`);
      }
      return result;
    } catch (error) {
      // ✅ Toujours logger les erreurs
      this.logger.error('❌ Erreur dans getStats:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        this.logger.error(`   Stack: ${error.stack}`);
      }
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

  /**
   * Récupère les statistiques de visites par pays
   */
  async getVisitStatsByCountry(days: number = 30) {
    try {
      return await this.visitsService.getVisitStatsByCountry(days);
    } catch (error) {
      this.logger.error('❌ Erreur récupération stats visites par pays:', error);
      return [];
    }
  }

  /**
   * Récupère les dernières visites
   */
  async getRecentVisits(limit: number = 20) {
    try {
      return await this.visitsService.getRecentVisits(limit);
    } catch (error) {
      this.logger.error('❌ Erreur récupération visites récentes:', error);
      return [];
    }
  }

  /**
   * Récupère les totaux de visites
   */
  async getVisitTotals(days?: number) {
    try {
      const [totalVisits, uniqueVisitors] = await Promise.all([
        this.visitsService.getTotalVisits(days),
        this.visitsService.getUniqueVisitors(days),
      ]);

      return {
        totalVisits,
        uniqueVisitors,
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération totaux visites:', error);
      return {
        totalVisits: 0,
        uniqueVisitors: 0,
      };
    }
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
      if (!this.isProduction) {
        this.logger.debug('📊 getTopCategories appelé');
      }
      
      // ✅ Récupérer toutes les catégories
      const categories = await this.prisma.category.findMany({
        take: 20, // Prendre plus pour avoir un meilleur tri
      });

      if (!this.isProduction) {
        this.logger.debug(`${categories.length} catégories trouvées`);
      }

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
            this.logger.error(`❌ Erreur comptage produits catégorie ${category.id}:`, error instanceof Error ? error.message : String(error));
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

      if (!this.isProduction) {
        this.logger.debug(`✅ Top catégories retournées: ${sorted.length} catégories`);
      }
      return sorted;
    } catch (error) {
      this.logger.error('❌ Erreur dans getTopCategories:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        this.logger.error(`   Stack: ${error.stack}`);
      }
      // Retourner un tableau vide en cas d'erreur
      return [];
    }
  }
}
