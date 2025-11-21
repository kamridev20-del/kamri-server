/**
 * Script de migration SQLite → PostgreSQL
 * 
 * Ce script migre toutes les données de SQLite vers PostgreSQL
 * 
 * Usage:
 * 1. Configurer DATABASE_URL_SQLITE et DATABASE_URL_POSTGRES dans .env
 * 2. Exécuter: ts-node -r tsconfig-paths/register server/scripts/migrate-to-postgresql.ts
 */

// ⚠️ IMPORTANT: Charger dotenv AVANT d'importer PrismaClient
// Sinon Prisma valide le schéma avant que les variables soient chargées
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Charger les variables d'environnement IMMÉDIATEMENT
// Utiliser le chemin depuis le dossier server (pas depuis scripts/)
const serverRoot = path.resolve(__dirname, '../');
const envPath = path.join(serverRoot, '.env');
const envProdPath = path.join(serverRoot, '.env.production');

console.log('📋 Chargement des variables d\'environnement...');
console.log(`   Chemin recherché: ${envPath}`);

if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn('⚠️  Erreur lors du chargement .env:', result.error.message);
  } else {
    console.log('   ✅ Fichier .env chargé');
  }
} else if (fs.existsSync(envProdPath)) {
  const result = dotenv.config({ path: envProdPath });
  if (result.error) {
    console.warn('⚠️  Erreur lors du chargement .env.production:', result.error.message);
  } else {
    console.log('   ✅ Fichier .env.production chargé');
  }
} else {
  console.warn('⚠️  Aucun fichier .env trouvé, utilisation des variables système');
}

// Afficher les variables chargées (masquées)
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Défini' : '❌ Non défini'}`);
if (process.env.DATABASE_URL) {
  const masked = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log(`   URL: ${masked.substring(0, 60)}...`);
}

// Vérifier que DATABASE_URL est chargé
if (!process.env.DATABASE_URL) {
  console.error('\n❌ DATABASE_URL n\'est pas défini dans les variables d\'environnement');
  console.error('   Vérifiez que le fichier .env existe dans server/ et contient DATABASE_URL');
  console.error(`   Chemin attendu: ${envPath}`);
  process.exit(1);
}

// Vérifier le format de DATABASE_URL
if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
  console.error('\n❌ DATABASE_URL doit commencer par postgresql:// ou postgres://');
  console.error(`   URL actuelle: ${process.env.DATABASE_URL.substring(0, 50)}...`);
  console.error('   Format attendu: postgresql://user:password@host:port/database');
  process.exit(1);
}

// URLs de connexion
const SQLITE_DB_PATH = process.env.DATABASE_URL_SQLITE || 'file:./prisma/dev.db';
const POSTGRES_URL = process.env.DATABASE_URL_POSTGRES || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('❌ DATABASE_URL_POSTGRES ou DATABASE_URL doit être défini');
  process.exit(1);
}

// Vérifier que POSTGRES_URL est bien formaté
console.log('\n🔍 Vérification des URLs...');
console.log(`   SQLite: ${SQLITE_DB_PATH}`);
const maskedPostgres = POSTGRES_URL.replace(/:[^:@]+@/, ':****@');
console.log(`   PostgreSQL: ${maskedPostgres.substring(0, 60)}...`);

if (!POSTGRES_URL.startsWith('postgresql://') && !POSTGRES_URL.startsWith('postgres://')) {
  console.error('\n❌ POSTGRES_URL doit commencer par postgresql:// ou postgres://');
  console.error(`   URL reçue: ${POSTGRES_URL.substring(0, 50)}...`);
  process.exit(1);
}

// ⚠️ Maintenant que les variables sont chargées, importer PrismaClient
// Cela garantit que Prisma voit DATABASE_URL lors de la validation du schéma
import { PrismaClient as SQLiteClient } from '@prisma/client';
import { PrismaClient as PostgresClient } from '@prisma/client';

// Créer les clients Prisma avec les URLs explicites
console.log('\n🔌 Création des clients Prisma...');

const sqliteClient = new SQLiteClient({
  datasources: {
    db: {
      url: SQLITE_DB_PATH,
    },
  },
});

// Pour PostgreSQL, utiliser l'URL directement dans datasources
// ET s'assurer que process.env.DATABASE_URL est défini pour la validation du schéma
const postgresClient = new PostgresClient({
  datasources: {
    db: {
      url: POSTGRES_URL,
    },
  },
});

console.log('   ✅ Clients Prisma créés');

interface MigrationStats {
  users: number;
  categories: number;
  products: number;
  orders: number;
  cartItems: number;
  addresses: number;
  reviews: number;
  wishlist: number;
  suppliers: number;
  settings: number;
  cjConfigs: number;
  cjProductStore: number;
  errors: string[];
}

async function migrateTable<T>(
  tableName: string,
  sqliteQuery: () => Promise<T[]>,
  postgresInsert: (data: T[]) => Promise<any>,
  transform?: (data: T) => any
): Promise<number> {
  try {
    console.log(`📦 Migration de ${tableName}...`);
    const data = await sqliteQuery();
    
    if (data.length === 0) {
      console.log(`   ✓ ${tableName}: Aucune donnée à migrer`);
      return 0;
    }

    // Transformer les données si nécessaire
    const transformedData = transform 
      ? data.map(transform)
      : data;

    // Insérer par batch de 100 pour éviter les timeouts
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);
      await postgresInsert(batch);
      inserted += batch.length;
      console.log(`   ✓ ${tableName}: ${inserted}/${transformedData.length} migrés`);
    }

    return inserted;
  } catch (error: any) {
    console.error(`   ❌ Erreur migration ${tableName}:`, error.message);
    throw error;
  }
}

async function main() {
  const stats: MigrationStats = {
    users: 0,
    categories: 0,
    products: 0,
    orders: 0,
    cartItems: 0,
    addresses: 0,
    reviews: 0,
    wishlist: 0,
    suppliers: 0,
    settings: 0,
    cjConfigs: 0,
    cjProductStore: 0,
    errors: [],
  };

  console.log('\n🚀 === DÉBUT DE LA MIGRATION SQLite → PostgreSQL ===\n');
  console.log(`📂 Source SQLite: ${SQLITE_DB_PATH}`);
  const maskedDest = POSTGRES_URL.replace(/:[^:@]+@/, ':****@');
  console.log(`📂 Destination PostgreSQL: ${maskedDest}\n`);

  try {
    // Tester les connexions
    console.log('🔌 Test des connexions...');
    await sqliteClient.$connect();
    console.log('   ✓ Connexion SQLite OK');
    
    await postgresClient.$connect();
    console.log('   ✓ Connexion PostgreSQL OK\n');

    // Migration dans l'ordre des dépendances
    // 1. Tables sans dépendances
    stats.settings = await migrateTable(
      'Settings',
      () => sqliteClient.settings.findMany(),
      (data) => postgresClient.settings.createMany({ data, skipDuplicates: true })
    );

    stats.categories = await migrateTable(
      'Categories',
      () => sqliteClient.category.findMany(),
      (data) => postgresClient.category.createMany({ data, skipDuplicates: true })
    );

    stats.suppliers = await migrateTable(
      'Suppliers',
      () => sqliteClient.supplier.findMany(),
      (data) => postgresClient.supplier.createMany({ data, skipDuplicates: true })
    );

    // 2. Users (nécessaire pour les relations)
    stats.users = await migrateTable(
      'Users',
      () => sqliteClient.user.findMany(),
      (data) => postgresClient.user.createMany({ 
        data: data.map(u => ({
          ...u,
          password: u.password, // Conserver le hash
        })),
        skipDuplicates: true 
      })
    );

    // 3. UserSettings (dépend de Users)
    await migrateTable(
      'UserSettings',
      () => sqliteClient.userSettings.findMany(),
      (data) => postgresClient.userSettings.createMany({ data, skipDuplicates: true })
    );

    // 4. Products (dépend de Categories et Suppliers)
    stats.products = await migrateTable(
      'Products',
      () => sqliteClient.product.findMany(),
      (data) => postgresClient.product.createMany({ data, skipDuplicates: true })
    );

    // 5. ProductVariants (dépend de Products)
    await migrateTable(
      'ProductVariants',
      () => sqliteClient.productVariant.findMany(),
      (data) => postgresClient.productVariant.createMany({ data, skipDuplicates: true })
    );

    // 6. Images (dépend de Products)
    await migrateTable(
      'Images',
      () => sqliteClient.image.findMany(),
      (data) => postgresClient.image.createMany({ data, skipDuplicates: true })
    );

    // 7. Addresses (dépend de Users)
    stats.addresses = await migrateTable(
      'Addresses',
      () => sqliteClient.address.findMany(),
      (data) => postgresClient.address.createMany({ data, skipDuplicates: true })
    );

    // 8. CartItems (dépend de Users et Products)
    stats.cartItems = await migrateTable(
      'CartItems',
      () => sqliteClient.cartItem.findMany(),
      (data) => postgresClient.cartItem.createMany({ data, skipDuplicates: true })
    );

    // 9. Orders (dépend de Users)
    stats.orders = await migrateTable(
      'Orders',
      () => sqliteClient.order.findMany(),
      (data) => postgresClient.order.createMany({ data, skipDuplicates: true })
    );

    // 10. OrderItems (dépend de Orders, Products, ProductVariants)
    await migrateTable(
      'OrderItems',
      () => sqliteClient.orderItem.findMany(),
      (data) => postgresClient.orderItem.createMany({ data, skipDuplicates: true })
    );

    // 11. Reviews (dépend de Users et Products)
    stats.reviews = await migrateTable(
      'Reviews',
      () => sqliteClient.review.findMany(),
      (data) => postgresClient.review.createMany({ data, skipDuplicates: true })
    );

    // 12. Wishlist (dépend de Users et Products)
    stats.wishlist = await migrateTable(
      'Wishlist',
      () => sqliteClient.wishlist.findMany(),
      (data) => postgresClient.wishlist.createMany({ data, skipDuplicates: true })
    );

    // 13. CategoryMappings (dépend de Suppliers)
    await migrateTable(
      'CategoryMappings',
      () => sqliteClient.categoryMapping.findMany(),
      (data) => postgresClient.categoryMapping.createMany({ data, skipDuplicates: true })
    );

    // 14. UnmappedExternalCategories (dépend de Suppliers)
    await migrateTable(
      'UnmappedExternalCategories',
      () => sqliteClient.unmappedExternalCategory.findMany(),
      (data) => postgresClient.unmappedExternalCategory.createMany({ data, skipDuplicates: true })
    );

    // 15. CJ Dropshipping
    stats.cjConfigs = await migrateTable(
      'CJConfigs',
      () => sqliteClient.cJConfig.findMany(),
      (data) => postgresClient.cJConfig.createMany({ data, skipDuplicates: true })
    );

    stats.cjProductStore = await migrateTable(
      'CJProductStore',
      () => sqliteClient.cJProductStore.findMany(),
      (data) => postgresClient.cJProductStore.createMany({ data, skipDuplicates: true })
    );

    await migrateTable(
      'CJProductMappings',
      () => sqliteClient.cJProductMapping.findMany(),
      (data) => postgresClient.cJProductMapping.createMany({ data, skipDuplicates: true })
    );

    await migrateTable(
      'CJOrderMappings',
      () => sqliteClient.cJOrderMapping.findMany(),
      (data) => postgresClient.cJOrderMapping.createMany({ data, skipDuplicates: true })
    );

    await migrateTable(
      'WebhookLogs',
      () => sqliteClient.webhookLog.findMany(),
      (data) => postgresClient.webhookLog.createMany({ data, skipDuplicates: true })
    );

    await migrateTable(
      'CJWebhookLogs',
      () => sqliteClient.cJWebhookLog.findMany(),
      (data) => postgresClient.cJWebhookLog.createMany({ data, skipDuplicates: true })
    );

    await migrateTable(
      'ProductUpdateNotifications',
      () => sqliteClient.productUpdateNotification.findMany(),
      (data) => postgresClient.productUpdateNotification.createMany({ data, skipDuplicates: true })
    );

    await migrateTable(
      'CJSourcingRequests',
      () => sqliteClient.cJSourcingRequest.findMany(),
      (data) => postgresClient.cJSourcingRequest.createMany({ data, skipDuplicates: true })
    );

    // Résumé
    console.log('\n✅ === MIGRATION TERMINÉE ===\n');
    console.log('📊 Statistiques:');
    console.log(`   - Utilisateurs: ${stats.users}`);
    console.log(`   - Catégories: ${stats.categories}`);
    console.log(`   - Produits: ${stats.products}`);
    console.log(`   - Commandes: ${stats.orders}`);
    console.log(`   - Panier: ${stats.cartItems}`);
    console.log(`   - Adresses: ${stats.addresses}`);
    console.log(`   - Avis: ${stats.reviews}`);
    console.log(`   - Wishlist: ${stats.wishlist}`);
    console.log(`   - Fournisseurs: ${stats.suppliers}`);
    console.log(`   - Settings: ${stats.settings}`);
    console.log(`   - CJ Configs: ${stats.cjConfigs}`);
    console.log(`   - CJ Products: ${stats.cjProductStore}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️ Erreurs rencontrées:');
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }

  } catch (error: any) {
    console.error('\n❌ Erreur lors de la migration:', error);
    stats.errors.push(error.message);
    throw error;
  } finally {
    await sqliteClient.$disconnect();
    await postgresClient.$disconnect();
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
