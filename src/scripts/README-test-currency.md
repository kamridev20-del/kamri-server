# Script de Test - Système de Conversion de Devises

## 📋 Description

Ce script teste tous les endpoints du système de conversion de devises :
- ✅ Mise à jour des taux de change
- ✅ Récupération des taux
- ✅ Détection de devise par pays
- ✅ Conversion de prix
- ✅ Conversions multiples

## 🚀 Utilisation

### Option 1 : Test local (backend sur localhost:3000)

```bash
cd separated-repos/kamri-server
npm run test:currency
```

### Option 2 : Test avec backend Railway

1. Ajoutez la variable d'environnement `BACKEND_URL` dans votre `.env` :
```env
BACKEND_URL=https://votre-domaine-railway.up.railway.app
```

2. Exécutez le script :
```bash
npm run test:currency
```

### Option 3 : Test avec URL personnalisée

Modifiez directement dans le script la variable `BASE_URL` ligne 10.

## 📊 Résultats

Le script affiche :
- ✅ Les tests réussis en vert
- ❌ Les erreurs en rouge
- ℹ️ Les informations en bleu
- ⚠️ Les avertissements en jaune

## 🔍 Exemples de sortie

```
╔════════════════════════════════════════════════════════════╗
║     TEST DU SYSTÈME DE CONVERSION DE DEVISES              ║
╚════════════════════════════════════════════════════════════╝

============================================================
TEST 1: Mise à jour des taux de change
============================================================
ℹ️  Appel: POST http://localhost:3000/api/currency/update
✅ Taux mis à jour avec succès: 10 devises

============================================================
TEST 2: Récupération des taux de change
============================================================
✅ Taux récupérés avec succès:
  USD   : 1.0000
  EUR   : 0.9200
  XAF   : 612.3400
  ...
```

## ⚙️ Configuration

Le script utilise automatiquement :
- `BACKEND_URL` depuis `.env` (ou `http://localhost:3000` par défaut)
- Les endpoints `/api/currency/*`

## 🐛 Dépannage

Si les tests échouent :
1. Vérifiez que le backend est démarré
2. Vérifiez que `CURRENCY_API_KEY` est configurée sur Railway
3. Vérifiez les logs du backend pour voir les erreurs
4. Testez manuellement un endpoint avec Postman/curl

