// ============================================================
// FICHIER: server/src/create-admin.ts
// ============================================================
// Script pour créer l'utilisateur admin avec mot de passe

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  console.log('🔐 CRÉATION DE L\'UTILISATEUR ADMIN...');
  
  try {
    // Vérifier si l'admin existe déjà
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@kamri.com' }
    });

    if (existingAdmin) {
      console.log('✅ Admin existe déjà:', existingAdmin.email);
      console.log('🔑 Mise à jour du mot de passe...');
      
      // Mettre à jour le mot de passe
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.update({
        where: { email: 'admin@kamri.com' },
        data: { password: hashedPassword }
      });
      
      console.log('✅ Mot de passe admin mis à jour');
    } else {
      console.log('👤 Création de l\'utilisateur admin...');
      
      // Créer l'admin avec mot de passe hashé
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const admin = await prisma.user.create({
        data: {
          email: 'admin@kamri.com',
          name: 'Admin KAMRI',
          password: hashedPassword,
          role: 'admin',
          status: 'active',
        },
      });
      
      console.log('✅ Admin créé:', admin.id);
    }

    console.log('\n🎉 UTILISATEUR ADMIN PRÊT !');
    console.log('📧 Email: admin@kamri.com');
    console.log('🔑 Mot de passe: admin123');
    console.log('👤 Role: admin');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
