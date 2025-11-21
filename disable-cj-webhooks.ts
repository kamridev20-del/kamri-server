import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function disableCJWebhooks() {
  try {
    // Récupérer la configuration CJ
    const config = await prisma.cJConfig.findFirst();
    
    if (!config) {
      console.error('❌ Configuration CJ introuvable');
      return;
    }

    console.log('🔧 Configuration CJ trouvée:');
    console.log(`   Email: ${config.email}`);
    console.log(`   Tier: ${config.tier}`);
    console.log(`   Enabled: ${config.enabled}\n`);

    // Charger le token d'accès
    let accessToken = config.accessToken;
    
    // Si le token est expiré ou manquant, se connecter
    if (!accessToken || accessToken.trim() === '') {
      console.log('🔑 Token d\'accès manquant, connexion...');
      
      const loginResponse = await axios.post('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
        email: config.email,
        apiKey: config.apiKey
      });

      if (loginResponse.data.code === 200 && loginResponse.data.data) {
        accessToken = loginResponse.data.data.accessToken;
        console.log('✅ Connexion réussie\n');
      } else {
        console.error('❌ Erreur de connexion:', loginResponse.data);
        return;
      }
    }

    // Désactiver les webhooks
    console.log('🚫 Désactivation des webhooks CJ...\n');
    
    const webhookConfig = {
      product: {
        type: 'CANCEL',
        callbackUrls: []
      },
      stock: {
        type: 'CANCEL',
        callbackUrls: []
      },
      order: {
        type: 'CANCEL',
        callbackUrls: []
      },
      logistics: {
        type: 'CANCEL',
        callbackUrls: []
      }
    };

    const response = await axios.post(
      'https://developers.cjdropshipping.com/api2.0/v1/webhook/set',
      webhookConfig,
      {
        headers: {
          'CJ-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📋 Réponse CJ:', JSON.stringify(response.data, null, 2));

    if (response.data.code === 200 && response.data.result === true) {
      console.log('\n✅ Webhooks CJ désactivés avec succès !');
      console.log('   Les notifications ne seront plus reçues automatiquement.');
    } else {
      console.error('\n❌ Erreur lors de la désactivation:', response.data.message);
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    if (error.response) {
      console.error('   Réponse:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

console.log('⚠️  Ce script va désactiver TOUS les webhooks CJ Dropshipping.');
console.log('   Votre serveur ne recevra plus de notifications automatiques.\n');

disableCJWebhooks();

