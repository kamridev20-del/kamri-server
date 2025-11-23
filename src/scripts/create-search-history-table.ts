import { PrismaClient } from '@prisma/client';

// Utiliser la connection string directement
const connectionString = 'postgresql://postgres:EMkmOfaTFXbnFsFnkqnhRFZIYDAHAYUK@gondola.proxy.rlwy.net:25572/railway';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionString,
    },
  },
});

async function createSearchHistoryTable() {
  try {
    console.log('🔄 Création de la table search_history...');
    
    // Créer la table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "search_history" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "query" TEXT NOT NULL UNIQUE,
        "count" INTEGER NOT NULL DEFAULT 1,
        "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Créer les index
    try {
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "search_history_count_idx" ON "search_history"("count")`;
    } catch (e) {
      console.log('Index count existe déjà ou erreur');
    }
    
    try {
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "search_history_lastSearchedAt_idx" ON "search_history"("lastSearchedAt")`;
    } catch (e) {
      console.log('Index lastSearchedAt existe déjà ou erreur');
    }
    
    console.log('✅ Table search_history créée avec succès !');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✅ La table existe déjà');
    } else {
      console.error('❌ Erreur:', error.message);
      console.error('Détails:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createSearchHistoryTable();

