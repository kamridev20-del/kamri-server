import { Controller, Post, Get, Body, Query, Req, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { VisitsService, CreateVisitDto } from './visits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@ApiTags('visits')
@Controller('api/visits')
export class VisitsController {
  private readonly logger = new Logger(VisitsController.name);

  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer une visite (public)' })
  @ApiResponse({ status: 201, description: 'Visite enregistrée avec succès' })
  async createVisit(@Body() dto: CreateVisitDto, @Req() req: any): Promise<{ success: boolean }> {
    try {
      // Extraire l'IP réelle du client
      const forwardedFor = req.headers['x-forwarded-for'];
      const clientIP = dto.ip || 
                       (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
                       req.headers['x-real-ip'] ||
                       req.ip || 
                       req.connection?.remoteAddress ||
                       null;

      // Extraire le User-Agent
      const userAgent = dto.userAgent || req.headers['user-agent'] || null;

      // Extraire la langue
      const language = dto.language || req.headers['accept-language']?.split(',')[0] || null;

      // Extraire le referer
      const referer = dto.referer || req.headers['referer'] || null;

      await this.visitsService.createVisit({
        ...dto,
        ip: clientIP,
        userAgent,
        language,
        referer,
      });

      return { success: true };
    } catch (error) {
      this.logger.error('❌ Erreur enregistrement visite:', error);
      return { success: false };
    }
  }

  @Get('stats/by-country')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les statistiques de visites par pays (admin)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Nombre de jours (défaut: 30)' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
  async getVisitStatsByCountry(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days, 10) : 30;
    return this.visitsService.getVisitStatsByCountry(daysNumber);
  }

  @Get('recent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les dernières visites (admin)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de visites (défaut: 50)' })
  @ApiResponse({ status: 200, description: 'Visites récentes récupérées avec succès' })
  async getRecentVisits(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 50;
    return this.visitsService.getRecentVisits(limitNumber);
  }

  @Get('totals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les totaux de visites (admin)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Nombre de jours (optionnel)' })
  @ApiResponse({ status: 200, description: 'Totaux récupérés avec succès' })
  async getTotals(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days, 10) : undefined;
    const [totalVisits, uniqueVisitors] = await Promise.all([
      this.visitsService.getTotalVisits(daysNumber),
      this.visitsService.getUniqueVisitors(daysNumber),
    ]);

    return {
      totalVisits,
      uniqueVisitors,
      period: daysNumber ? `last_${daysNumber}_days` : 'all_time',
    };
  }
}

