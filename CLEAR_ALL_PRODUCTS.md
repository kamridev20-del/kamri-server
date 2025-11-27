# Script de nettoyage complet des produits

Ce script supprime **TOUS les produits** de la base de données, **peu importe leur statut** (pending, active, inactive, rejected, draft).

## ⚠️ ATTENTION

Ce script supprime :
- ✅ Tous les produits (tous statuts)
- ✅ Tous les variants de produits
- ✅ Toutes les images
- ✅ Tous les mappings CJ
- ✅ Tous les produits CJ en store (CJProductStore)
- ✅ Tous les articles du panier
- ✅ Tous les articles de commande
- ✅ Tous les avis
- ✅ Toutes les listes de souhaits
- ✅ Toutes les notifications de mise à jour
- ✅ Tous les logs de webhooks

**Ce script NE supprime PAS :**
- ❌ Les catégories (Categories)
- ❌ Les utilisateurs (Users)
- ❌ Les fournisseurs (Suppliers)
- ❌ Les commandes (Orders) - optionnel, commenté dans le script

## Utilisation

### Localement

```bash
# Avec la DATABASE_URL dans .env
npm run db:clear-all-products

# OU avec DATABASE_URL en ligne de commande
DATABASE_URL="postgresql://..." npm run db:clear-all-products
```

### Sur Railway

```bash
# Via Railway CLI
railway run npm run db:clear-all-products

# OU via le terminal Railway
railway shell
npm run db:clear-all-products
```

## Résultat

Le script affichera un résumé de toutes les suppressions effectuées :
- Nombre d'articles de commande supprimés
- Nombre de produits supprimés (tous statuts)
- Nombre de produits CJ en store supprimés
- etc.

## Après le nettoyage

Après avoir exécuté le script, vous pouvez :
1. Réimporter des produits depuis la page CJ Dropshipping
2. Créer de nouveaux produits manuellement
3. Les catégories et utilisateurs restent intacts



