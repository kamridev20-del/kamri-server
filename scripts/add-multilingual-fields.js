/**
 * Script de migration : Ajout des champs multilingues (FR/EN) à la table products
 * 
 * Ce script ajoute les colonnes :
 * - name_fr (nom français)
 * - name_en (nom anglais)
 * - description_fr (description française)
 * - description_en (description anglaise)
 * 
 * Et copie les données existantes :
 * - name → name_fr et name_en (même valeur)
 * - description → description_fr et description_en (même valeur)
 */

const { Client } = require('pg');

// Configuration de la connexion PostgreSQL Railway
const dbConfig = {
  host: 'yamabiko.proxy.rlwy.net',
  port: 28846,
  database: 'railway',
  user: 'postgres',
  password: 'avUQefgltUYjOGVtXyouUFwtEyeLshdY',
  ssl: {
    rejectUnauthorized: false // Railway nécessite SSL
  }
};

async function addMultilingualFields() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔌 Connexion à la base de données Railway...');
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // Vérifier si les colonnes existent déjà
    console.log('🔍 Vérification des colonnes existantes...');
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name IN ('name_fr', 'name_en', 'description_fr', 'description_en')
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    console.log(`📋 Colonnes existantes: ${existingColumns.length > 0 ? existingColumns.join(', ') : 'Aucune'}\n`);

    // Ajouter les colonnes si elles n'existent pas
    const columnsToAdd = [];
    
    if (!existingColumns.includes('name_fr')) {
      columnsToAdd.push('name_fr TEXT');
    }
    if (!existingColumns.includes('name_en')) {
      columnsToAdd.push('name_en TEXT');
    }
    if (!existingColumns.includes('description_fr')) {
      columnsToAdd.push('description_fr TEXT');
    }
    if (!existingColumns.includes('description_en')) {
      columnsToAdd.push('description_en TEXT');
    }

    if (columnsToAdd.length > 0) {
      console.log('➕ Ajout des colonnes multilingues...');
      for (const column of columnsToAdd) {
        const [columnName] = column.split(' ');
        console.log(`   → Ajout de ${columnName}...`);
        await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${column}`);
      }
      console.log('✅ Colonnes ajoutées avec succès\n');
    } else {
      console.log('ℹ️  Toutes les colonnes existent déjà\n');
    }

    // Compter les produits
    const countResult = await client.query('SELECT COUNT(*) as count FROM products');
    const totalProducts = parseInt(countResult.rows[0].count);
    console.log(`📦 Nombre total de produits: ${totalProducts}\n`);

    if (totalProducts === 0) {
      console.log('ℹ️  Aucun produit à migrer\n');
      return;
    }

    // Compter les produits qui ont besoin de migration
    const needsMigration = await client.query(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE (name_fr IS NULL AND name IS NOT NULL) 
         OR (name_en IS NULL AND name IS NOT NULL)
         OR (description_fr IS NULL AND description IS NOT NULL)
         OR (description_en IS NULL AND description IS NOT NULL)
    `);
    const productsToMigrate = parseInt(needsMigration.rows[0].count);
    console.log(`🔄 Produits à migrer: ${productsToMigrate}\n`);

    if (productsToMigrate === 0) {
      console.log('✅ Tous les produits sont déjà migrés\n');
      return;
    }

    // Migrer les données : copier name → name_fr et name_en
    console.log('📝 Migration des données...');
    console.log('   → Copie de name → name_fr et name_en...');
    
    const updateName = await client.query(`
      UPDATE products 
      SET 
        name_fr = name,
        name_en = name
      WHERE name IS NOT NULL 
        AND (name_fr IS NULL OR name_en IS NULL)
    `);
    console.log(`   ✅ ${updateName.rowCount} produits mis à jour (name)\n`);

    // Migrer les descriptions : copier description → description_fr et description_en
    console.log('   → Copie de description → description_fr et description_en...');
    
    const updateDescription = await client.query(`
      UPDATE products 
      SET 
        description_fr = description,
        description_en = description
      WHERE description IS NOT NULL 
        AND (description_fr IS NULL OR description_en IS NULL)
    `);
    console.log(`   ✅ ${updateDescription.rowCount} produits mis à jour (description)\n`);

    // Statistiques finales
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(name_fr) as has_name_fr,
        COUNT(name_en) as has_name_en,
        COUNT(description_fr) as has_desc_fr,
        COUNT(description_en) as has_desc_en
      FROM products
    `);
    const stats = statsResult.rows[0];
    
    console.log('📊 Statistiques finales:');
    console.log(`   Total produits: ${stats.total}`);
    console.log(`   Avec name_fr: ${stats.has_name_fr}`);
    console.log(`   Avec name_en: ${stats.has_name_en}`);
    console.log(`   Avec description_fr: ${stats.has_desc_fr}`);
    console.log(`   Avec description_en: ${stats.has_desc_en}\n`);

    console.log('✅ Migration terminée avec succès !\n');
    console.log('💡 Prochaines étapes:');
    console.log('   1. Générer le client Prisma: npm run db:generate');
    console.log('   2. Vérifier que les champs sont bien dans le schéma');
    console.log('   3. Modifier les services backend pour utiliser les nouveaux champs');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée');
  }
}

// Exécuter la migration
addMultilingualFields()
  .then(() => {
    console.log('\n🎉 Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });


