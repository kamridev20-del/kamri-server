// ============================================================
// FICHIER: server/src/check-admin.ts
// ============================================================
// Script pour vérifier et créer l'utilisateur admin

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkAndCreateAdmin() {
  console.log('🔍 VÉRIFICATION DE L\'UTILISATEUR ADMIN...');
  
  try {
    // Vérifier si l'admin existe
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@kamri.com' }
    });

    if (admin) {
      console.log('✅ Admin trouvé:');
      console.log('   - ID:', admin.id);
      console.log('   - Email:', admin.email);
      console.log('   - Name:', admin.name);
      console.log('   - Role:', admin.role);
      console.log('   - Status:', admin.status);
      
      // Tester le mot de passe
      const isPasswordValid = await bcrypt.compare('admin123', admin.password);
      console.log('   - Mot de passe valide:', isPasswordValid);
      
      if (!isPasswordValid) {
        console.log('🔑 Mise à jour du mot de passe...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.update({
          where: { email: 'admin@kamri.com' },
          data: { password: hashedPassword }
        });
        console.log('✅ Mot de passe mis à jour');
      }
      
    } else {
      console.log('❌ Admin non trouvé, création...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const newAdmin = await prisma.user.create({
        data: {
          email: 'admin@kamri.com',
          name: 'Admin KAMRI',
          password: hashedPassword,
          role: 'admin',
          status: 'active',
        },
      });
      
      console.log('✅ Admin créé:');
      console.log('   - ID:', newAdmin.id);
      console.log('   - Email:', newAdmin.email);
      console.log('   - Role:', newAdmin.role);
    }

    console.log('\n🎉 UTILISATEUR ADMIN PRÊT !');
    console.log('📧 Email: admin@kamri.com');
    console.log('🔑 Mot de passe: admin123');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCreateAdmin();
