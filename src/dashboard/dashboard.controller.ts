import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Récupérer les statistiques du dashboard' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
  async getStats() {
    const controllerStartTime = Date.now();
    try {
      if (!this.isProduction) {
        this.logger.debug('📊 getStats appelé - Début');
      }
      const serviceStartTime = Date.now();
      const stats = await this.dashboardService.getStats();
      const serviceDuration = Date.now() - serviceStartTime;
      const totalDuration = Date.now() - controllerStartTime;
      
      // ✅ Logger seulement en dev ou si la requête est lente (>2s)
      if (!this.isProduction || totalDuration > 2000) {
        this.logger.log(`✅ getStats terminé en ${totalDuration}ms (service: ${serviceDuration}ms)`);
      }
      
      return stats;
    } catch (error) {
      const totalDuration = Date.now() - controllerStartTime;
      // ✅ Toujours logger les erreurs
      this.logger.error(`❌ Erreur dans getStats après ${totalDuration}ms:`, error instanceof Error ? error.message : String(error));
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
      if (!this.isProduction) {
        this.logger.debug('📊 getTopCategories appelé');
      }
      const categories = await this.dashboardService.getTopCategories();
      if (!this.isProduction) {
        this.logger.debug(`✅ Top catégories retournées: ${categories.length} catégories`);
      }
      return categories;
    } catch (error) {
      this.logger.error('❌ Erreur dans getTopCategories:', error instanceof Error ? error.message : String(error));
      // Retourner un tableau vide en cas d'erreur
      return [];
    }
  }
}
