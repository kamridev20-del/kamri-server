import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserSettingsService } from './user-settings.service';

@ApiTags('user-settings')
@Controller('api/user-settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserSettingsController {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer les paramètres de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Paramètres récupérés avec succès' })
  async getUserSettings(@GetUser() user: any) {
    return this.userSettingsService.getUserSettings(user.userId);
  }

  @Put()
  @ApiOperation({ summary: 'Mettre à jour les paramètres de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Paramètres mis à jour avec succès' })
  async updateUserSettings(
    @GetUser() user: any,
    @Body() settingsData: {
      notifications?: {
        email?: boolean;
        sms?: boolean;
        push?: boolean;
        marketing?: boolean;
      };
      privacy?: {
        profileVisible?: boolean;
        orderHistory?: boolean;
        dataSharing?: boolean;
      };
      preferences?: {
        theme?: string;
        language?: string;
        currency?: string;
      };
    }
  ) {
    return this.userSettingsService.updateUserSettings(user.userId, settingsData);
  }

  @Delete('account')
  @ApiOperation({ summary: 'Supprimer le compte utilisateur' })
  @ApiResponse({ status: 200, description: 'Compte supprimé avec succès' })
  async deleteUserAccount(@GetUser() user: any) {
    return this.userSettingsService.deleteUserAccount(user.userId);
  }
}
