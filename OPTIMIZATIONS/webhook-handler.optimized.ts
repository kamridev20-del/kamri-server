// ✅ VERSION OPTIMISÉE - Webhook Handler
// Fichier source : src/cj-dropshipping/cj-dropshipping.controller.ts
// Lignes concernées : 618-768

// ✅ MODIFICATION À APPORTER dans handleWebhook() :

async handleWebhook(@Body() dto: any, @Req() request: Request) {
  const startTime = Date.now();
  
  // ✅ OPTIMISATION : Vérifier si les webhooks sont activés
  const isProduction = process.env.NODE_ENV === 'production';
  const enableWebhooks = process.env.ENABLE_CJ_WEBHOOKS === 'true';
  
  if (!isProduction || !enableWebhooks) {
    this.logger.log('⚠️ Webhooks CJ Dropshipping désactivés (mode test)');
    this.logger.log('💡 Pour activer : définir ENABLE_CJ_WEBHOOKS=true dans .env');
    // ✅ Retourner une réponse valide pour CJ (évite les erreurs)
    return {
      code: 200,
      result: true,
      message: 'Webhooks disabled in test mode',
      data: {
        endpoint: '/api/cj-dropshipping/webhooks',
        status: 'disabled',
        timestamp: new Date().toISOString()
      },
      requestId: dto?.messageId || 'test-' + Date.now()
    };
  }
  
  // ✅ Gérer les requêtes de test de CJ Dropshipping (sans body ou body vide)
  // CJ teste l'endpoint avant de le configurer - doit répondre IMMÉDIATEMENT (< 3s)
  if (!dto || Object.keys(dto).length === 0 || !dto.messageId) {
    this.logger.log('✅ Test de connexion webhook par CJ Dropshipping');
    // Réponse IMMÉDIATE sans traitement
    return {
      code: 200,
      result: true,
      message: 'Success',
      data: {
        endpoint: '/api/cj-dropshipping/webhooks',
        status: 'ready',
        timestamp: new Date().toISOString()
      },
      requestId: 'test-' + Date.now()
    };
  }
  
  // ✅ VALIDATION HTTPS STRICTE (mais permettre ngrok en développement)
  const isHttps = request.protocol === 'https' || 
                  request.headers['x-forwarded-proto'] === 'https' ||
                  request.headers['x-forwarded-ssl'] === 'on';
  
  if (process.env.NODE_ENV === 'production' && !isHttps) {
    this.logger.error('❌ Webhook reçu en HTTP (HTTPS requis)');
    return {
      code: 200,
      result: false,
      message: 'HTTPS required in production',
      data: null,
      requestId: dto.messageId || 'unknown'
    };
  }

  try {
    // ... reste du code existant (traitement webhook)
    // Cast le type en CJWebhookPayload
    const payload: CJWebhookPayload = {
      messageId: dto.messageId,
      // ... reste du code
    };
    
    // ... traitement normal du webhook
  } catch (error) {
    // ... gestion d'erreur existante
  }
}


