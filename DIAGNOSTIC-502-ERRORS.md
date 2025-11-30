# 🔍 Diagnostic des erreurs 502 sur Railway

## ✅ Résultats des tests locaux

Tous les tests passent **en local** :
- ✅ Toutes les requêtes Prisma fonctionnent individuellement
- ✅ Le `Promise.all` avec 13 requêtes fonctionne (1647ms)
- ✅ `ensureCJSupplierExists()` fonctionne
- ✅ Tous les endpoints testés fonctionnent

**Conclusion** : Le code est correct. Le problème est spécifique à Railway.

## 🔴 Endpoints qui retournent 502 sur Railway

1. `/api/dashboard/stats` → 502 Bad Gateway
2. `/api/dashboard/top-categories` → 502 Bad Gateway  
3. `/api/auth/profile` → 502 Bad Gateway
4. `/api/settings` → 502 Bad Gateway
5. `/api/duplicates/stats` → 502 Bad Gateway
6. `/api/cj-dropshipping/stores/:storeId/products` → 502 Bad Gateway

## 🔍 Causes probables

### 1. **Timeout Railway** ⏱️
- Railway a un timeout HTTP par défaut (généralement 30-60 secondes)
- Si la requête prend plus de temps, Railway retourne 502
- **Solution** : Vérifier les logs Railway pour voir si c'est un timeout

### 2. **Pool de connexions Prisma** 🔌
- Si `DATABASE_URL` n'a pas `connection_limit` et `pool_timeout`, Prisma peut épuiser le pool
- **Solution** : Vérifier que `DATABASE_URL` sur Railway contient :
  ```
  ?connection_limit=10&pool_timeout=20
  ```

### 3. **Mémoire/Ressources Railway** 💾
- Les 13 requêtes en parallèle peuvent consommer beaucoup de mémoire
- Railway peut tuer le processus si la mémoire est dépassée
- **Solution** : Optimiser les requêtes ou augmenter les ressources Railway

### 4. **Problème de connexion DB** 🗄️
- La connexion à PostgreSQL peut être instable sur Railway
- **Solution** : Vérifier les logs Railway pour les erreurs de connexion

## 🛠️ Solutions à appliquer

### Solution 1 : Vérifier DATABASE_URL sur Railway

Sur Railway, vérifiez que `DATABASE_URL` contient les paramètres de pool :

```bash
# Format correct :
postgresql://user:password@host:port/database?connection_limit=10&pool_timeout=20
```

**Comment vérifier** :
1. Allez sur Railway Dashboard
2. Ouvrez votre service backend
3. Allez dans "Variables"
4. Vérifiez `DATABASE_URL`
5. Si les paramètres `connection_limit` et `pool_timeout` manquent, ajoutez-les

### Solution 2 : Optimiser les requêtes

Au lieu de 13 requêtes en parallèle, on peut les regrouper :

```typescript
// Au lieu de Promise.all avec 13 requêtes
// Faire 2-3 Promise.all plus petits
```

### Solution 3 : Ajouter un timeout explicite

Ajouter un timeout dans le controller pour éviter que Railway ne tue le processus :

```typescript
@Get('stats')
async getStats() {
  return Promise.race([
    this.dashboardService.getStats(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 25000)
    )
  ]);
}
```

### Solution 4 : Vérifier les logs Railway

**Action immédiate** :
1. Allez sur Railway Dashboard
2. Ouvrez les logs de votre service backend
3. Faites une requête vers `/api/dashboard/stats` depuis le frontend
4. Observez les logs au moment de la requête
5. Cherchez :
   - Erreurs de connexion DB
   - Timeout errors
   - Memory errors
   - Stack traces

## 📋 Checklist de diagnostic

- [ ] Vérifier `DATABASE_URL` sur Railway contient `connection_limit` et `pool_timeout`
- [ ] Vérifier les logs Railway au moment de la requête 502
- [ ] Vérifier les ressources Railway (mémoire, CPU)
- [ ] Tester avec un timeout plus court (10s au lieu de 25s)
- [ ] Vérifier si d'autres endpoints fonctionnent (pour isoler le problème)

## 🎯 Action immédiate recommandée

1. **Vérifier les logs Railway** : C'est la première chose à faire pour identifier la cause exacte
2. **Vérifier DATABASE_URL** : S'assurer que les paramètres de pool sont présents
3. **Tester avec un endpoint simplifié** : Créer un endpoint de test qui fait juste 1 requête simple

## 📝 Notes

- Le code fonctionne parfaitement en local
- Le problème est spécifique à l'environnement Railway
- Les requêtes prennent ~1.6s en local, ce qui devrait être acceptable
- Le problème est probablement lié à la configuration Railway ou aux ressources

