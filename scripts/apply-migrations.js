#!/usr/bin/env node

/**
 * Script pour appliquer les migrations Prisma et les modifications SQL
 * Usage: node scripts/apply-migrations.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:avUQefgltUYjOGVtXyouUFwtEyeLshdY@yamabiko.proxy.rlwy.net:28846/railway';

console.log('🚀 Début de l\'application des migrations...\n');

try {
  // 1. Vérifier l'état des migrations Prisma
  console.log('📊 Vérification de l\'état des migrations Prisma...');
  try {
    execSync('npx prisma migrate status', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL }
    });
  } catch (error) {
    console.log('⚠️  Erreur lors de la vérification, continuation...');
  }

  // 2. Appliquer les migrations Prisma manquantes
  console.log('\n📦 Application des migrations Prisma...');
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL }
    });
    console.log('✅ Migrations Prisma appliquées avec succès');
  } catch (error) {
    console.log('⚠️  Erreur lors de l\'application des migrations Prisma, tentative avec SQL direct...');
  }

  // 3. Appliquer la migration SQL pour variantId et variantDetails
  console.log('\n🔧 Application de la migration SQL pour variantId et variantDetails...');
  const sqlFile = path.join(__dirname, 'add-variant-details-to-cart.sql');
  
  if (fs.existsSync(sqlFile)) {
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Extraire les informations de connexion depuis DATABASE_URL
    const urlMatch = DATABASE_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!urlMatch) {
      throw new Error('Format DATABASE_URL invalide');
    }
    
    const [, username, password, host, port, database] = urlMatch;
    
    // Exécuter le SQL avec psql
    const psqlCommand = `PGPASSWORD=${password} psql -h ${host} -U ${username} -p ${port} -d ${database} -f "${sqlFile}"`;
    
    try {
      execSync(psqlCommand, {
        stdio: 'inherit',
        shell: true
      });
      console.log('✅ Migration SQL appliquée avec succès');
    } catch (error) {
      console.log('⚠️  Erreur lors de l\'exécution SQL, vérifiez que psql est installé');
      console.log('💡 Vous pouvez exécuter manuellement:');
      console.log(`   PGPASSWORD=${password} psql -h ${host} -U ${username} -p ${port} -d ${database} -f "${sqlFile}"`);
    }
  } else {
    console.log('⚠️  Fichier SQL non trouvé:', sqlFile);
  }

  // 4. Générer le client Prisma
  console.log('\n🔨 Génération du client Prisma...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL }
  });
  console.log('✅ Client Prisma généré avec succès');

  console.log('\n✅ Toutes les migrations ont été appliquées avec succès !');
  
} catch (error) {
  console.error('\n❌ Erreur lors de l\'application des migrations:', error.message);
  process.exit(1);
}


