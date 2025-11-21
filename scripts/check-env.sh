#!/bin/bash

# Script pour vérifier et corriger le fichier .env

echo "🔍 Vérification du fichier .env..."
echo ""

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
    echo "❌ Fichier .env non trouvé"
    echo "   Créez-le avec: cp .env.production.example .env"
    exit 1
fi

echo "✅ Fichier .env trouvé"
echo ""

# Compter les occurrences de DATABASE_URL
db_url_count=$(grep -c "^DATABASE_URL=" .env 2>/dev/null || echo "0")

if [ "$db_url_count" -gt 1 ]; then
    echo "⚠️  Plusieurs définitions de DATABASE_URL trouvées ($db_url_count)"
    echo "   Gardez uniquement celle avec PostgreSQL"
    echo ""
    echo "Lignes trouvées:"
    grep "^DATABASE_URL=" .env
    echo ""
    echo "💡 Supprimez les lignes avec SQLite (file:./dev.db)"
    exit 1
elif [ "$db_url_count" -eq 0 ]; then
    echo "❌ Aucune définition de DATABASE_URL trouvée"
    exit 1
else
    echo "✅ Une seule définition de DATABASE_URL trouvée"
    db_url=$(grep "^DATABASE_URL=" .env | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    
    if [[ "$db_url" == *"postgres.railway.internal"* ]]; then
        echo "⚠️  URL INTERNE détectée (postgres.railway.internal)"
        echo "   Cette URL fonctionne UNIQUEMENT si le backend est sur Railway"
        echo "   Pour développement local, utilisez l'URL EXTERNE"
        echo ""
        echo "   URL actuelle: $db_url"
        echo ""
        echo "💡 Pour trouver l'URL externe:"
        echo "   1. Railway → PostgreSQL → Connect"
        echo "   2. Cherchez l'URL avec un domaine public"
        echo "   3. Remplacez postgres.railway.internal par ce domaine"
    elif [[ "$db_url" == *"file:"* ]]; then
        echo "❌ URL SQLite détectée"
        echo "   Utilisez une URL PostgreSQL pour la production"
        exit 1
    else
        echo "✅ URL PostgreSQL valide"
        echo "   $db_url"
    fi
fi

echo ""
echo "📋 Autres variables importantes:"
[ -z "$JWT_SECRET" ] && echo "   ⚠️  JWT_SECRET non défini" || echo "   ✅ JWT_SECRET défini"
[ -z "$STRIPE_SECRET_KEY" ] && echo "   ⚠️  STRIPE_SECRET_KEY non défini" || echo "   ✅ STRIPE_SECRET_KEY défini"

echo ""
echo "✅ Vérification terminée"

