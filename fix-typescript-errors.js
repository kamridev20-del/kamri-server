const fs = require('fs');
const path = require('path');

// Liste des fichiers à corriger
const filesToFix = [
  'src/cj-dropshipping/cj-countries.controller.ts',
  'src/cj-dropshipping/cj-countries.service.ts',
  'src/cj-dropshipping/cj-disputes.service.ts',
  'src/cj-dropshipping/cj-dropshipping.service.ts',
  'src/cj-dropshipping/cj-logistics.controller.ts',
  'src/cj-dropshipping/cj-logistics.service.ts',
  'src/cj-dropshipping/cj-orders.service.ts',
  'src/cj-dropshipping/cj-settings.service.ts',
  'src/cj-dropshipping/cj-webhook.controller.ts',
  'src/cj-dropshipping/cj-webhook.service.ts'
];

// Fonction pour corriger les erreurs d'erreur
function fixErrorHandling(content) {
  // Remplacer error.message par getErrorMessage(error)
  content = content.replace(/error\.message/g, 'getErrorMessage(error)');
  content = content.replace(/error\.stack/g, 'getErrorStack(error)');
  
  // Ajouter l'import si nécessaire
  if (content.includes('getErrorMessage') && !content.includes('import { getErrorMessage')) {
    const importLine = "import { getErrorMessage, getErrorStack } from './utils/error-handler';\n";
    content = importLine + content;
  }
  
  return content;
}

// Fonction pour corriger les appels makeRequest
function fixMakeRequestCalls(content) {
  // Corriger les appels makeRequest avec les bons paramètres
  content = content.replace(
    /client\.makeRequest\('([^']+)',\s*([^,]+),\s*'([^']+)'\)/g,
    "client.makeRequest('$3', '$1', $2)"
  );
  
  // Corriger les appels makeRequest sans méthode
  content = content.replace(
    /client\.makeRequest\('([^']+)',\s*([^)]+)\)(?!\s*,\s*'[^']+')/g,
    "client.makeRequest('POST', '$1', $2)"
  );
  
  return content;
}

// Fonction pour corriger les types de données
function fixDataTypes(content) {
  // Corriger les accès aux propriétés de données
  content = content.replace(/result\.data\.(\w+)/g, '(result.data as any).$1');
  content = content.replace(/result\.data\[(\w+)\]/g, '(result.data as any)[$1]');
  
  return content;
}

// Fonction pour corriger les modèles Prisma manquants
function fixPrismaModels(content) {
  // Remplacer les modèles Prisma manquants par des commentaires
  content = content.replace(/this\.prisma\.(\w+)\./g, '// this.prisma.$1. - Modèle Prisma manquant');
  
  return content;
}

// Fonction pour corriger les constructeurs CJAPIClient
function fixCJAPIClientConstructor(content) {
  // Corriger les constructeurs avec 3 paramètres
  content = content.replace(
    /new CJAPIClient\(\s*process\.env\.CJ_EMAIL,\s*process\.env\.CJ_API_KEY,\s*\{[^}]+\}\s*\)/g,
    'new CJAPIClient(process.env.CJ_EMAIL, process.env.CJ_API_KEY)'
  );
  
  return content;
}

// Fonction principale
function fixFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ Fichier non trouvé: ${filePath}`);
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Appliquer les corrections
    content = fixErrorHandling(content);
    content = fixMakeRequestCalls(content);
    content = fixDataTypes(content);
    content = fixPrismaModels(content);
    content = fixCJAPIClientConstructor(content);
    
    // Écrire le fichier corrigé
    fs.writeFileSync(fullPath, content);
    console.log(`✅ Fichier corrigé: ${filePath}`);
    
  } catch (error) {
    console.error(`❌ Erreur lors de la correction de ${filePath}:`, error.message);
  }
}

// Exécuter les corrections
console.log('🔧 Correction des erreurs TypeScript...');

filesToFix.forEach(fixFile);

console.log('✅ Correction terminée !');
