// ============================================================
// FICHIER: server/src/cj-dropshipping/diagnose-connection.ts
// ============================================================
// Script de diagnostic pour tester la connexion CJ Dropshipping

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface TestResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚠️';
  console.log(`${icon} ${result.step}: ${result.message}`);
  if (result.details) {
    console.log('   Details:', JSON.stringify(result.details, null, 2));
  }
}

async function diagnoseConnection() {
  console.log('🔍 DIAGNOSTIC DE CONNEXION CJ DROPSHIPPING');
  console.log('============================================\n');

  // ============================================================
  // TEST 1: Vérification des variables d'environnement
  // ============================================================
  console.log('1️⃣ Vérification des variables d\'environnement...\n');

  const email = process.env.CJ_EMAIL;
  const apiKey = process.env.CJ_API_KEY;
  const tier = process.env.CJ_TIER || 'free';

  if (!email) {
    logResult({
      step: 'Variable CJ_EMAIL',
      status: 'error',
      message: 'CJ_EMAIL non définie dans .env',
      details: {
        solution: 'Ajouter CJ_EMAIL=your@email.com dans server/.env',
      },
    });
  } else {
    logResult({
      step: 'Variable CJ_EMAIL',
      status: 'success',
      message: `Email trouvé: ${email}`,
    });
  }

  if (!apiKey) {
    logResult({
      step: 'Variable CJ_API_KEY',
      status: 'error',
      message: 'CJ_API_KEY non définie dans .env',
      details: {
        solution: 'Ajouter CJ_API_KEY=your_api_key dans server/.env',
        howToGet: 'Aller sur https://cjdropshipping.com > Developer > API Key > Generate',
      },
    });
  } else {
    const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
    logResult({
      step: 'Variable CJ_API_KEY',
      status: 'success',
      message: `API Key trouvée: ${maskedKey}`,
      details: {
        length: apiKey.length,
        format: apiKey.length >= 32 ? 'OK' : 'Trop courte (doit être >= 32 caractères)',
      },
    });
  }

  logResult({
    step: 'Variable CJ_TIER',
    status: 'success',
    message: `Tier: ${tier}`,
    details: {
      rateLimit: tier === 'free' ? '1 req/s' : tier === 'plus' ? '2 req/s' : tier === 'prime' ? '4 req/s' : '6 req/s',
    },
  });

  if (!email || !apiKey) {
    console.log('\n❌ ARRÊT: Variables d\'environnement manquantes\n');
    return;
  }

  // ============================================================
  // TEST 2: Test de connectivité réseau
  // ============================================================
  console.log('\n2️⃣ Test de connectivité réseau...\n');

  const baseURL = 'https://developers.cjdropshipping.com';

  try {
    const response = await axios.get(baseURL, { timeout: 5000 });
    logResult({
      step: 'Connectivité réseau',
      status: 'success',
      message: `Serveur CJ accessible (HTTP ${response.status})`,
    });
  } catch (error: any) {
    logResult({
      step: 'Connectivité réseau',
      status: 'error',
      message: 'Impossible de joindre le serveur CJ',
      details: {
        error: error.message,
        solution: 'Vérifier votre connexion Internet ou firewall',
      },
    });
    console.log('\n❌ ARRÊT: Serveur CJ inaccessible\n');
    return;
  }

  // ============================================================
  // TEST 3: Test de l'endpoint d'authentification
  // ============================================================
  console.log('\n3️⃣ Test de l\'endpoint d\'authentification...\n');

  const authURL = `${baseURL}/api2.0/v1/authentication/getAccessToken`;

  try {
    // Test avec credentials vides pour voir si l'endpoint répond
    const testResponse = await axios.post(
      authURL,
      { email: '', apiKey: '' },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: () => true, // Accepter tous les status codes
      }
    );

    logResult({
      step: 'Endpoint authentication',
      status: 'success',
      message: `Endpoint accessible (HTTP ${testResponse.status})`,
      details: {
        response: testResponse.data,
      },
    });
  } catch (error: any) {
    logResult({
      step: 'Endpoint authentication',
      status: 'error',
      message: 'Endpoint d\'authentification inaccessible',
      details: {
        error: error.message,
        url: authURL,
      },
    });
  }

  // ============================================================
  // TEST 4: Test d'authentification avec vraies credentials
  // ============================================================
  console.log('\n4️⃣ Test d\'authentification avec vos credentials...\n');

  try {
    const loginResponse = await axios.post(
      authURL,
      {
        email: email,
        apiKey: apiKey,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
        validateStatus: () => true,
      }
    );

    console.log('📦 Réponse complète:', JSON.stringify(loginResponse.data, null, 2));

    if (loginResponse.status === 200 && loginResponse.data.code === 200) {
      logResult({
        step: 'Authentification',
        status: 'success',
        message: '✅ CONNEXION RÉUSSIE !',
        details: {
          accessToken: loginResponse.data.data.accessToken.substring(0, 20) + '...',
          expiryDate: loginResponse.data.data.accessTokenExpiryDate,
          refreshToken: 'OK',
        },
      });
    } else {
      logResult({
        step: 'Authentification',
        status: 'error',
        message: 'Échec de l\'authentification',
        details: {
          httpStatus: loginResponse.status,
          cjCode: loginResponse.data.code,
          cjMessage: loginResponse.data.message,
          requestId: loginResponse.data.requestId,
        },
      });

      // Analyse des erreurs communes
      if (loginResponse.data.code === 1601000) {
        console.log('\n⚠️  CAUSE: Utilisateur non trouvé');
        console.log('   Solutions:');
        console.log('   - Vérifier que l\'email est correct');
        console.log('   - Vérifier que le compte CJ existe');
        console.log('   - Créer un compte sur https://cjdropshipping.com');
      } else if (loginResponse.data.code === 1600005) {
        console.log('\n⚠️  CAUSE: Email ou API Key incorrect');
        console.log('   Solutions:');
        console.log('   - Vérifier l\'email dans .env');
        console.log('   - Régénérer l\'API Key sur CJ Dashboard');
        console.log('   - S\'assurer d\'utiliser apiKey et non password');
      } else if (loginResponse.data.code === 1600001) {
        console.log('\n⚠️  CAUSE: API Key invalide');
        console.log('   Solutions:');
        console.log('   - Régénérer une nouvelle API Key');
        console.log('   - Copier/coller sans espaces');
        console.log('   - Vérifier qu\'elle n\'a pas expiré');
      }
    }
  } catch (error: any) {
    logResult({
      step: 'Authentification',
      status: 'error',
      message: 'Erreur lors de la requête d\'authentification',
      details: {
        error: error.message,
        stack: error.stack,
      },
    });
  }

  // ============================================================
  // TEST 5: Vérification du format des credentials
  // ============================================================
  console.log('\n5️⃣ Vérification du format des credentials...\n');

  // Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(email!)) {
    logResult({
      step: 'Format email',
      status: 'success',
      message: 'Format email valide',
    });
  } else {
    logResult({
      step: 'Format email',
      status: 'warning',
      message: 'Format email potentiellement invalide',
      details: {
        email: email,
        expected: 'user@example.com',
      },
    });
  }

  // API Key
  if (apiKey!.length >= 32 && /^[a-zA-Z0-9]+$/.test(apiKey!)) {
    logResult({
      step: 'Format API Key',
      status: 'success',
      message: 'Format API Key valide',
    });
  } else {
    logResult({
      step: 'Format API Key',
      status: 'warning',
      message: 'Format API Key suspect',
      details: {
        length: apiKey!.length,
        expectedLength: '>= 32',
        hasSpaces: apiKey!.includes(' '),
        hasSpecialChars: !/^[a-zA-Z0-9]+$/.test(apiKey!),
      },
    });
  }

  // ============================================================
  // RÉSUMÉ
  // ============================================================
  console.log('\n============================================');
  console.log('📊 RÉSUMÉ DU DIAGNOSTIC');
  console.log('============================================\n');

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const warningCount = results.filter(r => r.status === 'warning').length;

  console.log(`✅ Succès: ${successCount}`);
  console.log(`❌ Erreurs: ${errorCount}`);
  console.log(`⚠️  Avertissements: ${warningCount}`);

  if (errorCount === 0) {
    console.log('\n🎉 Tous les tests sont passés ! La connexion devrait fonctionner.');
  } else {
    console.log('\n❌ Des erreurs ont été détectées. Consultez les détails ci-dessus.');
  }

  // ============================================================
  // GUIDE DE RÉSOLUTION
  // ============================================================
  console.log('\n============================================');
  console.log('💡 GUIDE DE RÉSOLUTION');
  console.log('============================================\n');

  console.log('1️⃣ Obtenir les credentials CJ:');
  console.log('   - Aller sur https://cjdropshipping.com');
  console.log('   - Se connecter ou créer un compte');
  console.log('   - Aller dans Developer > API Key');
  console.log('   - Cliquer "Generate" pour créer une API Key');
  console.log('   - Copier l\'email et l\'API Key\n');

  console.log('2️⃣ Configurer dans KAMRI:');
  console.log('   - Ouvrir server/.env');
  console.log('   - Ajouter:');
  console.log('     CJ_EMAIL=votre@email.com');
  console.log('     CJ_API_KEY=votre_api_key_de_32_caracteres');
  console.log('     CJ_TIER=free\n');

  console.log('3️⃣ Redémarrer le serveur:');
  console.log('   cd server');
  console.log('   npm run dev\n');

  console.log('4️⃣ Tester à nouveau:');
  console.log('   npx ts-node src/cj-dropshipping/diagnose-connection.ts\n');

  console.log('============================================\n');
}

// Exécuter le diagnostic
diagnoseConnection().catch(console.error);