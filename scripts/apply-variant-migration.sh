#!/bin/bash

# Script pour appliquer la migration variantId et variantDetails à la base de données
# Usage: bash scripts/apply-variant-migration.sh

set -e

echo "========================================"
echo "Application de la migration variantDetails"
echo "========================================"
echo ""

export PGHOST=yamabiko.proxy.rlwy.net
export PGPORT=28846
export PGDATABASE=railway
export PGUSER=postgres
export PGPASSWORD=avUQefgltUYjOGVtXyouUFwtEyeLshdY

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "[1/3] Application des migrations Prisma existantes..."
npx prisma migrate deploy || {
    echo "⚠️  Erreur lors de l'application des migrations Prisma"
    echo "Continuation avec la migration SQL directe..."
}

echo ""
echo "[2/3] Application de la migration SQL pour variantId et variantDetails..."
PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -p $PGPORT -d $PGDATABASE -f "$SCRIPT_DIR/add-variant-details-to-cart.sql" || {
    echo "❌ Erreur lors de l'application de la migration SQL"
    echo ""
    echo "💡 Vérifiez que psql est installé et accessible dans le PATH"
    echo "   Ou exécutez manuellement:"
    echo "   PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -p $PGPORT -d $PGDATABASE -f \"$SCRIPT_DIR/add-variant-details-to-cart.sql\""
    exit 1
}

echo ""
echo "[3/3] Génération du client Prisma..."
npx prisma generate || {
    echo "❌ Erreur lors de la génération du client Prisma"
    exit 1
}

echo ""
echo "========================================"
echo "✅ Migration appliquée avec succès !"
echo "========================================"
echo ""

