import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async getUserAddresses(userId: string) {
    console.log('🏠 [AddressesService] Récupération des adresses pour userId:', userId);
    
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    console.log('📦 [AddressesService] Adresses trouvées:', addresses.length);
    return {
      data: addresses,
      message: 'Adresses récupérées avec succès',
    };
  }

  async createAddress(userId: string, addressData: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
    isDefault?: boolean;
  }) {
    console.log('🏠 [AddressesService] Création d\'adresse pour userId:', userId, addressData);

    // Si c'est l'adresse par défaut, désactiver les autres
    if (addressData.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        userId,
        street: addressData.street,
        city: addressData.city,
        state: addressData.state,
        zipCode: addressData.zipCode,
        country: addressData.country || 'FR',
        isDefault: addressData.isDefault || false,
      },
    });

    console.log('✅ [AddressesService] Adresse créée:', address.id);
    return {
      data: address,
      message: 'Adresse créée avec succès',
    };
  }

  async updateAddress(addressId: string, userId: string, addressData: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    isDefault?: boolean;
  }) {
    console.log('🏠 [AddressesService] Mise à jour d\'adresse:', addressId, addressData);

    // Vérifier que l'adresse appartient à l'utilisateur
    const existingAddress = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existingAddress) {
      throw new Error('Adresse non trouvée ou non autorisée');
    }

    // Si c'est l'adresse par défaut, désactiver les autres
    if (addressData.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.update({
      where: { id: addressId },
      data: addressData,
    });

    console.log('✅ [AddressesService] Adresse mise à jour:', address.id);
    return {
      data: address,
      message: 'Adresse mise à jour avec succès',
    };
  }

  async deleteAddress(addressId: string, userId: string) {
    console.log('🏠 [AddressesService] Suppression d\'adresse:', addressId);

    // Vérifier que l'adresse appartient à l'utilisateur
    const existingAddress = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existingAddress) {
      throw new Error('Adresse non trouvée ou non autorisée');
    }

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    console.log('✅ [AddressesService] Adresse supprimée:', addressId);
    return {
      message: 'Adresse supprimée avec succès',
    };
  }

  async setDefaultAddress(addressId: string, userId: string) {
    console.log('🏠 [AddressesService] Définir adresse par défaut:', addressId);

    // Vérifier que l'adresse appartient à l'utilisateur
    const existingAddress = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existingAddress) {
      throw new Error('Adresse non trouvée ou non autorisée');
    }

    // Désactiver toutes les autres adresses par défaut
    await this.prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    // Activer cette adresse comme par défaut
    const address = await this.prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });

    console.log('✅ [AddressesService] Adresse par défaut définie:', address.id);
    return {
      data: address,
      message: 'Adresse par défaut définie avec succès',
    };
  }
}
