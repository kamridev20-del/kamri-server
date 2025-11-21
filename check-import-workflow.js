const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkImportWorkflow() {
  console.log('🔍 Vérification du workflow d\'import CJ...\n');

  try {
    // 1. Vérifier les produits dans CJProductStore
    console.log('📦 État du magasin CJ (CJProductStore):');
    const cjProducts = await prisma.cJProductStore.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   - Total produits CJ: ${cjProducts.length}`);
    
    // Grouper par statut
    const statusGroups = cjProducts.reduce((acc, product) => {
      acc[product.status] = (acc[product.status] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(statusGroups).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} produits`);
    });
    
    console.log('');

    // 2. Vérifier les produits dans Product (magasin principal)
    console.log('🏪 État du magasin principal (Product):');
    const products = await prisma.product.findMany({
      include: {
        supplier: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   - Total produits dans le magasin: ${products.length}`);
    
    // Grouper par fournisseur
    const supplierGroups = products.reduce((acc, product) => {
      const supplierName = product.supplier?.name || 'Sans fournisseur';
      acc[supplierName] = (acc[supplierName] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(supplierGroups).forEach(([supplier, count]) => {
      console.log(`   - ${supplier}: ${count} produits`);
    });
    
    console.log('');

    // 3. Vérifier les liens entre CJ et le magasin principal
    console.log('🔗 Analyse des liens CJ → Magasin principal:');
    
    const cjAvailableProducts = cjProducts.filter(p => p.status === 'available');
    console.log(`   - Produits CJ 'available': ${cjAvailableProducts.length}`);
    
    // Chercher des produits dans le magasin principal qui pourraient être liés à CJ
    const cjSupplier = await prisma.supplier.findFirst({
      where: { name: 'CJ Dropshipping' }
    });
    
    if (cjSupplier) {
      const cjMainProducts = await prisma.product.findMany({
        where: { supplierId: cjSupplier.id }
      });
      console.log(`   - Produits CJ dans le magasin principal: ${cjMainProducts.length}`);
      
      if (cjMainProducts.length > 0) {
        console.log('\n📋 Détails des produits CJ dans le magasin principal:');
        cjMainProducts.slice(0, 3).forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name} - Prix: $${product.price} - Status: ${product.status}`);
        });
      }
    } else {
      console.log('   - Fournisseur CJ Dropshipping non trouvé');
    }
    
    console.log('');

    // 4. Résumé du workflow
    console.log('🎯 Résumé du workflow d\'import:');
    console.log('   1. 🔍 Import depuis page Products → Sauvegarde dans CJProductStore avec status "available"');
    console.log('   2. 🏪 Pour aller dans le magasin → Il faut passer par la page Stores');
    console.log('   3. 📦 Stores → Sélectionner produits → Import final vers Product table');
    console.log('');
    
    // 5. Test avec un produit spécifique
    if (cjProducts.length > 0) {
      const testProduct = cjProducts[0];
      console.log('🧪 Test avec le premier produit CJ:');
      console.log(`   - Nom: ${testProduct.name}`);
      console.log(`   - Status: ${testProduct.status}`);
      console.log(`   - CJ Product ID: ${testProduct.cjProductId}`);
      
      // Chercher s'il existe dans le magasin principal
      const mainStoreProduct = await prisma.product.findFirst({
        where: {
          name: testProduct.name
        },
        include: { supplier: true }
      });
      
      if (mainStoreProduct) {
        console.log(`   ✅ Trouvé dans le magasin principal: ${mainStoreProduct.name} (${mainStoreProduct.supplier?.name})`);
      } else {
        console.log(`   ❌ Pas encore dans le magasin principal`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkImportWorkflow();