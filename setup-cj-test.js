// Script pour activer l'intégration CJ en mode test
const axios = require('axios');

const baseUrl = 'http://localhost:3001';

async function activateCJIntegration() {
  console.log('🔧 Activation de l\'intégration CJ...');
  
  const config = {
    email: 'test@example.com',
    apiKey: 'test-key',
    tier: 'free',
    enabled: true // ✅ Activer l'intégration
  };

  try {
    const response = await axios.put(`${baseUrl}/api/cj-dropshipping/config`, config);
    console.log('✅ Configuration CJ mise à jour:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur configuration:', error.response?.data || error.message);
    return null;
  }
}

// Test simple de sanité
async function testHealthCheck() {
  console.log('🏥 Test de sanité serveur...');
  
  try {
    const response = await axios.get(`${baseUrl}/api/health`);
    console.log('✅ Serveur OK:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Serveur non accessible:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 === CONFIGURATION CJ POUR TESTS ===\n');
  
  // Test 1: Vérifier que le serveur répond
  await testHealthCheck();
  console.log('');
  
  // Test 2: Activer l'intégration CJ
  await activateCJIntegration();
  console.log('');
  
  console.log('✨ Configuration terminée !');
  console.log('💡 Vous pouvez maintenant tester les webhooks avec test-webhooks.js');
}

main().catch(console.error);