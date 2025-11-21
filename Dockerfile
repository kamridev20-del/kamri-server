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

# Commande de démarrage
CMD ["npm", "run", "start:prod"]

