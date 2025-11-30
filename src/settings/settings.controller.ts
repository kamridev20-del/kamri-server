import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('api/settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer les paramètres globaux' })
  @ApiResponse({ status: 200, description: 'Paramètres récupérés avec succès' })
  async getSettings() {
    try {
      console.log('⚙️ [SettingsController] getSettings appelé');
      const settings = await this.settingsService.getSettings();
      console.log('✅ [SettingsController] Settings récupérées');
      return settings;
    } catch (error) {
      console.error('❌ [SettingsController] Erreur dans getSettings:', error);
      // Retourner des valeurs par défaut en cas d'erreur
      return {
        id: '',
        theme: 'light',
        currency: 'EUR',
        language: 'fr',
        accentColor: '#4CAF50',
        companyName: 'KAMRI',
        companyEmail: 'admin@kamri.com',
        companyPhone: '+33 1 23 45 67 89',
        companyAddress: '',
        apiRateLimit: 1000,
      };
    }
  }

  @Put()
  @ApiOperation({ summary: 'Modifier les paramètres globaux' })
  @ApiResponse({ status: 200, description: 'Paramètres modifiés avec succès' })
  updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(updateSettingsDto);
  }

}
