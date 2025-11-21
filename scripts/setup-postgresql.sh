#!/bin/bash

# Script de configuration PostgreSQL pour KAMRI
# Ce script aide à configurer la base de données PostgreSQL pour la production

set -e

echo "🚀 === Configuration PostgreSQL pour KAMRI ==="
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

# Vérifier si DATABASE_URL est défini
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL n'est pas défini"
    echo "   Définissez-le dans votre fichier .env ou .env.production"
    echo "   Exemple: DATABASE_URL=\"postgresql://user:password@host:5432/database\""
    exit 1
fi

echo "✅ DATABASE_URL trouvé"

echo "📦 Installation des dépendances..."
pnpm install

echo ""
echo "🔄 Génération du client Prisma pour PostgreSQL..."
# Copier le schéma PostgreSQL
cp prisma/schema.postgresql.prisma prisma/schema.prisma

# Générer le client Prisma
pnpm prisma generate

echo ""
echo "📊 Poussage du schéma vers PostgreSQL..."
echo "⚠️  Cette opération va créer/modifier les tables dans votre base de données"
read -p "Continuer? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    pnpm prisma db push
    
    echo ""
    echo "🌱 Exécution du seed (données initiales)..."
    pnpm prisma db seed
    
    echo ""
    echo "✅ Configuration terminée!"
    echo ""
    echo "📝 Prochaines étapes:"
    echo "   1. Vérifiez que toutes les tables sont créées"
    echo "   2. Si vous avez des données SQLite, exécutez:"
    echo "      ts-node -r tsconfig-paths/register scripts/migrate-to-postgresql.ts"
    echo "   3. Testez la connexion avec: pnpm prisma studio"
else
    echo "❌ Opération annulée"
    exit 1
fi

