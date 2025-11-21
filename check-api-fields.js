const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Champs selon la doc API CJ
const API_FIELDS = {
  product: [
    'pid', 'productName', 'productNameEn', 'productSku', 'productImage',
    'productWeight', 'productUnit', 'productType', 'categoryId', 'categoryName',
    'entryCode', 'entryName', 'entryNameEn', 'materialName', 'materialNameEn',
    'materialKey', 'packingWeight', 'packingName', 'packingNameEn', 'packingKey',
    'productKey', 'productKeyEn', 'productPro', 'productProSet', 'productProEn',
    'productProEnSet', 'sellPrice', 'description', 'suggestSellPrice', 'listedNum',
    'status', 'supplierName', 'supplierId', 'customizationVersion',
    'customizationJson1', 'customizationJson2', 'customizationJson3', 'customizationJson4',
    'variants', 'createrTime'
  ],
  variant: [
    'vid', 'pid', 'variantName', 'variantNameEn', 'variantSku', 'variantUnit',
    'variantProperty', 'variantKey', 'variantLength', 'variantWidth', 'variantHeight',
    'variantVolume', 'variantWeight', 'variantSellPrice', 'createTime',
    'variantStandard', 'variantSugSellPrice', 'combineVariants'
  ]
};

(async () => {
  try {
    console.log('\n📊 === VÉRIFICATION CHAMPS API CJ ===\n');
    
    // Récupérer un produit récent
    const product = await prisma.cJProductStore.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        cjProductId: true,
        name: true,
        productSku: true,
        productWeight: true,
        packingWeight: true,
        productType: true,
        productUnit: true,
        productKeyEn: true,
        materialNameEn: true,
        packingNameEn: true,
        suggestSellPrice: true,
        listedNum: true,
        supplierName: true,
        createrTime: true,
        variants: true
      }
    });
    
    if (!product) {
      console.log('❌ Aucun produit trouvé');
      await prisma.$disconnect();
      return;
    }
    
    console.log('📦 PRODUIT ANALYSÉ:', product.name.substring(0, 60));
    console.log('CJ PID:', product.cjProductId);
    console.log('');
    
    // Vérifier les champs récupérés
    console.log('✅ CHAMPS RÉCUPÉRÉS:');
    const retrievedFields = [];
    if (product.productSku) retrievedFields.push('productSku');
    if (product.productWeight) retrievedFields.push('productWeight');
    if (product.packingWeight) retrievedFields.push('packingWeight');
    if (product.productType) retrievedFields.push('productType');
    if (product.productUnit) retrievedFields.push('productUnit');
    if (product.productKeyEn) retrievedFields.push('productKeyEn');
    if (product.materialNameEn) retrievedFields.push('materialNameEn');
    if (product.packingNameEn) retrievedFields.push('packingNameEn');
    if (product.suggestSellPrice) retrievedFields.push('suggestSellPrice');
    if (product.listedNum) retrievedFields.push('listedNum');
    if (product.supplierName) retrievedFields.push('supplierName');
    if (product.createrTime) retrievedFields.push('createrTime');
    
    console.log('  -', retrievedFields.join(', '));
    console.log('');
    
    // Champs manquants dans le schéma
    console.log('❌ CHAMPS MANQUANTS (dans schéma Prisma):');
    const missingInSchema = [
      'categoryId', 'entryCode', 'entryName', 'entryNameEn',
      'materialName', 'materialKey', 'packingName', 'packingKey',
      'productKey', 'productPro', 'productProSet', 'productProEn',
      'productProEnSet', 'supplierId', 'customizationVersion',
      'customizationJson1', 'customizationJson2', 'customizationJson3', 'customizationJson4'
    ];
    console.log('  -', missingInSchema.join(', '));
    console.log('');
    
    // Analyser les variants
    if (product.variants) {
      try {
        const variants = JSON.parse(product.variants);
        if (variants.length > 0) {
          const firstVariant = variants[0];
          console.log('📋 PREMIER VARIANT:');
          console.log('  Champs présents:', Object.keys(firstVariant).join(', '));
          console.log('');
          
          const variantFields = [
            'variantSugSellPrice', 'createTime', 'combineVariants'
          ];
          const missingVariantFields = variantFields.filter(f => !firstVariant.hasOwnProperty(f));
          if (missingVariantFields.length > 0) {
            console.log('❌ CHAMPS VARIANT MANQUANTS:');
            console.log('  -', missingVariantFields.join(', '));
          }
        }
      } catch (e) {
        console.log('⚠️ Erreur parsing variants:', e.message);
      }
    }
    
    console.log('\n==============================================');
    console.log('💡 RECOMMANDATION:');
    console.log('  - Les champs manquants peuvent être ajoutés au schéma si nécessaire');
    console.log('  - Certains champs (comme customizationJson) sont peut-être optionnels');
    console.log('==============================================\n');
    
    await prisma.$disconnect();
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();

