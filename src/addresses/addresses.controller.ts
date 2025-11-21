import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddressesService } from './addresses.service';

@ApiTags('addresses')
@Controller('api/addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer les adresses de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Adresses récupérées avec succès' })
  async getUserAddresses(@GetUser() user: any) {
    return this.addressesService.getUserAddresses(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle adresse' })
  @ApiResponse({ status: 201, description: 'Adresse créée avec succès' })
  async createAddress(
    @GetUser() user: any,
    @Body() addressData: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country?: string;
      isDefault?: boolean;
    }
  ) {
    return this.addressesService.createAddress(user.userId, addressData);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Mettre à jour une adresse' })
  @ApiResponse({ status: 200, description: 'Adresse mise à jour avec succès' })
  async updateAddress(
    @Param('id') id: string,
    @GetUser() user: any,
    @Body() addressData: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      isDefault?: boolean;
    }
  ) {
    return this.addressesService.updateAddress(id, user.userId, addressData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une adresse' })
  @ApiResponse({ status: 200, description: 'Adresse supprimée avec succès' })
  async deleteAddress(@Param('id') id: string, @GetUser() user: any) {
    return this.addressesService.deleteAddress(id, user.userId);
  }

  @Post(':id/default')
  @ApiOperation({ summary: 'Définir une adresse comme par défaut' })
  @ApiResponse({ status: 200, description: 'Adresse par défaut définie avec succès' })
  async setDefaultAddress(@Param('id') id: string, @GetUser() user: any) {
    return this.addressesService.setDefaultAddress(id, user.userId);
  }
}
