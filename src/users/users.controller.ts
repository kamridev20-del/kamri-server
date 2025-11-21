import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('api/users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Récupérer le profil de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Profil récupéré avec succès' })
  async getProfile(@GetUser() user: any) {
    console.log('👤 [UsersController] getProfile appelé avec user:', user);
    const userProfile = await this.usersService.findOne(user.userId);
    return {
      data: userProfile,
      message: 'Profil récupéré avec succès'
    };
  }

  @Put('profile')
  @ApiOperation({ summary: 'Mettre à jour le profil de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Profil mis à jour avec succès' })
  async updateProfile(@GetUser() user: any, @Body() userData: any) {
    console.log('✏️ [UsersController] === DÉBUT DE LA MISE À JOUR ===');
    console.log('✏️ [UsersController] Utilisateur connecté:', user);
    console.log('✏️ [UsersController] ID utilisateur:', user.userId);
    console.log('✏️ [UsersController] Données reçues:', userData);
    console.log('✏️ [UsersController] Type de userData:', typeof userData);
    console.log('✏️ [UsersController] Clés disponibles:', Object.keys(userData));
    
    try {
      const updatedUser = await this.usersService.update(user.userId, userData);
      console.log('✅ [UsersController] Utilisateur mis à jour:', updatedUser);
      
      const response = {
        data: updatedUser,
        message: 'Profil mis à jour avec succès'
      };
      
      console.log('✅ [UsersController] Réponse envoyée:', response);
      console.log('✏️ [UsersController] === FIN DE LA MISE À JOUR ===');
      return response;
    } catch (error) {
      console.error('❌ [UsersController] Erreur lors de la mise à jour:', error);
      console.error('❌ [UsersController] Stack trace:', error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les utilisateurs' })
  @ApiResponse({ status: 200, description: 'Liste des utilisateurs récupérée avec succès' })
  async findAll() {
    const users = await this.usersService.findAll();
    return {
      data: users,
      message: 'Utilisateurs récupérés avec succès'
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un utilisateur par ID' })
  @ApiResponse({ status: 200, description: 'Utilisateur récupéré avec succès' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    if (!user) {
      return {
        error: 'Utilisateur non trouvé'
      };
    }
    return {
      data: user,
      message: 'Utilisateur récupéré avec succès'
    };
  }

  @Get('orders')
  @ApiOperation({ summary: 'Récupérer les commandes de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Commandes récupérées avec succès' })
  async getUserOrders(@GetUser() user: any) {
    console.log('📦 [UsersController] getUserOrders appelé avec user:', user);
    return this.usersService.getUserOrders(user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier un utilisateur' })
  @ApiResponse({ status: 200, description: 'Utilisateur modifié avec succès' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async update(@Param('id') id: string, @Body() userData: any) {
    const user = await this.usersService.update(id, userData);
    if (!user) {
      return {
        error: 'Utilisateur non trouvé'
      };
    }
    return {
      data: user,
      message: 'Utilisateur modifié avec succès'
    };
  }
}
