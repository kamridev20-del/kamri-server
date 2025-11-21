const { PrismaClient } = require('@prisma/client');

async function checkSuppliersInDB() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Vérification des fournisseurs dans la base de données...\n');
    
    // Compter tous les fournisseurs
    const totalSuppliers = await prisma.supplier.count();
    console.log(`📊 Total fournisseurs: ${totalSuppliers}`);
    
    // Compter les fournisseurs connectés
    const connectedSuppliers = await prisma.supplier.count({
      where: { status: 'connected' }
    });
    console.log(`✅ Fournisseurs connectés: ${connectedSuppliers}`);
    
    // Lister tous les fournisseurs
    const allSuppliers = await prisma.supplier.findMany();
    console.log('\n📋 Liste des fournisseurs:');
    allSuppliers.forEach(supplier => {
      console.log(`- ${supplier.name} (ID: ${supplier.id}, Status: ${supplier.status})`);
    });
    
    // Rechercher spécifiquement CJ Dropshipping
    const cjSupplier = await prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' }
    });
    
    if (cjSupplier) {
      console.log(`\n🎯 CJ Dropshipping trouvé:`);
      console.log(`   - ID: ${cjSupplier.id}`);
      console.log(`   - Nom: ${cjSupplier.name}`);
      console.log(`   - Status: ${cjSupplier.status}`);
      console.log(`   - Description: ${cjSupplier.description}`);
      console.log(`   - Dernière sync: ${cjSupplier.lastSync}`);
    } else {
      console.log('\n❌ Aucun fournisseur CJ Dropshipping trouvé dans la base de données');
    }
    
    // Vérifier les statistiques du dashboard
    console.log('\n📈 Test des statistiques dashboard:');
    const dashboardStats = {
      connectedSuppliers: await prisma.supplier.count({
        where: { status: 'connected' }
      })
    };
    console.log(`   Dashboard connectedSuppliers: ${dashboardStats.connectedSuppliers}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSuppliersInDB();