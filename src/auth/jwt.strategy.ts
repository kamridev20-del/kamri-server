import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    
    // Utiliser le même secret que dans AuthModule
    const finalSecret = secret || (isProduction ? null : 'kamri-secret-key-dev-only');
    
    if (!finalSecret && isProduction) {
      console.error('❌ [JwtStrategy] ERREUR: JWT_SECRET non défini en production!');
      throw new Error('JWT_SECRET must be defined in production environment');
    }
    
    console.log('🔐 [JwtStrategy] Initialisation avec secret:', finalSecret ? finalSecret.substring(0, 10) + '...' : 'DÉFAUT');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: finalSecret,
    });
  }

  async validate(payload: any) {
    console.log('🔍 [JwtStrategy] Validation du token pour:', payload.email);
    const user = { userId: payload.sub, email: payload.email, role: payload.role };
    console.log('✅ [JwtStrategy] Token validé:', user);
    return user;
  }
}
