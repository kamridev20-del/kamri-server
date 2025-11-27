# Migration : Ajout de la colonne imageUrl aux catégories

## Problème
La colonne `imageUrl` a été ajoutée au schéma Prisma mais n'existe pas encore dans la base de données PostgreSQL sur Railway, ce qui cause des erreurs.

## Solution : Migration Prisma

### Option 1 : Via Railway Terminal (Recommandé)

1. Allez sur [Railway Dashboard](https://railway.app)
2. Sélectionnez votre projet `kamri-server`
3. Cliquez sur votre service backend
4. Ouvrez l'onglet **"Deploy Logs"** ou **"Settings"**
5. Cliquez sur **"Open Terminal"** ou **"Shell"**
6. Exécutez la commande suivante :

```bash
npx prisma db push
```

Cette commande va :
- ✅ Synchroniser le schéma Prisma avec la base de données
- ✅ Ajouter la colonne `imageUrl` à la table `categories`
- ✅ Ne pas supprimer de données existantes

### Option 2 : Via Railway CLI

Si vous avez Railway CLI installé localement :

```bash
railway run npx prisma db push
```

### Option 3 : Script de migration automatique

Vous pouvez aussi ajouter un script dans `package.json` qui s'exécute automatiquement au déploiement :

```json
{
  "scripts": {
    "postdeploy": "npx prisma db push"
  }
}
```

⚠️ **Attention** : Cette option peut ralentir les déploiements.

## Vérification

Après la migration, vérifiez que tout fonctionne :

1. Les catégories s'affichent dans l'admin
2. Les fournisseurs s'affichent dans l'admin
3. Vous pouvez uploader des images pour les catégories

## En cas d'erreur

Si vous obtenez une erreur de connexion à la base de données :

1. Vérifiez que `DATABASE_URL` est bien configuré dans Railway
2. Vérifiez que la base de données PostgreSQL est active
3. Réessayez la commande

## Note importante

La colonne `imageUrl` est **optionnelle** (`String?`), donc :
- ✅ Les catégories existantes continueront de fonctionner
- ✅ Vous pouvez ajouter des images progressivement
- ✅ Si une catégorie n'a pas d'image, l'icône sera utilisée par défaut




