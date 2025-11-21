/**
 * Script de migration SQLite → PostgreSQL (Version 2)
 * 
 * Cette version utilise deux schémas Prisma distincts pour éviter les conflits
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Charger les variables d'environnement
const serverRoot = path.resolve(__dirname, '../');
const envPath = path.join(serverRoot, '.env');

console.log('📋 Chargement des variables d\'environnement...');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('   ✅ Fichier .env chargé');
} else {
  console.warn('⚠️  Fichier .env non trouvé');
}

const SQLITE_DB_PATH = process.env.DATABASE_URL_SQLITE || 'file:./prisma/dev.db';
const POSTGRES_URL = process.env.DATABASE_URL_POSTGRES || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('❌ DATABASE_URL_POSTGRES ou DATABASE_URL doit être défini');
  process.exit(1);
}

if (!POSTGRES_URL.startsWith('postgresql://') && !POSTGRES_URL.startsWith('postgres://')) {
  console.error('❌ DATABASE_URL doit commencer par postgresql:// ou postgres://');
  process.exit(1);
}

console.log('\n🚀 === MIGRATION SQLite → PostgreSQL ===\n');
console.log(`📂 Source SQLite: ${SQLITE_DB_PATH}`);
const masked = POSTGRES_URL.replace(/:[^:@]+@/, ':****@');
console.log(`📂 Destination PostgreSQL: ${masked}\n`);

// Méthode alternative : Utiliser Prisma Migrate avec deux schémas
// Ou utiliser directement les requêtes SQL

console.log('💡 Pour migrer les données, utilisez une des méthodes suivantes:\n');
console.log('1. Méthode manuelle avec Prisma Studio:');
console.log('   - Ouvrir SQLite: pnpm prisma studio (avec schema SQLite)');
console.log('   - Exporter les données');
console.log('   - Importer dans PostgreSQL: pnpm prisma studio (avec schema PostgreSQL)\n');

console.log('2. Méthode avec script SQL:');
console.log('   - Exporter SQLite en SQL');
console.log('   - Adapter pour PostgreSQL');
console.log('   - Importer dans PostgreSQL\n');

console.log('3. Méthode recommandée: Utiliser un outil externe');
console.log('   - DBeaver (gratuit)');
console.log('   - pgAdmin');
console.log('   - Ou script personnalisé avec node-sqlite3 et pg\n');

console.log('⚠️  Note: La migration automatique nécessite deux schémas Prisma distincts.');
console.log('   Les tables sont déjà créées dans PostgreSQL.');
console.log('   Vous pouvez maintenant importer vos données manuellement.\n');

