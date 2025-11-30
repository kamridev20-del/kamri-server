// ✅ VERSION OPTIMISÉE - PrismaService
// Fichier source : src/prisma/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // ✅ OPTIMISATION : Ne jamais logger 'query' (même en dev) pour réduire I/O
      log: process.env.NODE_ENV === 'production' 
        ? ['error'] 
        : ['error', 'warn'], // ⚠️ Retirer 'query' pour économiser les ressources
      // Configuration du pool de connexions pour éviter "too many clients"
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Connexion à la base de données établie');
    } catch (error: any) {
      this.logger.error('❌ Erreur de connexion à la base de données:', error?.message || error);
      if (error?.message?.includes('too many clients')) {
        this.logger.error('💡 Solution: Ajoutez ?connection_limit=10&pool_timeout=20 à votre DATABASE_URL');
      }
      throw error; // Laisser le service échouer si la DB n'est pas accessible
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Connexion à la base de données fermée');
  }
}


