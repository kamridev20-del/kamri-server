/**
 * Script pour synchroniser les variants CJ des produits existants
 * Usage: npx ts-node server/sync-cj-variants.ts [productId?]
 */

import { PrismaClient } from '@prisma/client';
import { CJAPIClient } from './src/cj-dropshipping/cj-api-client';

const prisma = new PrismaClient();

async function syncVariantsForProduct(productId?: string) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🔄 SYNCHRONISATION VARIANTS CJ');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Initialiser le client CJ
    const config = await prisma.cJConfig.findFirst({
      where: { enabled: true },
    });

    if (!config) {
      console.log('❌ Configuration CJ non trouvée ou inactive');
      return;
    }

    const client = new CJAPIClient(null as any);
    client.setConfig({
      email: config.email,
      apiKey: config.apiKey,
      tier: config.tier as any,
      platformToken: config.platformToken ?? undefined,
      debug: true,
    });

    // Charger le token manuellement depuis la base
    if (config.accessToken && config.refreshToken && config.tokenExpiry) {
      const expiryDate = new Date(config.tokenExpiry);
      // Vérifier si le token est encore valide (avec une marge de 1 heure)
      if (new Date() < new Date(expiryDate.getTime() - 60 * 60 * 1000)) {
        // Utiliser le token existant (on doit l'injecter directement dans le client)
        // Note: Le client n'a pas de méthode publique pour setToken, on doit utiliser login si nécessaire
        console.log('✅ Token valide trouvé en base (expire le ' + expiryDate.toISOString() + ')');
        // Le client utilisera le token via makeRequest qui charge automatiquement
      } else {
        console.log('⚠️ Token expiré, login requis...');
        await client.login();
      }
    } else {
      console.log('⚠️ Pas de token en base, login requis...');
      await client.login();
    }

    // Récupérer les produits CJ
    // Note: SQLite a des limitations avec les filtres "not null", on récupère tous les produits CJ et on filtre après
    const allProducts = await prisma.product.findMany({
      where: {
        source: 'cj-dropshipping',
      },
      include: {
        productVariants: true,
      },
    });

    // Filtrer ceux qui ont un cjProductId
    let products = allProducts.filter(p => p.cjProductId !== null);

    if (productId) {
      products = products.filter(p => p.id === productId);
    }

    console.log(`📦 ${products.length} produit(s) CJ trouvé(s)\n`);

    if (products.length === 0) {
      console.log('ℹ️ Aucun produit CJ à synchroniser');
      return;
    }

    let synced = 0;
    let failed = 0;
    let created = 0;
    let updated = 0;

    for (const product of products) {
      console.log(`\n📦 Produit: ${product.name} (${product.id})`);
      console.log(`   CJ Product ID: ${product.cjProductId}`);
      console.log(`   Variants existants: ${product.productVariants.length}`);

      try {
        // Récupérer les variants avec stock depuis CJ
        const variantsWithStock = await client.getProductVariantsWithStock(product.cjProductId!);

        if (!variantsWithStock || variantsWithStock.length === 0) {
          console.log(`   ⚠️ Aucun variant trouvé sur CJ pour ce produit`);
          continue;
        }

        console.log(`   ✅ ${variantsWithStock.length} variant(s) trouvé(s) sur CJ`);

        // Créer/mettre à jour chaque variant
        for (const variant of variantsWithStock) {
          try {
            // Parser variantKey
            let parsedKey = variant.variantKey;
            try {
              if (parsedKey && parsedKey.startsWith('[')) {
                const parsed = JSON.parse(parsedKey);
                parsedKey = Array.isArray(parsed) ? parsed.join('-') : parsedKey;
              }
            } catch {
              // Garder la valeur originale
            }

            const variantData = {
              name: variant.variantNameEn || variant.variantName || `Variant ${variant.variantSku}`,
              sku: variant.variantSku,
              price: variant.variantSellPrice,
              weight: variant.variantWeight,
              dimensions: variant.variantLength && variant.variantWidth && variant.variantHeight
                ? JSON.stringify({
                    length: variant.variantLength,
                    width: variant.variantWidth,
                    height: variant.variantHeight,
                    volume: variant.variantVolume,
                  })
                : null,
              image: variant.variantImage,
              stock: variant.stock || 0,
              properties: JSON.stringify({
                key: parsedKey,
                property: variant.variantProperty,
                standard: variant.variantStandard,
                unit: variant.variantUnit,
              }),
              status: (variant.stock || 0) > 0 ? 'available' : 'out_of_stock',
              lastSyncAt: new Date(),
            };

            const existing = await prisma.productVariant.findUnique({
              where: { cjVariantId: variant.vid },
            });

            if (existing) {
              await prisma.productVariant.update({
                where: { cjVariantId: variant.vid },
                data: variantData,
              });
              updated++;
              console.log(`      ✅ Variant ${variant.vid} mis à jour`);
            } else {
              await prisma.productVariant.create({
                data: {
                  ...variantData,
                  cjVariantId: variant.vid,
                  productId: product.id,
                },
              });
              created++;
              console.log(`      🆕 Variant ${variant.vid} créé`);
            }
          } catch (error: any) {
            console.log(`      ❌ Erreur variant ${variant.vid}: ${error.message}`);
            failed++;
          }
        }

        synced++;
      } catch (error: any) {
        console.log(`   ❌ Erreur pour ce produit: ${error.message}`);
        failed++;
      }

      // Pause pour respecter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`✅ Produits synchronisés: ${synced}`);
    console.log(`🆕 Variants créés: ${created}`);
    console.log(`🔄 Variants mis à jour: ${updated}`);
    console.log(`❌ Échecs: ${failed}`);

  } catch (error) {
    console.error('\n❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter
const productId = process.argv[2];
syncVariantsForProduct(productId);

