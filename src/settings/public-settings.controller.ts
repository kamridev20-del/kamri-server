import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('public-settings')
@Controller('api/settings')
export class PublicSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('company-info')
  @ApiOperation({ summary: 'Récupérer les informations de l\'entreprise (public)' })
  @ApiResponse({ status: 200, description: 'Informations de l\'entreprise récupérées avec succès' })
  getCompanyInfo() {
    return this.settingsService.getCompanyInfo();
  }
}
