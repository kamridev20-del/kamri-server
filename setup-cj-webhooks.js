const axios = require('axios');

// Configuration des webhooks CJ
const CJ_API_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const WEBHOOK_BASE_URL = 'https://votre-domaine.com'; // Remplacez par votre domaine public

// Configuration des webhooks
const webhookConfig = {
  productWebhook: {
    url: `${WEBHOOK_BASE_URL}/cj-dropshipping/webhooks/product`,
    topics: ['PRODUCT']
  },
  variantWebhook: {
    url: `${WEBHOOK_BASE_URL}/cj-dropshipping/webhooks/variant`,
    topics: ['VARIANT']
  },
  stockWebhook: {
    url: `${WEBHOOK_BASE_URL}/cj-dropshipping/webhooks/stock`,
    topics: ['STOCK']
  },
  orderWebhook: {
    url: `${WEBHOOK_BASE_URL}/cj-dropshipping/webhooks/order`,
    topics: ['ORDER']
  },
  logisticWebhook: {
    url: `${WEBHOOK_BASE_URL}/cj-dropshipping/webhooks/logistic`,
    topics: ['LOGISTIC']
  }
};

async function setupWebhook(accessToken, webhookUrl, topics) {
  try {
    console.log(`🔧 Configuration webhook: ${webhookUrl}`);
    console.log(`📋 Topics: ${topics.join(', ')}`);
    
    const response = await axios.post(`${CJ_API_BASE}/webhook/set`, {
      webhookUrl: webhookUrl,
      topics: topics
    }, {
      headers: {
        'CJ-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Webhook configuré:`, response.data);
    return true;
  } catch (error) {
    console.log(`❌ Erreur configuration webhook:`, error.response?.data || error.message);
    return false;
  }
}

async function getWebhookList(accessToken) {
  try {
    console.log(`📋 Récupération de la liste des webhooks...`);
    
    const response = await axios.get(`${CJ_API_BASE}/webhook/list`, {
      headers: {
        'CJ-Access-Token': accessToken
      }
    });
    
    console.log(`📋 Webhooks configurés:`, response.data);
    return response.data;
  } catch (error) {
    console.log(`❌ Erreur récupération webhooks:`, error.response?.data || error.message);
    return null;
  }
}

async function setupAllWebhooks(accessToken) {
  console.log('🚀 Configuration des Webhooks CJ Dropshipping');
  console.log('=============================================');
  
  // Configuration de chaque webhook
  for (const [name, config] of Object.entries(webhookConfig)) {
    console.log(`\n🔧 Configuration ${name}...`);
    await setupWebhook(accessToken, config.url, config.topics);
  }
  
  // Afficher la liste des webhooks configurés
  console.log('\n📋 Liste des webhooks configurés:');
  await getWebhookList(accessToken);
  
  console.log('\n🎯 Configuration terminée !');
  console.log('Les webhooks sont maintenant configurés pour recevoir les notifications CJ.');
}

// Fonction principale
async function main() {
  const accessToken = process.env.CJ_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.log('❌ Erreur: CJ_ACCESS_TOKEN non défini');
    console.log('Définissez votre token d\'accès CJ:');
    console.log('set CJ_ACCESS_TOKEN=votre_token_ici');
    return;
  }
  
  await setupAllWebhooks(accessToken);
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { setupAllWebhooks, webhookConfig };
