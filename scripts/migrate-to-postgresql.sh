#!/bin/bash

# Script de migration SQLite → PostgreSQL
# Ce script migre toutes les données de SQLite vers PostgreSQL

set -e

echo "🚀 === Migration SQLite → PostgreSQL ==="
echo ""

# Aller dans le dossier server
cd "$(dirname "$0")/.."

# Charger les variables d'environnement depuis .env
# Source le script de chargement d'environnement
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/load-env.sh" ]; then
    source "$SCRIPT_DIR/load-env.sh"
else
    # Fallback : méthode simple
    if [ -f .env ]; then
        echo "📋 Chargement des variables depuis .env..."
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
                continue
            fi
            if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
                key="${BASH_REMATCH[1]}"
                value="${BASH_REMATCH[2]}"
                key=$(echo "$key" | xargs)
                value=$(echo "$value" | xargs)
                value="${value#\"}"
                value="${value%\"}"
                export "$key=$value"
            fi
        done < .env
    fi
fi

# Vérifier les variables d'environnement
if [ -z "$DATABASE_URL_SQLITE" ]; then
    echo "⚠️  DATABASE_URL_SQLITE non défini, utilisation de la valeur par défaut"
    export DATABASE_URL_SQLITE="file:./prisma/dev.db"
fi

if [ -z "$DATABASE_URL_POSTGRES" ] && [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL_POSTGRES ou DATABASE_URL doit être défini"
    echo "   Définissez-le dans votre fichier .env ou .env.production"
    echo "   Exemple: DATABASE_URL=\"postgresql://user:password@host:5432/database\""
    exit 1
fi

# Utiliser DATABASE_URL si DATABASE_URL_POSTGRES n'est pas défini
if [ -z "$DATABASE_URL_POSTGRES" ]; then
    export DATABASE_URL_POSTGRES="$DATABASE_URL"
fi

echo "📂 Source SQLite: $DATABASE_URL_SQLITE"
echo "📂 Destination PostgreSQL: ${DATABASE_URL_POSTGRES//:[^:@]*@/:****@}"
echo ""

# Vérifier que le fichier SQLite existe
if [[ "$DATABASE_URL_SQLITE" == file:* ]]; then
    SQLITE_FILE="${DATABASE_URL_SQLITE#file:}"
    if [ ! -f "$SQLITE_FILE" ]; then
        echo "❌ Fichier SQLite introuvable: $SQLITE_FILE"
        exit 1
    fi
    echo "✓ Fichier SQLite trouvé: $SQLITE_FILE"
fi

echo ""
echo "⚠️  Cette opération va migrer toutes les données vers PostgreSQL"
read -p "Continuer? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration annulée"
    exit 1
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    pnpm install
fi

# Copier le schéma PostgreSQL
echo "📋 Configuration du schéma PostgreSQL..."
cp prisma/schema.postgresql.prisma prisma/schema.prisma

# Générer le client Prisma pour PostgreSQL
echo "🔄 Génération du client Prisma..."
pnpm prisma generate

# Pousser le schéma vers PostgreSQL (créer les tables)
echo "📊 Création des tables PostgreSQL..."
pnpm prisma db push

# Exécuter le script de migration
echo ""
echo "🔄 Début de la migration des données..."
ts-node -r tsconfig-paths/register scripts/migrate-to-postgresql.ts

echo ""
echo "✅ Migration terminée!"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Vérifiez les données avec: pnpm prisma studio"
echo "   2. Testez votre application"
echo "   3. Une fois validé, vous pouvez supprimer le fichier SQLite"

