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
  getStats() {
    return this.dashboardService.getStats();
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
  getTopCategories() {
    return this.dashboardService.getTopCategories();
  }
}
