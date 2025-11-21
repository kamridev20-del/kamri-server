import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkImportedProduct() {
  console.log('📊 === VÉRIFICATION PRODUIT IMPORTÉ ===\n');
  
  try {
    // Récupérer le dernier produit importé
    const product = await prisma.product.findFirst({
      where: {
        cjProductId: { not: null }
      },
      include: {
        productVariants: {
          take: 10, // Limiter à 10 pour l'affichage
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!product) {
      console.log('❌ Aucun produit CJ trouvé dans la base de données');
      console.log('💡 Importez un produit depuis le dashboard admin');
      return;
    }
    
    console.log('✅ PRODUIT TROUVÉ:');
    console.log(`   Nom: ${product.name}`);
    console.log(`   ID: ${product.id}`);
    console.log(`   CJ Product ID: ${product.cjProductId}`);
    console.log(`   Importé le: ${product.createdAt.toLocaleString('fr-FR')}`);
    console.log('');
    
    // Compter tous les variants
    const totalVariants = await prisma.productVariant.count({
      where: { productId: product.id }
    });
    
    console.log(`📦 VARIANTS: ${totalVariants} au total`);
    console.log('');
    
    if (product.productVariants.length === 0) {
      console.log('⚠️ Aucun variant trouvé pour ce produit');
      return;
    }
    
    console.log('📊 DÉTAILS DES VARIANTS (10 premiers):');
    console.log('');
    
    // Analyser les stocks
    let stockPositif = 0;
    let stockZero = 0;
    let stockNull = 0;
    
    product.productVariants.forEach((variant, index) => {
      const stockDisplay = variant.stock !== null && variant.stock !== undefined
        ? (variant.stock > 0 ? `✅ ${variant.stock}` : `❌ ${variant.stock}`)
        : '⚪ NULL';
      
      const priceDisplay = variant.price ? `${variant.price}€` : 'N/A';
      
      console.log(`${index + 1}. ${variant.name || 'Variant ' + (index + 1)}`);
      console.log(`   SKU: ${variant.sku || 'N/A'}`);
      console.log(`   Prix: ${priceDisplay} | Stock: ${stockDisplay} | Poids: ${variant.weight || 'N/A'}g`);
      console.log('');
      
      // Comptabiliser
      if (variant.stock === null || variant.stock === undefined) {
        stockNull++;
      } else if (variant.stock > 0) {
        stockPositif++;
      } else {
        stockZero++;
      }
    });
    
    // Statistiques globales
    const allVariants = await prisma.productVariant.findMany({
      where: { productId: product.id },
      select: { stock: true }
    });
    
    const statsGlobales = allVariants.reduce(
      (acc, v) => {
        if (v.stock === null || v.stock === undefined) acc.null++;
        else if (v.stock > 0) acc.positif++;
        else acc.zero++;
        return acc;
      },
      { positif: 0, zero: 0, null: 0 }
    );
    
    console.log('📈 STATISTIQUES GLOBALES:');
    console.log(`   ✅ Variants avec stock > 0: ${statsGlobales.positif} (${((statsGlobales.positif / totalVariants) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Variants avec stock = 0: ${statsGlobales.zero} (${((statsGlobales.zero / totalVariants) * 100).toFixed(1)}%)`);
    console.log(`   ⚪ Variants sans stock (NULL): ${statsGlobales.null} (${((statsGlobales.null / totalVariants) * 100).toFixed(1)}%)`);
    console.log('');
    
    // Verdict
    if (statsGlobales.null === totalVariants) {
      console.log('❌ PROBLÈME: Aucun variant n\'a de stock défini !');
      console.log('💡 Vérifiez que l\'API CJ retourne bien les stocks');
      console.log('💡 Consultez les logs backend pendant l\'import');
    } else if (statsGlobales.positif > 0) {
      console.log('🎉 SUCCÈS: Des variants ont du stock !');
      console.log('✅ Le système fonctionne correctement');
    } else {
      console.log('⚠️ ATTENTION: Tous les variants sont en rupture de stock');
      console.log('💡 Ceci peut être normal si le produit n\'a vraiment plus de stock sur CJ');
    }
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkImportedProduct();

