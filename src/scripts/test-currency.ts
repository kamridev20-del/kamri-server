import axios from 'axios';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Charger les variables d'environnement
dotenv.config({ path: resolve(__dirname, '../../.env') });

// Configuration
// URL par défaut : Railway production
// Vous pouvez surcharger avec BACKEND_URL dans .env
const BASE_URL = process.env.BACKEND_URL || 'https://kamri-server-production.up.railway.app';
const API_BASE = `${BASE_URL}/api/currency`;

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

async function testUpdateRates() {
  logSection('TEST 1: Mise à jour des taux de change');
  
  try {
    logInfo(`Appel: POST ${API_BASE}/update`);
    const response = await axios.post(`${API_BASE}/update`);
    
    if (response.data.success) {
      logSuccess(`Taux mis à jour avec succès: ${response.data.updated} devises`);
      return true;
    } else {
      logError(`Échec: ${response.data.error || 'Erreur inconnue'}`);
      return false;
    }
  } catch (error: any) {
    logError(`Erreur: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log('Détails:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testGetRates() {
  logSection('TEST 2: Récupération des taux de change');
  
  try {
    logInfo(`Appel: GET ${API_BASE}/rates`);
    const response = await axios.get(`${API_BASE}/rates`);
    
    if (response.data.success && response.data.rates) {
      logSuccess('Taux récupérés avec succès:');
      console.log('\nTaux de change:');
      console.log('-'.repeat(60));
      
      const rates = response.data.rates;
      const currencies = ['USD', 'EUR', 'XAF', 'XOF', 'CNY', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'];
      
      currencies.forEach(currency => {
        if (rates[currency]) {
          console.log(`  ${currency.padEnd(5)} : ${rates[currency].toFixed(4)}`);
        }
      });
      
      console.log('-'.repeat(60));
      logInfo(`Base: ${response.data.base}`);
      return true;
    } else {
      logError('Format de réponse invalide');
      return false;
    }
  } catch (error: any) {
    logError(`Erreur: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testGetCurrencyFromCountry() {
  logSection('TEST 3: Obtenir la devise d\'un pays');
  
  const testCountries = [
    { code: 'FR', expected: 'EUR' },
    { code: 'US', expected: 'USD' },
    { code: 'CM', expected: 'XAF' },
    { code: 'SN', expected: 'XOF' },
    { code: 'CN', expected: 'CNY' },
    { code: 'GB', expected: 'GBP' },
  ];
  
  let successCount = 0;
  
  for (const country of testCountries) {
    try {
      logInfo(`Test: ${country.code} → ${country.expected}`);
      const response = await axios.get(`${API_BASE}/currency-from-country`, {
        params: { countryCode: country.code },
      });
      
      if (response.data.success && response.data.currency === country.expected) {
        logSuccess(`${country.code} → ${response.data.currency} ✓`);
        successCount++;
      } else {
        logError(`${country.code} → Attendu: ${country.expected}, Reçu: ${response.data.currency}`);
      }
    } catch (error: any) {
      logError(`Erreur pour ${country.code}: ${error.message}`);
    }
  }
  
  logInfo(`Résultat: ${successCount}/${testCountries.length} tests réussis`);
  return successCount === testCountries.length;
}

async function testConvertPrice() {
  logSection('TEST 4: Conversion de prix');
  
  const testCases = [
    { price: 100, currency: 'EUR', description: '100 USD → EUR' },
    { price: 100, currency: 'XAF', description: '100 USD → XAF' },
    { price: 100, currency: 'XOF', description: '100 USD → XOF' },
    { price: 100, currency: 'CNY', description: '100 USD → CNY' },
    { price: 50, currency: 'GBP', description: '50 USD → GBP' },
  ];
  
  let successCount = 0;
  
  for (const testCase of testCases) {
    try {
      logInfo(`Test: ${testCase.description}`);
      const response = await axios.get(`${API_BASE}/convert`, {
        params: {
          price: testCase.price,
          currency: testCase.currency,
        },
      });
      
      if (response.data.success) {
        logSuccess(`${testCase.price} USD = ${response.data.formattedPrice}`);
        console.log(`  Prix converti: ${response.data.convertedPrice.toFixed(2)}`);
        successCount++;
      } else {
        logError(`Échec: ${response.data.error}`);
      }
    } catch (error: any) {
      logError(`Erreur: ${error.message}`);
    }
  }
  
  logInfo(`Résultat: ${successCount}/${testCases.length} conversions réussies`);
  return successCount === testCases.length;
}

async function testMultipleConversions() {
  logSection('TEST 5: Conversion multiple (100 USD vers toutes les devises)');
  
  try {
    // D'abord récupérer les taux
    const ratesResponse = await axios.get(`${API_BASE}/rates`);
    if (!ratesResponse.data.success) {
      logError('Impossible de récupérer les taux');
      return false;
    }
    
    const rates = ratesResponse.data.rates;
    const priceUSD = 100;
    
    console.log(`\nConversion de ${priceUSD} USD vers toutes les devises:\n`);
    console.log('-'.repeat(60));
    
    const currencies = ['USD', 'EUR', 'XAF', 'XOF', 'CNY', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'];
    
    for (const currency of currencies) {
      if (rates[currency]) {
        const converted = priceUSD * rates[currency];
        const formatted = new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: currency,
        }).format(converted);
        
        console.log(`  ${currency.padEnd(5)} : ${formatted.padEnd(20)} (taux: ${rates[currency].toFixed(4)})`);
      }
    }
    
    console.log('-'.repeat(60));
    logSuccess('Conversions affichées');
    return true;
  } catch (error: any) {
    logError(`Erreur: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║     TEST DU SYSTÈME DE CONVERSION DE DEVISES              ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  logInfo(`URL du backend: ${BASE_URL}`);
  logInfo(`API Base: ${API_BASE}\n`);
  
  const results = {
    updateRates: false,
    getRates: false,
    getCurrencyFromCountry: false,
    convertPrice: false,
    multipleConversions: false,
  };
  
  // Test 1: Mise à jour des taux
  results.updateRates = await testUpdateRates();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Pause 1 seconde
  
  // Test 2: Récupération des taux
  results.getRates = await testGetRates();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 3: Devise par pays
  results.getCurrencyFromCountry = await testGetCurrencyFromCountry();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 4: Conversion de prix
  results.convertPrice = await testConvertPrice();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 5: Conversions multiples
  results.multipleConversions = await testMultipleConversions();
  
  // Résumé final
  logSection('RÉSUMÉ DES TESTS');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  
  console.log('\nRésultats:');
  console.log(`  ✅ Mise à jour des taux        : ${results.updateRates ? '✓' : '✗'}`);
  console.log(`  ✅ Récupération des taux       : ${results.getRates ? '✓' : '✗'}`);
  console.log(`  ✅ Devise par pays             : ${results.getCurrencyFromCountry ? '✓' : '✗'}`);
  console.log(`  ✅ Conversion de prix         : ${results.convertPrice ? '✓' : '✗'}`);
  console.log(`  ✅ Conversions multiples       : ${results.multipleConversions ? '✓' : '✗'}`);
  
  console.log('\n' + '='.repeat(60));
  if (passedTests === totalTests) {
    logSuccess(`TOUS LES TESTS RÉUSSIS (${passedTests}/${totalTests})`);
  } else {
    logWarning(`TESTS PARTIELS: ${passedTests}/${totalTests} réussis`);
  }
  console.log('='.repeat(60) + '\n');
}

// Exécuter les tests
runAllTests().catch((error) => {
  logError(`Erreur fatale: ${error.message}`);
  process.exit(1);
});

