const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDuplicateUsers() {
  console.log('🧹 [CLEANUP] Début du nettoyage des utilisateurs dupliqués...');
  
  try {
    // Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`📊 [CLEANUP] ${users.length} utilisateurs trouvés`);
    
    // Grouper par email (insensible à la casse)
    const emailGroups = {};
    users.forEach(user => {
      const normalizedEmail = user.email.toLowerCase().trim();
      if (!emailGroups[normalizedEmail]) {
        emailGroups[normalizedEmail] = [];
      }
      emailGroups[normalizedEmail].push(user);
    });
    
    // Identifier les doublons
    const duplicates = Object.entries(emailGroups).filter(([email, users]) => users.length > 1);
    
    console.log(`🔍 [CLEANUP] ${duplicates.length} emails dupliqués trouvés`);
    
    for (const [email, duplicateUsers] of duplicates) {
      console.log(`\n📧 [CLEANUP] Email dupliqué: ${email}`);
      console.log(`👥 [CLEANUP] ${duplicateUsers.length} utilisateurs trouvés:`);
      
      duplicateUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ID: ${user.id}, Email: ${user.email}, Créé: ${user.createdAt}`);
      });
      
      // Garder le premier utilisateur (le plus ancien)
      const keepUser = duplicateUsers[0];
      const deleteUsers = duplicateUsers.slice(1);
      
      console.log(`✅ [CLEANUP] Garder: ${keepUser.id} (${keepUser.email})`);
      
      // Supprimer les doublons
      for (const deleteUser of deleteUsers) {
        console.log(`🗑️ [CLEANUP] Suppression: ${deleteUser.id} (${deleteUser.email})`);
        
        // Supprimer les relations d'abord
        await prisma.cartItem.deleteMany({ where: { userId: deleteUser.id } });
        await prisma.wishlist.deleteMany({ where: { userId: deleteUser.id } });
        await prisma.address.deleteMany({ where: { userId: deleteUser.id } });
        await prisma.order.deleteMany({ where: { userId: deleteUser.id } });
        
        // Supprimer l'utilisateur
        await prisma.user.delete({ where: { id: deleteUser.id } });
      }
    }
    
    console.log('\n✅ [CLEANUP] Nettoyage terminé !');
    
    // Vérifier le résultat
    const remainingUsers = await prisma.user.findMany();
    console.log(`📊 [CLEANUP] ${remainingUsers.length} utilisateurs restants`);
    
  } catch (error) {
    console.error('❌ [CLEANUP] Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateUsers();
