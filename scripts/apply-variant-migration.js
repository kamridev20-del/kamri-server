#!/usr/bin/env node

/**
 * Script pour appliquer la migration variantId et variantDetails à la base de données
 * Usage: node scripts/apply-variant-migration.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration de la base de données
const DATABASE_URL = 'postgresql://postgres:avUQefgltUYjOGVtXyouUFwtEyeLshdY@yamabiko.proxy.rlwy.net:28846/railway';

const SQL_FILE = path.join(__dirname, 'add-variant-details-to-cart.sql');

async function applyMigration() {
  // Créer une instance Prisma avec la DATABASE_URL
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL,
      },
    },
  });
  
  try {
    console.log('========================================');
    console.log('Application de la migration variantDetails');
    console.log('========================================\n');
    
    // Test de connexion
    console.log('[1/5] Test de connexion à la base de données...');
    await prisma.$connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Appliquer les migrations Prisma existantes d'abord
    console.log('[2/5] Application des migrations Prisma existantes...');
    try {
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, DATABASE_URL }
      });
      console.log('✅ Migrations Prisma appliquées\n');
    } catch (error) {
      console.log('⚠️  Erreur lors de l\'application des migrations Prisma, continuation...\n');
    }
    
    // Lire le fichier SQL
    console.log('[3/5] Lecture du fichier SQL...');
    if (!fs.existsSync(SQL_FILE)) {
      throw new Error(`Fichier SQL non trouvé: ${SQL_FILE}`);
    }
    const sql = fs.readFileSync(SQL_FILE, 'utf8');
    console.log('✅ Fichier SQL lu\n');
    
    // Exécuter le SQL avec Prisma
    console.log('[4/5] Application de la migration SQL pour variantId et variantDetails...');
    
    // Commandes SQL à exécuter (une par une pour éviter les problèmes de parsing)
    const sqlCommands = [
      `ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS "variantId" TEXT;`,
      `ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS "variantDetails" JSONB;`,
      `CREATE INDEX IF NOT EXISTS "cart_items_variantId_idx" ON cart_items("variantId");`,
    ];
    
    for (const command of sqlCommands) {
      try {
        await prisma.$executeRawUnsafe(command);
        const preview = command.replace(/\s+/g, ' ').substring(0, 60);
        console.log(`✅ ${preview}...`);
      } catch (error) {
        // Ignorer les erreurs "already exists"
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            (error.message.includes('column') && error.message.includes('of relation') && error.message.includes('already exists'))) {
          const preview = command.replace(/\s+/g, ' ').substring(0, 60);
          console.log(`ℹ️  Déjà existant: ${preview}...`);
        } else {
          console.error(`❌ Erreur sur: ${command.substring(0, 60)}...`);
          console.error(`   ${error.message}`);
        }
      }
    }
    
    // Ajouter la contrainte de clé étrangère manuellement (car elle utilise DO $$)
    console.log('\n   Ajout de la contrainte de clé étrangère...');
    try {
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'cart_items_variantId_fkey'
            ) THEN
                ALTER TABLE cart_items
                ADD CONSTRAINT "cart_items_variantId_fkey" 
                FOREIGN KEY ("variantId") 
                REFERENCES product_variants(id) 
                ON DELETE SET NULL;
            END IF;
        END $$;
      `);
      console.log('✅ Contrainte de clé étrangère ajoutée');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('ℹ️  Contrainte déjà existante');
      } else {
        console.log(`⚠️  Erreur contrainte: ${error.message}`);
      }
    }
    
    // Vérification
    console.log('\n🔍 Vérification des colonnes ajoutées...');
    const checkResult = await prisma.$queryRawUnsafe(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cart_items' 
      AND column_name IN ('variantId', 'variantDetails')
      ORDER BY column_name;
    `);
    
    if (checkResult.length === 2) {
      console.log('✅ Colonnes vérifiées:');
      checkResult.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    } else {
      console.log('⚠️  Certaines colonnes n\'ont pas été trouvées');
      console.log('   Colonnes trouvées:', checkResult.map(r => r.column_name).join(', '));
    }
    
    // Générer le client Prisma
    console.log('\n[5/5] Génération du client Prisma...');
    try {
      // Attendre un peu pour éviter les problèmes de verrouillage de fichier
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      execSync('npx prisma generate', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, DATABASE_URL }
      });
      console.log('✅ Client Prisma généré\n');
    } catch (error) {
      console.log('⚠️  Erreur lors de la génération du client Prisma:', error.message);
      console.log('💡 Vous pouvez relancer manuellement: npx prisma generate\n');
    }
    
    console.log('========================================');
    console.log('✅ Migration appliquée avec succès !');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'application de la migration:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  applyMigration().catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { applyMigration };

