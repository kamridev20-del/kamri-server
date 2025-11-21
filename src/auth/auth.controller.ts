import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GetUser } from './get-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Connexion utilisateur (email + mot de passe pour admin)' })
  @ApiResponse({ status: 200, description: 'Connexion réussie' })
  @ApiResponse({ status: 401, description: 'Email ou mot de passe invalide' })
  async login(@Body() body: { email: string; password?: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  @ApiOperation({ summary: 'Inscription utilisateur' })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès' })
  @ApiResponse({ status: 400, description: 'Email déjà utilisé' })
  async register(@Body() body: { email: string; name: string; password?: string; role?: string }) {
    return this.authService.register(body.email, body.name, body.password, body.role);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer le profil utilisateur' })
  @ApiResponse({ status: 200, description: 'Profil récupéré avec succès' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async getProfile(@GetUser() user: any) {
    return this.authService.getProfile(user.userId);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour le profil utilisateur' })
  @ApiResponse({ status: 200, description: 'Profil mis à jour avec succès' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async updateProfile(@GetUser() user: any, @Body() body: { name?: string; email?: string }) {
    return this.authService.updateProfile(user.userId, body);
  }

  @Post('create-admin')
  @ApiOperation({ summary: 'Créer l\'utilisateur admin (développement seulement)' })
  @ApiResponse({ status: 201, description: 'Admin créé avec succès' })
  async createAdmin() {
    return this.authService.createAdminUser();
  }
}

