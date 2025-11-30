import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoLocationService } from '../geo/geo.service';

export interface CreateVisitDto {
  ip?: string;
  countryCode?: string;
  countryName?: string;
  city?: string;
  region?: string;
  userAgent?: string;
  path?: string;
  referer?: string;
  language?: string;
  userId?: string;
  isAuthenticated?: boolean;
}

export interface VisitStats {
  countryCode: string;
  countryName: string;
  visitCount: number;
  uniqueVisitors: number;
  lastVisit: Date;
}

export interface RecentVisit {
  id: string;
  countryCode: string;
  countryName: string;
  city?: string;
  path?: string;
  createdAt: Date;
  isAuthenticated: boolean;
}

@Injectable()
export class VisitsService {
  private readonly logger = new Logger(VisitsService.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(
    private prisma: PrismaService,
    private geoService: GeoLocationService,
  ) {}

  /**
   * Enregistre une visite
   * Détecte automatiquement le pays si non fourni
   */
  async createVisit(dto: CreateVisitDto): Promise<void> {
    try {
      // Si le pays n'est pas fourni, le détecter depuis l'IP
      let countryCode = dto.countryCode;
      let countryName = dto.countryName;

      if (!countryCode && dto.ip) {
        const geoResult = await this.geoService.detectCountryFromIP(dto.ip);
        if (geoResult) {
          countryCode = geoResult.countryCode;
          countryName = geoResult.countryName;
        }
      }

      // Fallback si toujours pas de pays
      if (!countryCode) {
        countryCode = 'FR';
        countryName = 'France';
      }

      // Enregistrer la visite (de manière asynchrone pour ne pas bloquer)
      this.prisma.visit
        .create({
          data: {
            ip: dto.ip || null,
            countryCode,
            countryName: countryName || countryCode,
            city: dto.city || null,
            region: dto.region || null,
            userAgent: dto.userAgent || null,
            path: dto.path || null,
            referer: dto.referer || null,
            language: dto.language || null,
            userId: dto.userId || null,
            isAuthenticated: dto.isAuthenticated || false,
          },
        })
        .catch((error) => {
          // Logger l'erreur mais ne pas bloquer la requête
          if (!this.isProduction) {
            this.logger.error('❌ Erreur enregistrement visite:', error);
          }
        });

      if (!this.isProduction) {
        this.logger.debug(`✅ Visite enregistrée: ${countryCode} - ${dto.path || '/'}`);
      }
    } catch (error) {
      // Ne pas faire échouer la requête si l'enregistrement de visite échoue
      if (!this.isProduction) {
        this.logger.error('❌ Erreur création visite:', error);
      }
    }
  }

  /**
   * Récupère les statistiques de visites par pays
   */
  async getVisitStatsByCountry(
    days: number = 30,
  ): Promise<VisitStats[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Agrégation par pays
      const visits = await this.prisma.visit.groupBy({
        by: ['countryCode'],
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        _count: {
          id: true,
        },
        _max: {
          createdAt: true,
        },
      });

      // Récupérer les noms de pays et compter les visiteurs uniques
      const stats: VisitStats[] = await Promise.all(
        visits.map(async (visit) => {
          const countryName = this.geoService.getCountryName(visit.countryCode);
          
          // Compter les visiteurs uniques (par IP ou userId)
          const uniqueVisitors = await this.prisma.visit.groupBy({
            by: ['ip', 'userId'],
            where: {
              countryCode: visit.countryCode,
              createdAt: {
                gte: startDate,
              },
            },
          }).then((groups) => {
            // Compter les groupes uniques (en excluant les null)
            const uniqueSet = new Set<string>();
            groups.forEach((group) => {
              const key = group.userId || group.ip || 'anonymous';
              uniqueSet.add(key);
            });
            return uniqueSet.size;
          });

          return {
            countryCode: visit.countryCode,
            countryName,
            visitCount: visit._count.id,
            uniqueVisitors,
            lastVisit: visit._max.createdAt || new Date(),
          };
        }),
      );

      // Trier par nombre de visites décroissant
      return stats.sort((a, b) => b.visitCount - a.visitCount);
    } catch (error) {
      this.logger.error('❌ Erreur récupération stats visites:', error);
      return [];
    }
  }

  /**
   * Récupère les dernières visites
   */
  async getRecentVisits(limit: number = 50): Promise<RecentVisit[]> {
    try {
      const visits = await this.prisma.visit.findMany({
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          countryCode: true,
          countryName: true,
          city: true,
          path: true,
          createdAt: true,
          isAuthenticated: true,
        },
      });

      return visits.map((visit) => ({
        id: visit.id,
        countryCode: visit.countryCode,
        countryName: visit.countryName,
        city: visit.city || undefined,
        path: visit.path || undefined,
        createdAt: visit.createdAt,
        isAuthenticated: visit.isAuthenticated,
      }));
    } catch (error) {
      this.logger.error('❌ Erreur récupération visites récentes:', error);
      return [];
    }
  }

  /**
   * Récupère le nombre total de visites
   */
  async getTotalVisits(days?: number): Promise<number> {
    try {
      const where: any = {};
      if (days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        where.createdAt = {
          gte: startDate,
        };
      }

      return await this.prisma.visit.count({ where });
    } catch (error) {
      this.logger.error('❌ Erreur comptage visites:', error);
      return 0;
    }
  }

  /**
   * Récupère le nombre de visiteurs uniques
   */
  async getUniqueVisitors(days?: number): Promise<number> {
    try {
      const where: any = {};
      if (days) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        where.createdAt = {
          gte: startDate,
        };
      }

      // Compter les combinaisons uniques de IP/userId
      const groups = await this.prisma.visit.groupBy({
        by: ['ip', 'userId'],
        where,
      });

      const uniqueSet = new Set<string>();
      groups.forEach((group) => {
        const key = group.userId || group.ip || 'anonymous';
        uniqueSet.add(key);
      });

      return uniqueSet.size;
    } catch (error) {
      this.logger.error('❌ Erreur comptage visiteurs uniques:', error);
      return 0;
    }
  }
}

