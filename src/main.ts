import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // ✅ Activer le raw body pour les webhooks Stripe
  });

  // Configuration CORS
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production : Utiliser les variables d'environnement
    const allowedOrigins: string[] = [];
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
      // Ajouter aussi sans trailing slash
      if (process.env.FRONTEND_URL.endsWith('/')) {
        allowedOrigins.push(process.env.FRONTEND_URL.slice(0, -1));
      } else {
        allowedOrigins.push(process.env.FRONTEND_URL + '/');
      }
    }
    if (process.env.ADMIN_URL) {
      allowedOrigins.push(process.env.ADMIN_URL);
      // Ajouter aussi sans trailing slash
      if (process.env.ADMIN_URL.endsWith('/')) {
        allowedOrigins.push(process.env.ADMIN_URL.slice(0, -1));
      } else {
        allowedOrigins.push(process.env.ADMIN_URL + '/');
      }
    }
    if (process.env.ALLOWED_ORIGINS) {
      allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
    }
    
    console.log('🌐 [CORS] Allowed origins:', allowedOrigins);
    
    app.enableCors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true, // Autoriser toutes les origines si aucune configurée
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  } else {
    // Développement : Autoriser toutes les origines locales
    app.enableCors({
      origin: true, // Autoriser toutes les origines en dev
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });
  }

  // Security (après CORS)
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('KAMRI API - Dropshipping Platform')
    .setDescription(`
      API complète pour la plateforme e-commerce KAMRI avec support dropshipping.
      
      ## Fonctionnalités principales :
      - 🛍️ **Gestion produits** : CRUD complet avec badges et fournisseurs
      - 🏪 **Fournisseurs** : Intégration Temu, AliExpress, Shein
      - 🗂️ **Mapping catégories** : Synchronisation automatique
      - 📊 **Dashboard** : Statistiques et analytics
      - 👥 **Utilisateurs** : Authentification JWT avec rôles
      - ⚙️ **Paramètres** : Configuration globale
      - 💳 **Paiements** : Intégration Stripe
      
      ## Authentification :
      Utilisez le token JWT dans l'en-tête Authorization : \`Bearer <token>\`
    `)
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification et autorisation')
    .addTag('products', 'Gestion des produits')
    .addTag('suppliers', 'Gestion des fournisseurs')
    .addTag('categories', 'Gestion des catégories')
    .addTag('orders', 'Gestion des commandes')
    .addTag('users', 'Gestion des utilisateurs')
    .addTag('settings', 'Paramètres globaux')
    .addTag('dashboard', 'Statistiques et analytics')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  
  // Écouter sur toutes les interfaces (0.0.0.0) pour Railway
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
  console.log(`📚 API Documentation: http://0.0.0.0:${port}/api/docs`);
  console.log(`💚 Health check: http://0.0.0.0:${port}/api/health`);
}

bootstrap().catch((error) => {
  console.error('❌ Erreur fatale au démarrage:', error);
  process.exit(1);
});

