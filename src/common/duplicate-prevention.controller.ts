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
    return this.duplicateService.getDuplicateStats();
  }
}