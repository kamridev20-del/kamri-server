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
    // S'assurer que le fournisseur CJ Dropshipping existe et est connecté
    try {
      await this.suppliersService.ensureCJSupplierExists();
    } catch (error) {
      console.warn('Impossible de créer/vérifier le fournisseur CJ:', error);
    }
    
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
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

    // Calculer les pourcentages de changement
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      totalProducts,
      promoProducts,
      totalOrders,
      connectedSuppliers,
      totalUsers,
      activeUsers,
      totalRevenue: totalRevenue._sum.total || 0,
      monthlyRevenue: monthlyRevenue._sum.total || 0,
      // Changements par rapport au mois précédent
      changes: {
        products: calculateChange(totalProducts, lastMonthProducts),
        promoProducts: calculateChange(promoProducts, lastMonthPromoProducts),
        orders: calculateChange(totalOrders, lastMonthOrders),
        suppliers: connectedSuppliers - lastMonthSuppliers, // Différence absolue pour les fournisseurs
        revenue: calculateChange(monthlyRevenue._sum.total || 0, lastMonthRevenue._sum.total || 0),
      },
    };
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
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: { 
            products: {
              where: { status: 'active' }
            }
          },
        },
      },
      orderBy: {
        products: {
          _count: 'desc',
        },
      },
      take: 7,
    });

    return categories.map(category => ({
      name: category.name,
      productCount: category._count.products,
    }));
  }
}
