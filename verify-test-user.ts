/**
 * Script pour vérifier que l'utilisateur de test existe et a une adresse
 * Usage: npx ts-node server/verify-test-user.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTestUser() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🔍 VÉRIFICATION UTILISATEUR DE TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Chercher l'utilisateur de test
    const user = await prisma.user.findFirst({
      where: {
        email: 'test@kamri.com',
      },
      include: {
        addresses: true,
      },
    });

    if (!user) {
      console.log('❌ Utilisateur de test NON TROUVÉ');
      console.log('💡 Exécutez: npx ts-node server/create-test-user-with-address.ts');
      return;
    }

    console.log(`✅ Utilisateur trouvé:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nom: ${user.name || 'N/A'}`);
    console.log(`   Rôle: ${user.role}`);
    console.log(`   Statut: ${user.status}`);

    if (user.addresses.length === 0) {
      console.log('\n⚠️ AUCUNE ADRESSE TROUVÉE');
      console.log('💡 Création d\'une adresse par défaut...');
      
      const address = await prisma.address.create({
        data: {
          userId: user.id,
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
    } else {
      console.log(`\n✅ ${user.addresses.length} adresse(s) trouvée(s):`);
      user.addresses.forEach((addr, index) => {
        console.log(`\n   Adresse ${index + 1}:`);
        console.log(`   ID: ${addr.id}`);
        console.log(`   ${addr.street}`);
        console.log(`   ${addr.city}, ${addr.state} ${addr.zipCode}`);
        console.log(`   ${addr.country}`);
        console.log(`   Par défaut: ${addr.isDefault ? 'Oui' : 'Non'}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   ✅ UTILISATEUR DE TEST PRÊT');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`\n📋 ID à utiliser: ${user.id}`);

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTestUser();

