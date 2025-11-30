import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Récupérer les statistiques du dashboard' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
  async getStats() {
    const controllerStartTime = Date.now();
    try {
      console.log('📊 [DashboardController] getStats appelé - Début');
      console.log('📊 [DashboardController] Appel dashboardService.getStats()...');
      const serviceStartTime = Date.now();
      const stats = await this.dashboardService.getStats();
      const serviceDuration = Date.now() - serviceStartTime;
      console.log(`✅ [DashboardController] dashboardService.getStats() terminé en ${serviceDuration}ms`);
      console.log('✅ [DashboardController] Stats retournées:', JSON.stringify(stats, null, 2));
      const totalDuration = Date.now() - controllerStartTime;
      console.log(`✅ [DashboardController] getStats terminé en ${totalDuration}ms total`);
      return stats;
    } catch (error) {
      const totalDuration = Date.now() - controllerStartTime;
      console.error(`❌ [DashboardController] Erreur dans getStats après ${totalDuration}ms:`, error);
      console.error('   Message:', error instanceof Error ? error.message : String(error));
      console.error('   Stack:', error instanceof Error ? error.stack : 'N/A');
      console.error('   Code:', (error as any)?.code);
      console.error('   Meta:', (error as any)?.meta);
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

  @Get('activity')
  @ApiOperation({ summary: 'Récupérer l\'activité récente' })
  @ApiResponse({ status: 200, description: 'Activité récente récupérée avec succès' })
  getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }

  @Get('sales-chart')
  @ApiOperation({ summary: 'Récupérer les données du graphique des ventes' })
  @ApiResponse({ status: 200, description: 'Données du graphique récupérées avec succès' })
  getSalesChart() {
    return this.dashboardService.getSalesChart();
  }

  @Get('top-categories')
  @ApiOperation({ summary: 'Récupérer les catégories les plus populaires' })
  @ApiResponse({ status: 200, description: 'Top catégories récupérées avec succès' })
  async getTopCategories() {
    try {
      console.log('📊 [DashboardController] getTopCategories appelé');
      const categories = await this.dashboardService.getTopCategories();
      console.log('✅ [DashboardController] Top catégories retournées:', categories);
      return categories;
    } catch (error) {
      console.error('❌ [DashboardController] Erreur dans getTopCategories:', error);
      // Retourner un tableau vide en cas d'erreur
      return [];
    }
  }
}
