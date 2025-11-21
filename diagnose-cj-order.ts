import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseCJOrder(orderId: string) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🔍 DIAGNOSTIC COMMANDE CJ');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!orderId) {
    console.log('❌ Veuillez fournir un ID de commande');
    console.log('Usage: npx ts-node server/diagnose-cj-order.ts <orderId>');
    process.exit(1);
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                cjMapping: true,
                productVariants: {
                  where: {
                    cjVariantId: { not: null },
                  },
                  orderBy: {
                    createdAt: 'asc',
                  },
                },
              },
            },
          },
        },
        user: {
          include: {
            addresses: {
              where: {
                isDefault: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!order) {
      console.log(`❌ Commande ${orderId} introuvable`);
      process.exit(1);
    }

    console.log(`✅ Commande trouvée: ${order.id}`);
    console.log(`   Total: ${order.total}€`);
    console.log(`   Statut: ${order.status}`);
    console.log(`   Date: ${order.createdAt}\n`);

    console.log(`📦 ${order.items.length} article(s) dans la commande:\n`);

    let cjProductCount = 0;
    let validVariantCount = 0;
    const invalidProducts: any[] = [];

    for (const item of order.items) {
      const product = item.product;
      const isCJ = product.cjMapping !== null || 
                   (product.cjProductId !== null && product.source === 'cj-dropshipping');

      console.log(`\n📦 Produit: ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   CJ Product ID: ${product.cjProductId || '(aucun)'}`);
      console.log(`   Source: ${product.source || '(aucune)'}`);
      console.log(`   Est CJ: ${isCJ ? '✅ OUI' : '❌ NON'}`);
      console.log(`   Quantité: ${item.quantity}`);
      console.log(`   Prix: ${item.price}€`);

      if (isCJ) {
        cjProductCount++;

        console.log(`   Variants: ${product.productVariants.length}`);
        
        if (product.productVariants.length === 0) {
          console.log(`   ❌ PROBLÈME: Aucun variant avec cjVariantId`);
          invalidProducts.push({
            productId: product.id,
            productName: product.name,
            issue: 'Aucun variant avec cjVariantId',
          });
        } else {
          let hasValidVariant = false;
          for (const variant of product.productVariants) {
            console.log(`      - Variant ID: ${variant.id}`);
            console.log(`        cjVariantId: ${variant.cjVariantId || '(vide)'}`);
            console.log(`        isActive: ${variant.isActive}`);
            console.log(`        sku: ${variant.sku || '(vide)'}`);
            
            if (variant.cjVariantId && variant.cjVariantId.trim() !== '') {
              if (variant.isActive) {
                console.log(`        ✅ VALIDE (actif avec cjVariantId)`);
                hasValidVariant = true;
                validVariantCount++;
              } else {
                console.log(`        ⚠️  INACTIF (mais a cjVariantId)`);
              }
            } else {
              console.log(`        ❌ INVALIDE (pas de cjVariantId)`);
            }
          }

          if (!hasValidVariant) {
            invalidProducts.push({
              productId: product.id,
              productName: product.name,
              issue: 'Aucun variant actif avec cjVariantId',
            });
          }
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`Total produits: ${order.items.length}`);
    console.log(`Produits CJ: ${cjProductCount}`);
    console.log(`Variants valides: ${validVariantCount}`);
    console.log(`Produits invalides: ${invalidProducts.length}\n`);

    if (invalidProducts.length > 0) {
      console.log('❌ PRODUITS AVEC PROBLÈMES:\n');
      invalidProducts.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.productName} (${p.productId})`);
        console.log(`   Problème: ${p.issue}`);
      });
      console.log('\n💡 SOLUTION: Synchroniser les variants CJ pour ces produits');
      console.log('   Utiliser le bouton "Synchroniser tous les variants CJ"');
    } else if (cjProductCount > 0 && validVariantCount > 0) {
      console.log('✅ Tous les produits CJ ont des variants valides');
      console.log('💡 Si l\'erreur persiste, vérifier que les vid existent dans CJ');
    } else if (cjProductCount === 0) {
      console.log('ℹ️  Cette commande ne contient pas de produits CJ');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const orderId = process.argv[2];
diagnoseCJOrder(orderId);

