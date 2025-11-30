import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DuplicatePreventionService } from './services/duplicate-prevention.service';

@ApiTags('duplicate-prevention')
@Controller('api/duplicates')
export class DuplicatePreventionController {
  constructor(private duplicateService: DuplicatePreventionService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Obtenir les statistiques de doublons' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
  async getDuplicateStats() {
    try {
      console.log('📊 [DuplicateController] getDuplicateStats appelé');
      const stats = await this.duplicateService.getDuplicateStats();
      console.log('✅ [DuplicateController] Stats retournées');
      return stats;
    } catch (error) {
      console.error('❌ [DuplicateController] Erreur dans getDuplicateStats:', error);
      // Retourner des valeurs par défaut en cas d'erreur
      return {
        totalProducts: 0,
        cjProducts: 0,
        duplicatesFound: 0,
        lastImports: [],
      };
    }
  }
}