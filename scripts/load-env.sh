#!/bin/bash

# Fonction pour charger les variables d'environnement depuis .env
# Compatible avec Windows/WSL et Linux/Mac

load_env_file() {
    local env_file="$1"
    
    if [ ! -f "$env_file" ]; then
        return 1
    fi
    
    # Lire le fichier ligne par ligne et exporter les variables
    while IFS= read -r line || [ -n "$line" ]; do
        # Ignorer les lignes vides et les commentaires
        if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        
        # Extraire la clé et la valeur
        if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"
            
            # Nettoyer les espaces
            key=$(echo "$key" | xargs)
            value=$(echo "$value" | xargs)
            
            # Enlever les guillemets si présents
            value="${value#\"}"
            value="${value%\"}"
            value="${value#\'}"
            value="${value%\'}"
            
            # Exporter la variable
            export "$key=$value"
        fi
    done < "$env_file"
    
    return 0
}

# Essayer de charger .env ou .env.production
if load_env_file ".env"; then
    echo "✅ Variables chargées depuis .env"
elif load_env_file ".env.production"; then
    echo "✅ Variables chargées depuis .env.production"
else
    echo "⚠️  Aucun fichier .env trouvé"
fi

