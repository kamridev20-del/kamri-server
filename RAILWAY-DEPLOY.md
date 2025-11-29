# Déploiement manuel sur Railway

## Méthode 1 : CLI Railway (Recommandé)

### 1. Installer Railway CLI

**Windows (PowerShell) :**
```powershell
iwr https://railway.app/install.ps1 | iex
```

**Mac/Linux :**
```bash
curl -fsSL https://railway.app/install.sh | sh
```

### 2. Se connecter à Railway

```bash
railway login
```

Cela ouvrira votre navigateur pour vous authentifier.

### 3. Initialiser le projet

Dans le dossier `kamri-server` :

```bash
cd separated-repos/kamri-server
railway init
```

Choisissez :
- "Create a new project" ou "Link to existing project"
- Donnez un nom au projet (ex: `kamri-server`)

### 4. Lier la base de données

Si vous avez déjà créé la base de données sur Railway :

```bash
railway link
```

Puis sélectionnez votre projet et votre base de données.

### 5. Configurer les variables d'environnement

**⚠️ IMPORTANT : JWT_SECRET doit être défini et identique à chaque redéploiement !**

Si `JWT_SECRET` n'est pas défini ou change, tous les tokens JWT existants deviendront invalides.

**Générer un secret JWT sécurisé :**

```bash
# Option 1 : Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 2 : OpenSSL
openssl rand -hex 64

# Option 3 : En ligne (https://generate-secret.vercel.app/64)
```

**Configurer dans Railway :**

```bash
# ⚠️ REMPLACEZ par votre secret généré ci-dessus
railway variables set JWT_SECRET="votre_secret_jwt_super_securise_au_moins_64_caracteres_hexadecimaux"

# Autres variables
railway variables set DATABASE_URL="postgresql://postgres:RkueXhTkRXgbycEzIaRnbrFSuWJoDvTq@crossover.proxy.rlwy.net:27215/railway"
railway variables set NODE_ENV="production"
railway variables set PORT="3001"
```

**Vérifier que JWT_SECRET est bien défini :**

```bash
railway variables
```

Vous devriez voir `JWT_SECRET` dans la liste. Si ce n'est pas le cas, le serveur utilisera un secret par défaut et les tokens deviendront invalides à chaque redémarrage !

Ou créez un fichier `.env` et utilisez :

```bash
railway variables
```

Cela ouvrira l'éditeur pour toutes les variables.

### 6. Déployer

```bash
railway up
```

Railway va :
1. Détecter le `nixpacks.toml`
2. Installer les dépendances
3. Générer Prisma Client
4. Builder le projet
5. Démarrer le serveur

### 7. Obtenir l'URL

```bash
railway domain
```

Cela vous donnera l'URL de votre API.

---

## Méthode 2 : Upload via l'interface Railway

### 1. Créer un projet vide

1. Allez sur https://railway.app
2. Cliquez sur "New Project"
3. Sélectionnez "Empty Project"

### 2. Créer un service

1. Dans votre projet, cliquez sur "New"
2. Sélectionnez "GitHub Repo" mais annulez, OU
3. Sélectionnez "Empty Service"

### 3. Uploader le code

**Option A : Via Railway CLI (plus simple)**

```bash
cd separated-repos/kamri-server
railway init
railway up
```

**Option B : Via l'interface web**

1. Dans Railway, allez dans votre service
2. Cliquez sur "Settings"
3. Dans "Source", vous pouvez :
   - Connecter un repo GitHub (mais vous ne voulez pas)
   - Utiliser "Deploy from local directory" (nécessite CLI)

### 4. Configurer les variables

Dans l'interface Railway :
1. Allez dans "Variables"
2. Ajoutez toutes les variables d'environnement :
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `PORT=3001`
   - `FRONTEND_URL` (après avoir déployé Vercel)
   - `ADMIN_URL` (après avoir déployé Vercel)

### 5. Déployer

Railway détectera automatiquement le `nixpacks.toml` et déploiera.

---

## Commandes Railway CLI utiles

```bash
# Voir les logs en temps réel
railway logs

# Voir les variables
railway variables

# Ouvrir le dashboard
railway open

# Redéployer
railway up

# Voir l'URL du service
railway domain

# Voir le statut
railway status
```

---

## Configuration automatique

Railway détectera automatiquement :
- ✅ `package.json` → Node.js
- ✅ `nixpacks.toml` → Configuration de build
- ✅ `railway.toml` → Configuration de déploiement

---

## Vérification

Une fois déployé, testez :

```bash
curl https://votre-projet.railway.app/api/health
```

Devrait retourner : `{"status":"ok"}`

---

## Troubleshooting

### Erreur "Prisma Client not generated"

Railway devrait générer automatiquement. Si problème :

```bash
railway run npm run db:generate
```

### Erreur de connexion à la base de données

Vérifiez que `DATABASE_URL` est correct dans :
```bash
railway variables
```

### Voir les logs

```bash
railway logs --tail
```





