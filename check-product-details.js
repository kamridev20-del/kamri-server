const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProductData() {
  console.log('🔍 Vérification des données produits...\n');
  
  try {
    // Vérifier les fournisseurs avec produits
    const suppliers = await prisma.supplier.findMany({
      include: {
        products: {
          take: 2,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    console.log('📊 FOURNISSEURS ET PRODUITS:');
    suppliers.forEach(supplier => {
      console.log(`\nFournisseur: ${supplier.name}`);
      console.log(`Produits: ${supplier.products.length}`);
      
      supplier.products.forEach((product, index) => {
        console.log(`\n  Produit ${index + 1}:`);
        console.log(`  - ID: ${product.id}`);
        console.log(`  - Nom: ${product.name.substring(0, 50)}...`);
        console.log(`  - Image: ${product.image || 'MANQUANTE'}`);
        console.log(`  - Prix: ${product.price}`);
        console.log(`  - Source: ${product.source}`);
        console.log(`  - Status: ${product.status}`);
        console.log(`  - Description: ${product.description ? 'PRÉSENTE (' + product.description.length + ' chars)' : 'MANQUANTE'}`);
        
        if (product.source === 'cj-dropshipping') {
          console.log(`  - SKU CJ: ${product.productSku || 'MANQUANT'}`);
          console.log(`  - Poids: ${product.productWeight || 'MANQUANT'}`);
          console.log(`  - Matériau: ${product.materialNameEn || 'MANQUANT'}`);
          console.log(`  - Prix suggéré: ${product.suggestSellPrice || 'MANQUANT'}`);
          console.log(`  - Emballage: ${product.packingNameEn || 'MANQUANT'}`);
          console.log(`  - Catégorie externe: ${product.externalCategory || 'MANQUANTE'}`);
          
          if (product.variants) {
            try {
              const variants = JSON.parse(product.variants);
              console.log(`  - Variants: ${variants.length} trouvés`);
              if (variants.length > 0) {
                console.log(`    Premier variant: ${JSON.stringify(variants[0]).substring(0, 100)}...`);
              }
            } catch (e) {
              console.log(`  - Variants: ERREUR PARSING - ${e.message}`);
            }
          } else {
            console.log(`  - Variants: MANQUANTS`);
          }
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductData();