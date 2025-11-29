FROM node:20-alpine

WORKDIR /app

# Augmenter la limite de mémoire Node.js
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copier les fichiers de dépendances
COPY package*.json ./
COPY package-lock.json* ./

# Installer les dépendances
RUN npm ci --prefer-offline --no-audit

# Copier Prisma schema
COPY prisma ./prisma/

# Générer Prisma Client
RUN npm run db:generate

# Copier le reste du code
COPY . .

# Builder l'application
RUN npm run build

# Exposer le port
EXPOSE 3001

# Commande de démarrage - utiliser node directement pour une meilleure gestion des signaux
# Cela permet à SIGTERM d'être correctement propagé à Node.js pour un arrêt propre
CMD ["node", "dist/main"]

