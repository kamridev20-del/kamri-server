import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserSettingsService {
  constructor(private prisma: PrismaService) {}

  async getUserSettings(userId: string) {
    console.log('⚙️ [UserSettingsService] Récupération des paramètres pour userId:', userId);
    
    // Récupérer les paramètres de l'utilisateur ou créer des paramètres par défaut
    let userSettings = await this.prisma.userSettings.findFirst({
      where: { userId },
    });

    if (!userSettings) {
      console.log('⚙️ [UserSettingsService] Création des paramètres par défaut');
      userSettings = await this.prisma.userSettings.create({
        data: {
          userId,
          notifications: JSON.stringify({
            email: true,
            sms: false,
            push: true,
            marketing: false,
          }),
          privacy: JSON.stringify({
            profileVisible: true,
            orderHistory: false,
            dataSharing: false,
          }),
          preferences: JSON.stringify({
            theme: 'light',
            language: 'fr',
            currency: 'EUR',
          }),
        },
      });
    }

    console.log('✅ [UserSettingsService] Paramètres récupérés');
    
    // Parser les chaînes JSON en objets
    const parsedSettings = {
      ...userSettings,
      notifications: JSON.parse(userSettings.notifications),
      privacy: JSON.parse(userSettings.privacy),
      preferences: JSON.parse(userSettings.preferences),
    };
    
    return {
      data: parsedSettings,
      message: 'Paramètres récupérés avec succès',
    };
  }

  async updateUserSettings(userId: string, settingsData: {
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
  }) {
    console.log('⚙️ [UserSettingsService] Mise à jour des paramètres pour userId:', userId, settingsData);

    // Vérifier si les paramètres existent
    const existingSettings = await this.prisma.userSettings.findFirst({
      where: { userId },
    });

    let userSettings;
    if (existingSettings) {
      // Mettre à jour les paramètres existants
      const updateData: any = {};
      if (settingsData.notifications) {
        updateData.notifications = JSON.stringify(settingsData.notifications);
      }
      if (settingsData.privacy) {
        updateData.privacy = JSON.stringify(settingsData.privacy);
      }
      if (settingsData.preferences) {
        updateData.preferences = JSON.stringify(settingsData.preferences);
      }
      
      userSettings = await this.prisma.userSettings.update({
        where: { id: existingSettings.id },
        data: updateData,
      });
    } else {
      // Créer de nouveaux paramètres
      userSettings = await this.prisma.userSettings.create({
        data: {
          userId,
          notifications: settingsData.notifications ? JSON.stringify(settingsData.notifications) : JSON.stringify({
            email: true,
            sms: false,
            push: true,
            marketing: false,
          }),
          privacy: settingsData.privacy ? JSON.stringify(settingsData.privacy) : JSON.stringify({
            profileVisible: true,
            orderHistory: false,
            dataSharing: false,
          }),
          preferences: settingsData.preferences ? JSON.stringify(settingsData.preferences) : JSON.stringify({
            theme: 'light',
            language: 'fr',
            currency: 'EUR',
          }),
        },
      });
    }

    console.log('✅ [UserSettingsService] Paramètres mis à jour');
    
    // Parser les chaînes JSON en objets pour la réponse
    const parsedSettings = {
      ...userSettings,
      notifications: JSON.parse(userSettings.notifications),
      privacy: JSON.parse(userSettings.privacy),
      preferences: JSON.parse(userSettings.preferences),
    };
    
    return {
      data: parsedSettings,
      message: 'Paramètres mis à jour avec succès',
    };
  }

  async deleteUserAccount(userId: string) {
    console.log('🗑️ [UserSettingsService] Suppression du compte pour userId:', userId);

    // Supprimer toutes les données associées à l'utilisateur
    await this.prisma.$transaction(async (tx) => {
      // Supprimer les éléments du panier
      await tx.cartItem.deleteMany({
        where: { userId },
      });

      // Supprimer les favoris
      await tx.wishlist.deleteMany({
        where: { userId },
      });

      // Supprimer les adresses
      await tx.address.deleteMany({
        where: { userId },
      });

      // Supprimer les paramètres utilisateur
      await tx.userSettings.deleteMany({
        where: { userId },
      });

      // Supprimer les commandes (et leurs éléments)
      const orders = await tx.order.findMany({
        where: { userId },
        select: { id: true },
      });

      for (const order of orders) {
        await tx.orderItem.deleteMany({
          where: { orderId: order.id },
        });
      }

      await tx.order.deleteMany({
        where: { userId },
      });

      // Supprimer l'utilisateur
      await tx.user.delete({
        where: { id: userId },
      });
    });

    console.log('✅ [UserSettingsService] Compte supprimé');
    return {
      message: 'Compte supprimé avec succès',
    };
  }
}
