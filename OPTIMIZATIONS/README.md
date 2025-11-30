# 🚀 GUIDE D'OPTIMISATION - RÉDUCTION CONSOMMATION RAILWAY

Ce dossier contient les versions optimisées des fichiers pour réduire la consommation de ressources sur Railway.

## 📋 FICHIERS D'OPTIMISATION

1. **currency-scheduler.optimized.ts** - Désactive la synchronisation des taux de change
2. **product-viewers.optimized.ts** - Réduit la fréquence de nettoyage des viewers
3. **webhook-handler.optimized.ts** - Désactive le traitement des webhooks CJ
4. **prisma-service.optimized.ts** - Optimise les logs Prisma
5. **products-service-review-sync.optimized.ts** - Désactive la sync des reviews
6. **feature-flags.ts** - Système centralisé de feature flags
7. **.env.example** - Configuration recommandée pour mode test

## 🔧 INSTRUCTIONS D'INSTALLATION

### Étape 1 : Copier les fichiers optimisés

```bash
# Depuis le dossier kamri-server
cp OPTIMIZATIONS/currency-scheduler.optimized.ts src/currency/currency.scheduler.ts
cp OPTIMIZATIONS/product-viewers.optimized.ts src/products/product-viewers.service.ts
cp OPTIMIZATIONS/prisma-service.optimized.ts src/prisma/prisma.service.ts
cp OPTIMIZATIONS/feature-flags.ts src/config/feature-flags.ts
```

### Étape 2 : Modifier les fichiers existants

#### A. Webhook Handler (`src/cj-dropshipping/cj-dropshipping.controller.ts`)

Ajouter au début de la méthode `handleWebhook()` (ligne ~646) :

```typescript
// ✅ OPTIMISATION : Vérifier si les webhooks sont activés
const isProduction = process.env.NODE_ENV === 'production';
const enableWebhooks = process.env.ENABLE_CJ_WEBHOOKS === 'true';

if (!isProduction || !enableWebhooks) {
  this.logger.log('⚠️ Webhooks CJ Dropshipping désactivés (mode test)');
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
```

#### B. Products Service (`src/products/products.service.ts`)

Modifier la méthode `syncProductReviewsInBackground()` (ligne ~39) :

```typescript
private syncProductReviewsInBackground(productId: string, cjProductId: string): void {
  // ✅ OPTIMISATION : Vérifier si la synchronisation est activée
  const enableReviewSync = process.env.ENABLE_REVIEW_SYNC === 'true';
  
  if (!enableReviewSync) {
    this.logger.debug(`⚠️ Synchronisation reviews désactivée pour produit ${productId}`);
    return;
  }
  
  // ... reste du code existant
}
```

### Étape 3 : Configurer les variables d'environnement

Copier `.env.example` vers `.env` et ajuster :

```bash
cp OPTIMIZATIONS/.env.example .env
```

Ou ajouter directement dans votre `.env` Railway :

```env
NODE_ENV=production
ENABLE_CURRENCY_SYNC=false
ENABLE_CJ_WEBHOOKS=false
ENABLE_REVIEW_SYNC=false
ENABLE_VIEWER_TRACKING=false
VIEWER_CLEANUP_INTERVAL=60000
CJ_VERBOSE_LOGS=false
```

### Étape 4 : Redéployer sur Railway

```bash
# Commit et push les changements
git add .
git commit -m "Optimisation: Réduction consommation ressources Railway"
git push

# Railway redéploiera automatiquement
```

## ✅ VÉRIFICATION

Après déploiement, vérifier dans les logs Railway :

1. ✅ `CurrencyScheduler désactivé` - Si ENABLE_CURRENCY_SYNC=false
2. ✅ `ProductViewersService désactivé` - Si ENABLE_VIEWER_TRACKING=false
3. ✅ `Webhooks CJ Dropshipping désactivés` - Si ENABLE_CJ_WEBHOOKS=false

## 🔄 RÉACTIVATION À LA PUBLICATION

Quand le site est prêt à être publié, modifier les variables d'environnement :

```env
ENABLE_CURRENCY_SYNC=true
ENABLE_CJ_WEBHOOKS=true
ENABLE_REVIEW_SYNC=true
ENABLE_VIEWER_TRACKING=true
```

**⚠️ IMPORTANT** : Désactiver aussi les webhooks dans le dashboard CJ Dropshipping si vous les avez désactivés manuellement.

## 📊 RÉSULTATS ATTENDUS

- **Avant optimisation** : ~5.82$ par mois
- **Après optimisation** : <1$ par mois
- **Économie** : ~5$ par mois

## 🆘 DÉPANNAGE

### Le serveur ne démarre pas

Vérifier que tous les imports sont corrects et que les fichiers ont été copiés correctement.

### Les webhooks ne fonctionnent pas après réactivation

1. Vérifier que `ENABLE_CJ_WEBHOOKS=true` dans `.env`
2. Vérifier que les webhooks sont activés dans le dashboard CJ Dropshipping
3. Redémarrer le serveur

### Les taux de change ne se mettent pas à jour

1. Vérifier que `ENABLE_CURRENCY_SYNC=true` dans `.env`
2. Vérifier que `CURRENCY_API_KEY` est défini
3. Vérifier les logs pour voir les erreurs éventuelles


