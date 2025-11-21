/**
 * Script pour créer un utilisateur de test avec une adresse complète
 * Usage: npx ts-node server/create-test-user-with-address.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUserWithAddress() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   👤 CRÉATION UTILISATEUR DE TEST AVEC ADRESSE');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Vérifier si un utilisateur de test existe déjà
    const existingTestUser = await prisma.user.findFirst({
      where: {
        email: 'test@kamri.com',
      },
      include: {
        addresses: true,
      },
    });

    if (existingTestUser) {
      console.log(`✅ Utilisateur de test existe déjà: ${existingTestUser.email}`);
      
      // Vérifier si adresse existe
      if (existingTestUser.addresses.length > 0) {
        const defaultAddr = existingTestUser.addresses.find(a => a.isDefault);
        if (defaultAddr) {
          console.log(`✅ Adresse par défaut trouvée:`);
          console.log(`   ${defaultAddr.street}`);
          console.log(`   ${defaultAddr.city}, ${defaultAddr.state} ${defaultAddr.zipCode}`);
          console.log(`   ${defaultAddr.country}`);
          console.log(`\n📋 ID Utilisateur: ${existingTestUser.id}`);
          console.log(`📋 Email: ${existingTestUser.email}`);
          return;
        }
      }

      // Créer une adresse si elle n'existe pas
      console.log('📝 Création adresse par défaut...');
      const address = await prisma.address.create({
        data: {
          userId: existingTestUser.id,
          street: '123 Test Street',
          city: 'Paris',
          state: 'Île-de-France',
          zipCode: '75001',
          country: 'France',
          isDefault: true,
        },
      });

      console.log(`✅ Adresse créée: ${address.id}`);
      console.log(`   ${address.street}, ${address.city}, ${address.country}`);
      console.log(`\n📋 ID Utilisateur: ${existingTestUser.id}`);
      console.log(`📋 Email: ${existingTestUser.email}`);
      return;
    }

    // Créer un nouvel utilisateur de test
    console.log('📝 Création nouvel utilisateur de test...');
    const hashedPassword = await bcrypt.hash('test123', 10);

    const user = await prisma.user.create({
      data: {
        email: 'test@kamri.com',
        name: 'Test User',
        password: hashedPassword,
        role: 'user',
        phone: '+33123456789',
        addresses: {
          create: {
            street: '123 Test Street',
            city: 'Paris',
            state: 'Île-de-France',
            zipCode: '75001',
            country: 'France',
            isDefault: true,
          },
        },
      },
      include: {
        addresses: true,
      },
    });

    console.log(`✅ Utilisateur créé: ${user.email}`);
    console.log(`✅ Adresse créée: ${user.addresses[0].street}, ${user.addresses[0].city}`);
    console.log(`\n📋 ID Utilisateur: ${user.id}`);
    console.log(`📋 Email: ${user.email}`);
    console.log(`📋 Mot de passe: test123`);
    console.log(`\n✅ Utilisateur de test prêt à être utilisé !`);

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    if (error.code === 'P2002') {
      console.error('💡 L\'email test@kamri.com existe déjà avec un autre ID');
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUserWithAddress();

