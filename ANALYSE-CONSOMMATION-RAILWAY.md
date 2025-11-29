# 🔍 ANALYSE COMPLÈTE - CONSOMMATION RESSOURCES RAILWAY

**Date d'analyse** : $(date)  
**Usage actuel Railway** : 5.82$ (estimation 30$/mois)  
**Statut** : Site non publié (aucun trafic utilisateur réel)

---

## 📊 RÉSUMÉ EXÉCUTIF

### Éléments identifiés consommant des ressources :

1. ⚠️ **CRITIQUE** : Health checks Railway (toutes les ~30-60 secondes)
2. ⚠️ **CRITIQUE** : CurrencyScheduler (mise à jour toutes les 24h + au démarrage)
3. ⚠️ **ÉLEVÉ** : ProductViewersService (nettoyage toutes les 10 secondes)
4. ⚠️ **ÉLEVÉ** : Webhooks CJ Dropshipping (actifs et traitent tous les événements)
5. ⚠️ **MOYEN** : Synchronisation reviews produits (en arrière-plan)
6. ⚠️ **MOYEN** : Logs Prisma en développement (toutes les queries)
7. ⚠️ **FAIBLE** : Frontend polling (si admin ouvert)

---

## 1️⃣ CRON JOBS / SCHEDULED TASKS

### ✅ CurrencyScheduler - Mise à jour des taux de change

**Fichier** : `src/currency/currency.scheduler.ts`

**Code exact** :
```typescript
onModuleInit() {
  // Première mise à jour 30 secondes après le démarrage
  setTimeout(() => {
    this.updateExchangeRates();
  }, 30000);
  
  // Mise à jour toutes les 24 heures (86400000 ms)
  this.updateInterval = setInterval(() => {
    this.updateExchangeRates();
  }, 24 * 60 * 60 * 1000);
}
```

**Fréquence** :
- ✅ Première exécution : 30 secondes après démarrage
- ✅ Puis : Toutes les 24 heures

**Impact sur les coûts** :
- 🔴 **ÉLEVÉ** : Appel API externe (Currency Data API) à chaque mise à jour
- 🔴 **ÉLEVÉ** : Requêtes base de données pour mettre à jour les taux
- 💰 **Estimation** : ~1-2$ par mois (appels API + DB queries)

**Solution** :
```typescript
// Désactiver en mode développement/test
onModuleInit() {
  const isProduction = process.env.NODE_ENV === 'production';
  const enableCurrencySync = process.env.ENABLE_CURRENCY_SYNC === 'true';
  
  if (!isProduction || !enableCurrencySync) {
    this.logger.log('⚠️ CurrencyScheduler désactivé (mode développement/test)');
    return;
  }
  
  // ... reste du code
}
```

---

## 2️⃣ WEBHOOKS ACTIFS

### ✅ Webhooks CJ Dropshipping

**Fichier** : `src/cj-dropshipping/cj-dropshipping.controller.ts` (ligne 618-768)

**Code exact** :
```typescript
@Post('webhooks')
async handleWebhook(@Body() dto: any, @Req() request: Request) {
  // Traite tous les webhooks : PRODUCT, VARIANT, STOCK, ORDER, ORDERSPLIT, SOURCINGCREATE
}
```

**Types de webhooks actifs** :
- `PRODUCT` : Mise à jour produits
- `VARIANT` : Mise à jour variants
- `STOCK` : Mise à jour stocks
- `ORDER` : Nouvelles commandes
- `ORDERSPLIT` : Commandes divisées
- `SOURCINGCREATE` : Nouveaux produits sourcing

**Fréquence** :
- ⚠️ **Variable** : Dépend de l'activité sur CJ Dropshipping
- ⚠️ **Peut être élevée** : Si beaucoup de produits/variants mis à jour

**Impact sur les coûts** :
- 🔴 **TRÈS ÉLEVÉ** : Chaque webhook = 1 requête HTTP + traitement + DB queries
- 🔴 **TRÈS ÉLEVÉ** : Logs dans `WebhookLog` table (croissance continue)
- 💰 **Estimation** : 2-5$ par mois selon volume

**Solution** :
```typescript
// Désactiver les webhooks en mode test
async handleWebhook(@Body() dto: any, @Req() request: Request) {
  const isProduction = process.env.NODE_ENV === 'production';
  const enableWebhooks = process.env.ENABLE_CJ_WEBHOOKS === 'true';
  
  if (!isProduction || !enableWebhooks) {
    this.logger.log('⚠️ Webhooks désactivés (mode test)');
    return {
      code: 200,
      result: true,
      message: 'Webhooks disabled in test mode',
      data: null,
      requestId: dto.messageId || 'test'
    };
  }
  
  // ... reste du code
}
```

**Action requise** : Désactiver les webhooks dans le dashboard CJ Dropshipping si le site n'est pas publié.

---

## 3️⃣ SYNCHRONISATIONS AUTOMATIQUES

### ✅ Synchronisation des reviews produits

**Fichier** : `src/products/products.service.ts` (ligne 39-78)

**Code exact** :
```typescript
private syncProductReviewsInBackground(productId: string, cjProductId: string): void {
  setTimeout(async () => {
    const reviewsResponse = await this.cjApiClient.getProductReviews(cjProductId, 1, 100);
    // ... traitement et mise à jour DB
  }, 0);
}
```

**Fréquence** :
- ⚠️ **À chaque import de produit** : Synchronisation automatique en arrière-plan
- ⚠️ **Appel API CJ** : `getProductReviews()` pour chaque produit

**Impact sur les coûts** :
- 🟡 **MOYEN** : 1 appel API par produit importé
- 🟡 **MOYEN** : Requêtes DB pour mise à jour
- 💰 **Estimation** : 0.5-1$ par mois

**Solution** :
```typescript
private syncProductReviewsInBackground(productId: string, cjProductId: string): void {
  const enableReviewSync = process.env.ENABLE_REVIEW_SYNC === 'true';
  
  if (!enableReviewSync) {
    this.logger.debug('⚠️ Synchronisation reviews désactivée');
    return;
  }
  
  // ... reste du code
}
```

---

## 4️⃣ API CALLS EXTERNES

### ✅ Appels API CJ Dropshipping

**Fichier** : `src/cj-dropshipping/cj-api-client.ts`

**Rate limiting configuré** :
```typescript
private static readonly MIN_INTERVAL = 1500; // 1.5 secondes minimum entre requêtes
```

**Fréquence** :
- ⚠️ **Variable** : Dépend des actions utilisateur et webhooks
- ⚠️ **Rate limit** : 1 requête toutes les 1.5 secondes minimum

**Impact sur les coûts** :
- 🟡 **MOYEN** : Chaque appel = CPU + réseau
- 💰 **Estimation** : 0.5-1$ par mois

**Solution** : Déjà optimisé avec rate limiting. Pas d'action nécessaire.

---

### ✅ Appels API Currency Data

**Fichier** : `src/currency/currency.service.ts` (ligne 104-167)

**Fréquence** :
- ⚠️ **Toutes les 24h** : Via CurrencyScheduler
- ⚠️ **Retry** : 2 tentatives avec délai de 2 secondes

**Impact sur les coûts** :
- 🟡 **FAIBLE** : 1-2 appels par jour
- 💰 **Estimation** : <0.5$ par mois

**Solution** : Voir section 1 (CurrencyScheduler).

---

## 5️⃣ DATABASE QUERIES

### ✅ Logs Prisma en développement

**Fichier** : `src/prisma/prisma.service.ts` (ligne 10-12)

**Code exact** :
```typescript
super({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn']  // ⚠️ Log TOUTES les queries en dev
    : ['error'],
});
```

**Impact sur les coûts** :
- 🔴 **ÉLEVÉ** : En mode développement, log toutes les queries = I/O disque élevé
- 💰 **Estimation** : 1-2$ par mois si NODE_ENV=development

**Solution** :
```typescript
super({
  log: process.env.NODE_ENV === 'production' 
    ? ['error'] 
    : ['error', 'warn'], // Ne pas logger 'query' même en dev
});
```

---

### ✅ Pool de connexions Prisma

**Fichier** : `src/prisma/prisma.service.ts`

**Configuration actuelle** : Aucune limite explicite

**Impact sur les coûts** :
- 🟡 **MOYEN** : Connexions DB ouvertes = ressources Railway
- 💰 **Estimation** : 0.5-1$ par mois

**Solution** :
```typescript
// Ajouter dans DATABASE_URL :
// ?connection_limit=10&pool_timeout=20
```

---

## 6️⃣ BACKGROUND JOBS / WORKERS

### ✅ ProductViewersService - Nettoyage automatique

**Fichier** : `src/products/product-viewers.service.ts` (ligne 22-24)

**Code exact** :
```typescript
constructor() {
  this.cleanupInterval = setInterval(() => {
    this.cleanupInactiveViewers();
  }, 10000); // ⚠️ Toutes les 10 secondes
}
```

**Fréquence** :
- 🔴 **TRÈS ÉLEVÉE** : Exécution toutes les 10 secondes
- 🔴 **24/7** : Même sans utilisateurs

**Impact sur les coûts** :
- 🔴 **ÉLEVÉ** : CPU toutes les 10 secondes pour nettoyer (même si vide)
- 💰 **Estimation** : 1-2$ par mois

**Solution** :
```typescript
constructor() {
  const cleanupInterval = parseInt(process.env.VIEWER_CLEANUP_INTERVAL || '60000'); // 60s par défaut
  
  this.cleanupInterval = setInterval(() => {
    this.cleanupInactiveViewers();
  }, cleanupInterval);
}
```

**OU désactiver complètement en test** :
```typescript
constructor() {
  const enableViewerTracking = process.env.ENABLE_VIEWER_TRACKING === 'true';
  
  if (!enableViewerTracking) {
    this.logger.log('⚠️ ProductViewersService désactivé');
    return;
  }
  
  // ... reste du code
}
```

---

## 7️⃣ CACHE / OPTIMIZATION

### ✅ Shipping Cache

**Fichier** : `src/shipping/shipping-validation.service.ts`

**Configuration** : Cache en mémoire avec TTL

**Impact** : ✅ **POSITIF** - Réduit les appels API

**Action** : Aucune action nécessaire.

---

## 8️⃣ NEXT.JS CONFIG

### ⚠️ Health Check Railway

**Fichier** : `railway.toml` (ligne 7-8)

**Configuration** :
```toml
healthcheckPath = "/api/health"
healthcheckTimeout = 100
```

**Fréquence** :
- 🔴 **TRÈS ÉLEVÉE** : Railway vérifie toutes les 30-60 secondes
- 🔴 **24/7** : Même sans trafic

**Impact sur les coûts** :
- 🔴 **TRÈS ÉLEVÉ** : Keep-alive du serveur = serveur toujours actif
- 🔴 **TRÈS ÉLEVÉ** : Empêche la mise en veille automatique
- 💰 **Estimation** : 2-3$ par mois (serveur toujours actif)

**Solution** :
```toml
# Option 1 : Augmenter le timeout pour réduire la fréquence
healthcheckPath = "/api/health"
healthcheckTimeout = 300  # 5 minutes au lieu de 100ms

# Option 2 : Désactiver temporairement (si Railway le permet)
# healthcheckPath = "/api/health"
# healthcheckTimeout = 1000
```

**⚠️ ATTENTION** : Désactiver le health check peut empêcher Railway de détecter les problèmes. Utiliser avec précaution.

---

## 9️⃣ LOGS / MONITORING

### ✅ Logs excessifs

**Fichiers concernés** :
- `src/cj-dropshipping/cj-api-client.ts` : Logs verbeux
- `src/cj-dropshipping/services/cj-webhook.service.ts` : Logs détaillés
- `src/products/products.service.ts` : Logs de synchronisation

**Impact sur les coûts** :
- 🟡 **MOYEN** : I/O disque pour écriture logs
- 💰 **Estimation** : 0.5-1$ par mois

**Solution** : Déjà optimisé avec `isProduction` check dans certains fichiers.

---

## 🎯 PLAN D'ACTION PRIORISÉ

### 🔴 PRIORITÉ 1 - Impact immédiat (Économie estimée : 3-5$/mois)

1. **Désactiver CurrencyScheduler en mode test**
   - Fichier : `src/currency/currency.scheduler.ts`
   - Ajouter check `ENABLE_CURRENCY_SYNC`

2. **Réduire fréquence ProductViewersService**
   - Fichier : `src/products/product-viewers.service.ts`
   - Passer de 10s à 60s minimum

3. **Optimiser logs Prisma**
   - Fichier : `src/prisma/prisma.service.ts`
   - Retirer `'query'` des logs même en dev

### 🟡 PRIORITÉ 2 - Impact moyen (Économie estimée : 2-3$/mois)

4. **Désactiver webhooks CJ en mode test**
   - Fichier : `src/cj-dropshipping/cj-dropshipping.controller.ts`
   - Ajouter check `ENABLE_CJ_WEBHOOKS`
   - **+ Désactiver dans dashboard CJ Dropshipping**

5. **Désactiver synchronisation reviews**
   - Fichier : `src/products/products.service.ts`
   - Ajouter check `ENABLE_REVIEW_SYNC`

### 🟢 PRIORITÉ 3 - Impact faible (Économie estimée : 0.5-1$/mois)

6. **Optimiser health check Railway**
   - Fichier : `railway.toml`
   - Augmenter timeout (attention : peut affecter la détection de problèmes)

---

## 📝 FICHIER .env RECOMMANDÉ POUR MODE TEST

```env
# Mode développement économique
NODE_ENV=production  # ⚠️ Important : utiliser 'production' pour désactiver logs Prisma
ENABLE_CURRENCY_SYNC=false
ENABLE_CJ_WEBHOOKS=false
ENABLE_REVIEW_SYNC=false
ENABLE_VIEWER_TRACKING=false
VIEWER_CLEANUP_INTERVAL=60000  # 60 secondes au lieu de 10
CJ_VERBOSE_LOGS=false
```

---

## 🚀 CODE D'OPTIMISATION COMPLET

Voir les fichiers suivants pour les modifications exactes :
- `OPTIMIZATIONS/currency-scheduler.optimized.ts`
- `OPTIMIZATIONS/product-viewers.optimized.ts`
- `OPTIMIZATIONS/webhook-handler.optimized.ts`
- `OPTIMIZATIONS/prisma-service.optimized.ts`

---

## ✅ FLAG DE RÉACTIVATION

Créer un fichier `src/config/feature-flags.ts` :

```typescript
export const FeatureFlags = {
  currencySync: process.env.ENABLE_CURRENCY_SYNC === 'true',
  cjWebhooks: process.env.ENABLE_CJ_WEBHOOKS === 'true',
  reviewSync: process.env.ENABLE_REVIEW_SYNC === 'true',
  viewerTracking: process.env.ENABLE_VIEWER_TRACKING === 'true',
};
```

**Pour réactiver à la publication** : Mettre toutes les variables à `true` dans `.env`.

---

## 📊 ESTIMATION ÉCONOMIES

| Action | Économie estimée/mois |
|--------|---------------------|
| Désactiver CurrencyScheduler | 1-2$ |
| Réduire ProductViewersService | 1-2$ |
| Optimiser logs Prisma | 1-2$ |
| Désactiver webhooks CJ | 2-5$ |
| Désactiver review sync | 0.5-1$ |
| **TOTAL** | **5.5-13$** |

**Objectif** : Réduire de 5.82$ à **<1$ par mois** en mode test.

---

## ⚠️ AVERTISSEMENTS

1. **Health Check Railway** : Ne pas désactiver complètement, cela peut empêcher Railway de détecter les problèmes
2. **Webhooks CJ** : Désactiver aussi dans le dashboard CJ Dropshipping, pas seulement dans le code
3. **Mode Production** : Tester que tout fonctionne avant de publier avec les flags activés

---

## 📞 SUPPORT

En cas de problème après optimisation, vérifier :
1. Les variables d'environnement sont bien définies
2. Le serveur redémarre après modification
3. Les logs Railway pour voir ce qui consomme encore

