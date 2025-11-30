import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    
    // Utiliser le même secret que dans AuthModule
    const finalSecret = secret || (isProduction ? null : 'kamri-secret-key-dev-only');
    
    if (!finalSecret && isProduction) {
      this.logger.error('❌ ERREUR: JWT_SECRET non défini en production!');
      throw new Error('JWT_SECRET must be defined in production environment');
    }
    
    // ✅ Logger seulement au démarrage, pas à chaque requête
    if (!isProduction) {
      this.logger.log(`🔐 Initialisation avec secret: ${finalSecret ? finalSecret.substring(0, 10) + '...' : 'DÉFAUT'}`);
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: finalSecret,
    });
  }

  async validate(payload: any) {
    // ✅ Réduire les logs en production pour éviter le rate limit Railway
    if (!this.isProduction) {
      this.logger.debug(`🔍 Validation du token pour: ${payload.email}`);
    }
    const user = { userId: payload.sub, email: payload.email, role: payload.role };
    if (!this.isProduction) {
      this.logger.debug(`✅ Token validé: ${JSON.stringify(user)}`);
    }
    return user;
  }
}
