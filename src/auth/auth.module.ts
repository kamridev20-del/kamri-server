import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        
        // ⚠️ En production, JWT_SECRET DOIT être défini
        if (isProduction && !secret) {
          console.error('❌ [AuthModule] ERREUR CRITIQUE: JWT_SECRET non défini en production!');
          console.error('❌ Les tokens JWT deviendront invalides à chaque redémarrage!');
          console.error('❌ Définissez JWT_SECRET dans Railway: railway variables set JWT_SECRET="votre_secret"');
          throw new Error('JWT_SECRET must be defined in production environment');
        }
        
        // En développement, utiliser un secret par défaut si non défini
        const finalSecret = secret || 'kamri-secret-key-dev-only';
        
        if (isProduction) {
          console.log('🔐 [AuthModule] JWT_SECRET utilisé (PRODUCTION):', finalSecret.substring(0, 10) + '...');
        } else {
          console.log('🔐 [AuthModule] JWT_SECRET utilisé (DEV):', finalSecret.substring(0, 10) + '...');
        }
        
        return {
          secret: finalSecret,
          signOptions: { expiresIn: '7d' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

