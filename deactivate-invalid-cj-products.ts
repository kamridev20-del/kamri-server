import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function deactivateInvalidProducts() {
  console.log('🔍 === VÉRIFICATION PRODUITS CJ INVALIDES ===\n');
  
  // 1. Récupérer le token CJ
  const config = await prisma.cJConfig.findFirst();
  
  if (!config || !config.accessToken) {
    console.error('❌ Token CJ introuvable');
    return;
  }
  
  const token = config.accessToken;
  
  // 2. Récupérer tous les produits CJ de KAMRI
  const products = await prisma.product.findMany({
    where: {
      cjProductId: { not: null },
      source: 'cj-dropshipping'
    },
    include: {
      productVariants: {
        take: 1 // Juste pour vérifier qu'il y a des variants
      }
    }
    // Limiter pour les tests (décommenter pour traiter tous les produits)
    // take: 50
  });
  
  console.log(`📦 ${products.length} produit(s) CJ trouvé(s) dans KAMRI\n`);
  
  let validCount = 0;
  let invalidCount = 0;
  const invalidProducts: any[] = [];
  
  // 3. Vérifier chaque produit
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const progress = `[${i + 1}/${products.length}]`;
    
    try {
      // Utiliser l'endpoint variant/query pour vérifier que le produit existe
      const response = await axios.get(
        'https://developers.cjdropshipping.com/api2.0/v1/product/variant/query',
        {
          headers: {
            'CJ-Access-Token': token
          },
          params: {
            pid: product.cjProductId
          }
        }
      );
      
      if (response.data.result && response.data.data) {
        const variants = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
        
        if (variants.length > 0) {
          validCount++;
          console.log(`${progress} ✅ ${(product.name || 'Sans nom').substring(0, 50)} - ${variants.length} variant(s)`);
        } else {
          invalidCount++;
          invalidProducts.push(product);
          console.log(`${progress} ❌ ${(product.name || 'Sans nom').substring(0, 50)} - Aucun variant`);
        }
      } else {
        invalidCount++;
        invalidProducts.push(product);
        console.log(`${progress} ❌ ${(product.name || 'Sans nom').substring(0, 50)} - INVALIDE (pas de résultat)`);
      }
      
      // Rate limiting (600ms entre chaque requête pour tier "plus")
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
    } catch (error: any) {
      invalidCount++;
      invalidProducts.push(product);
      const errorMsg = error.response?.data?.message || error.message || 'Erreur inconnue';
      console.log(`${progress} ❌ ${(product.name || 'Sans nom').substring(0, 50)} - ERREUR: ${errorMsg.substring(0, 50)}`);
    }
  }
  
  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Produits valides: ${validCount}`);
  console.log(`❌ Produits invalides: ${invalidCount}`);
  console.log('─────────────────────────────────────────\n');
  
  // 4. Désactiver les produits invalides
  if (invalidProducts.length > 0) {
    console.log(`⚠️ Désactivation de ${invalidProducts.length} produit(s) invalide(s)...\n`);
    
    for (const product of invalidProducts) {
      try {
        // Mettre à jour le statut du produit (status: pending, active, inactive, rejected)
        // Gérer les tags (JSON string)
        let updatedTags = product.tags;
        try {
          const tagsArray = product.tags ? JSON.parse(product.tags) : [];
          if (!tagsArray.includes('cj-invalide')) {
            tagsArray.push('cj-invalide');
            updatedTags = JSON.stringify(tagsArray);
          }
        } catch {
          // Si tags n'est pas un JSON valide, créer un nouveau tableau
          updatedTags = JSON.stringify(['cj-invalide']);
        }
        
        await prisma.product.update({
          where: { id: product.id },
          data: { 
            status: 'inactive', // Désactiver le produit
            tags: updatedTags // Ajouter le tag cj-invalide
          }
        });
        
        // Désactiver aussi les variants
        await prisma.productVariant.updateMany({
          where: { 
            productId: product.id 
          },
          data: {
            isActive: false
          }
        });
        
        console.log(`   ✅ ${(product.name || 'Sans nom').substring(0, 50)} - désactivé`);
      } catch (updateError: any) {
        console.error(`   ❌ Erreur désactivation ${product.id}: ${updateError.message}`);
      }
    }
    
    console.log('\n✅ Produits invalides désactivés avec succès');
  } else {
    console.log('✅ Tous les produits sont valides !');
  }
}

deactivateInvalidProducts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

