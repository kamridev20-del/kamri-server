/**
 * Script de migration SQLite → PostgreSQL
 * Utilise better-sqlite3 pour lire SQLite et Prisma pour écrire dans PostgreSQL
 * 
 * Installation requise:
 * pnpm add -D better-sqlite3 @types/better-sqlite3
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

// Charger les variables d'environnement
const serverRoot = path.resolve(__dirname, '../');
const envPath = path.join(serverRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SQLITE_DB_PATH = process.env.DATABASE_URL_SQLITE?.replace('file:', '') || './prisma/dev.db';
const POSTGRES_URL = process.env.DATABASE_URL_POSTGRES || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('❌ DATABASE_URL doit être défini');
  process.exit(1);
}

// Vérifier que le fichier SQLite existe
if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.error(`❌ Fichier SQLite non trouvé: ${SQLITE_DB_PATH}`);
  console.log('💡 Aucune donnée à migrer. Les tables PostgreSQL sont déjà créées.');
  process.exit(0);
}

console.log('🚀 === MIGRATION SQLite → PostgreSQL ===\n');
console.log(`📂 Source SQLite: ${SQLITE_DB_PATH}`);
const masked = POSTGRES_URL.replace(/:[^:@]+@/, ':****@');
console.log(`📂 Destination PostgreSQL: ${masked}\n`);

// Connexions
const sqlite = new Database(SQLITE_DB_PATH, { readonly: true });
const postgres = new PrismaClient();

interface MigrationStats {
  [key: string]: number;
  errors: string[];
}

const stats: MigrationStats = {
  errors: [],
};

async function migrateTable(
  tableName: string,
  sqliteQuery: string,
  transform?: (row: any) => any
): Promise<number> {
  try {
    console.log(`📦 Migration de ${tableName}...`);
    
    const rows = sqlite.prepare(sqliteQuery).all();
    
    if (rows.length === 0) {
      console.log(`   ✓ ${tableName}: Aucune donnée`);
      return 0;
    }

    // Transformer les données
    const data = transform ? rows.map(transform) : rows;

    // Insérer par batch
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // Utiliser createMany avec skipDuplicates
      await (postgres as any)[tableName].createMany({
        data: batch,
        skipDuplicates: true,
      });
      
      inserted += batch.length;
      console.log(`   ✓ ${tableName}: ${inserted}/${data.length}`);
    }

    stats[tableName] = inserted;
    return inserted;
  } catch (error: any) {
    const errorMsg = `Erreur migration ${tableName}: ${error.message}`;
    console.error(`   ❌ ${errorMsg}`);
    stats.errors.push(errorMsg);
    return 0;
  }
}

async function main() {
  try {
    // Tester la connexion PostgreSQL
    await postgres.$connect();
    console.log('✅ Connexion PostgreSQL OK\n');

    // Migration dans l'ordre des dépendances
    await migrateTable('Settings', 'SELECT * FROM Settings');
    await migrateTable('Category', 'SELECT * FROM Category');
    await migrateTable('Supplier', 'SELECT * FROM Supplier');
    await migrateTable('User', 'SELECT * FROM User');
    await migrateTable('UserSettings', 'SELECT * FROM UserSettings');
    await migrateTable('Product', 'SELECT * FROM Product');
    await migrateTable('ProductVariant', 'SELECT * FROM ProductVariant');
    await migrateTable('Image', 'SELECT * FROM Image');
    await migrateTable('Address', 'SELECT * FROM Address');
    await migrateTable('CartItem', 'SELECT * FROM CartItem');
    await migrateTable('Order', 'SELECT * FROM Order');
    await migrateTable('OrderItem', 'SELECT * FROM OrderItem');
    await migrateTable('Review', 'SELECT * FROM Review');
    await migrateTable('Wishlist', 'SELECT * FROM Wishlist');
    await migrateTable('CategoryMapping', 'SELECT * FROM CategoryMapping');
    await migrateTable('UnmappedExternalCategory', 'SELECT * FROM UnmappedExternalCategory');
    await migrateTable('CJConfig', 'SELECT * FROM CJConfig');
    await migrateTable('CJProductStore', 'SELECT * FROM CJProductStore');
    await migrateTable('CJProductMapping', 'SELECT * FROM CJProductMapping');
    await migrateTable('CJOrderMapping', 'SELECT * FROM CJOrderMapping');
    await migrateTable('WebhookLog', 'SELECT * FROM WebhookLog');
    await migrateTable('CJWebhookLog', 'SELECT * FROM CJWebhookLog');
    await migrateTable('ProductUpdateNotification', 'SELECT * FROM ProductUpdateNotification');
    await migrateTable('CJSourcingRequest', 'SELECT * FROM CJSourcingRequest');

    // Résumé
    console.log('\n✅ === MIGRATION TERMINÉE ===\n');
    console.log('📊 Statistiques:');
    Object.entries(stats).forEach(([key, value]) => {
      if (key !== 'errors' && typeof value === 'number') {
        console.log(`   - ${key}: ${value}`);
      }
    });

    if (stats.errors.length > 0) {
      console.log('\n⚠️ Erreurs:');
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }

  } catch (error: any) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  } finally {
    sqlite.close();
    await postgres.$disconnect();
    console.log('\n🔌 Connexions fermées');
  }
}

main()
  .then(() => {
    console.log('\n🎉 Migration réussie!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration échouée:', error);
    process.exit(1);
  });

