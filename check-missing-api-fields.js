// Script pour vérifier les champs manquants de l'API CJ

const API_FIELDS_DOC = {
  // Champs de base (déjà récupérés)
  basic: [
    'pid', 'productName', 'productNameEn', 'productSku', 'productImage',
    'productWeight', 'productUnit', 'productType', 'categoryName',
    'description', 'sellPrice', 'suggestSellPrice', 'listedNum',
    'supplierName', 'createrTime', 'status', 'variants'
  ],
  
  // Champs douaniers (à vérifier)
  customs: [
    'categoryId',      // ID catégorie
    'entryCode',       // HS code (code douanier)
    'entryName',       // Nom douanier (chinois)
    'entryNameEn'      // Nom douanier (anglais)
  ],
  
  // Champs matériau/emballage (partiellement récupérés)
  material: [
    'materialName',    // Nom matériau (chinois) - MANQUE
    'materialNameEn',  // ✅ Récupéré
    'materialKey',     // Attributs matériau - MANQUE
    'packingName',     // Nom emballage (chinois) - MANQUE
    'packingNameEn',   // ✅ Récupéré
    'packingKey',      // Attributs emballage - MANQUE
    'packWeight'       // ✅ Récupéré (packingWeight)
  ],
  
  // Champs attributs produit (partiellement récupérés)
  attributes: [
    'productKey',      // Attributs produit (chinois) - MANQUE
    'productKeyEn',   // ✅ Récupéré
    'productProSet',  // Attributs logistiques (chinois) - MANQUE
    'productProEnSet' // Attributs logistiques (anglais) - MANQUE
  ],
  
  // Champs personnalisation (MANQUENT)
  customization: [
    'customizationVersion', // Version personnalisation
    'customizationJson1',   // JSON personnalisation 1
    'customizationJson2',   // JSON personnalisation 2
    'customizationJson3',   // JSON personnalisation 3
    'customizationJson4'    // JSON personnalisation 4
  ],
  
  // Champs média (MANQUE)
  media: [
    'productVideo'     // Liste IDs vidéo (si features=enable_video)
  ],
  
  // Champs fournisseur (partiellement récupérés)
  supplier: [
    'supplierName',    // ✅ Récupéré
    'supplierId'       // ID fournisseur - MANQUE
  ],
  
  // Champs livraison (partiellement récupérés)
  shipping: [
    'addMarkStatus',   // ✅ Récupéré (mappé à isFreeShipping)
    'deliveryCycle'    // Partiellement récupéré
  ]
};

const CURRENTLY_SAVED = [
  // Champs de base
  'cjProductId', 'name', 'description', 'price', 'originalPrice', 'image',
  'category', 'status', 'isFavorite',
  // Champs détaillés
  'productSku', 'productWeight', 'packingWeight', 'productType', 'productUnit',
  'productKeyEn', 'materialNameEn', 'packingNameEn', 'suggestSellPrice',
  'listedNum', 'supplierName', 'createrTime',
  // JSON
  'variants', 'reviews', 'tags',
  // Autres
  'dimensions', 'brand',
  // Livraison
  'deliveryCycle', 'isFreeShipping', 'freeShippingCountries', 'defaultShippingMethod'
];

console.log('\n📊 === ANALYSE CHAMPS API CJ MANQUANTS ===\n');

console.log('✅ CHAMPS DÉJÀ RÉCUPÉRÉS:');
console.log('  - Champs de base: ✅');
console.log('  - materialNameEn: ✅');
console.log('  - packingNameEn: ✅');
console.log('  - productKeyEn: ✅');
console.log('  - addMarkStatus (isFreeShipping): ✅');
console.log('  - deliveryCycle: ✅ (partiel)\n');

console.log('❌ CHAMPS IMPORTANTS MANQUANTS:\n');

console.log('1️⃣ DOUANIERS (importants pour l\'export):');
API_FIELDS_DOC.customs.forEach(field => {
  console.log(`   - ${field}`);
});
console.log('');

console.log('2️⃣ MATÉRIAU/EMBALLAGE (complets):');
['materialName', 'materialKey', 'packingName', 'packingKey'].forEach(field => {
  console.log(`   - ${field}`);
});
console.log('');

console.log('3️⃣ ATTRIBUTS PRODUIT (complets):');
['productKey', 'productProSet', 'productProEnSet'].forEach(field => {
  console.log(`   - ${field}`);
});
console.log('');

console.log('4️⃣ PERSONNALISATION (si produits POD):');
API_FIELDS_DOC.customization.forEach(field => {
  console.log(`   - ${field}`);
});
console.log('');

console.log('5️⃣ MÉDIA:');
API_FIELDS_DOC.media.forEach(field => {
  console.log(`   - ${field}`);
});
console.log('');

console.log('6️⃣ FOURNISSEUR:');
console.log('   - supplierId');
console.log('');

console.log('💡 RECOMMANDATIONS:');
console.log('   - categoryId: Important pour la catégorisation');
console.log('   - entryCode/entryName: Essentiels pour les douanes');
console.log('   - materialKey/packingKey: Utiles pour la recherche');
console.log('   - productProSet/productProEnSet: Attributs logistiques');
console.log('   - supplierId: Pour lier au fournisseur');
console.log('   - productVideo: Si besoin de vidéos produits');
console.log('   - customizationJson: Si produits personnalisables (POD)\n');

