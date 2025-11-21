import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.settings.findFirst();
    
    if (!settings) {
      // Créer les paramètres par défaut
      settings = await this.prisma.settings.create({
        data: {
          theme: 'light',
          currency: 'EUR',
          language: 'fr',
          accentColor: '#4CAF50',
          companyName: 'KAMRI',
          companyEmail: 'admin@kamri.com',
          companyPhone: '+33 1 23 45 67 89',
          companyAddress: '123 Rue de la Paix, 75001 Paris',
          apiRateLimit: 1000,
          autoSync: true,
          notifications: true,
          emailNotifications: true,
          smsNotifications: false,
        },
      });
    }

    return settings;
  }

  async updateSettings(updateSettingsDto: UpdateSettingsDto) {
    let settings = await this.prisma.settings.findFirst();
    
    if (!settings) {
      settings = await this.prisma.settings.create({
        data: updateSettingsDto,
      });
    } else {
      settings = await this.prisma.settings.update({
        where: { id: settings.id },
        data: updateSettingsDto,
      });
    }

    return settings;
  }

  async getCompanyInfo() {
    const settings = await this.prisma.settings.findFirst();
    
    if (!settings) {
      // Retourner des valeurs par défaut si aucun paramètre n'existe
      return {
        companyName: 'KAMRI',
        companyEmail: 'admin@kamri.com',
        companyPhone: '+33 1 23 45 67 89',
        companyAddress: '123 Rue de la Paix, 75001 Paris',
      };
    }

    // Retourner seulement les informations de l'entreprise (publiques)
    return {
      companyName: settings.companyName,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
      companyAddress: settings.companyAddress,
    };
  }
}
