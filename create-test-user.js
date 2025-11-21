const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('🔍 Vérification de l\'utilisateur user-1...');
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { id: 'user-1' }
    });

    if (existingUser) {
      console.log('✅ Utilisateur user-1 existe déjà:', existingUser);
      return;
    }

    // Créer l'utilisateur de test
    const user = await prisma.user.create({
      data: {
        id: 'user-1',
        email: 'test@kamri.com',
        name: 'Utilisateur Test',
        role: 'user',
        status: 'active'
      }
    });

    console.log('✅ Utilisateur user-1 créé avec succès:', user);
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
