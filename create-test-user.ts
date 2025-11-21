import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Chercher un utilisateur existant
    let user = await prisma.user.findFirst({
      include: { addresses: true },
    });

    if (!user) {
      console.log('❌ Aucun utilisateur trouvé');
      console.log('💡 Créez d\'abord un utilisateur via l\'admin');
      return;
    }

    console.log(`✅ Utilisateur trouvé: ${user.email}`);

    // Vérifier si adresse existe
    if (user.addresses.length > 0) {
      console.log(`✅ Adresse(s) existante(s): ${user.addresses.length}`);
      const defaultAddr = user.addresses.find(a => a.isDefault);
      if (defaultAddr) {
        console.log(`✅ Adresse par défaut trouvée: ${defaultAddr.street}, ${defaultAddr.city}`);
        return;
      }
    }

    // Créer une adresse par défaut
    console.log('📝 Création adresse par défaut...');
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

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();

