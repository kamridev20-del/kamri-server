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
    const secret = configService.get<string>('JWT_SECRET') || 'kamri-secret-key';
    console.log('🔐 [JwtStrategy] Initialisation avec secret (via ConfigService):', secret ? secret.substring(0, 10) + '...' : 'DÉFAUT');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('🔍 [JwtStrategy] Validation du token pour:', payload.email);
    const user = { userId: payload.sub, email: payload.email, role: payload.role };
    console.log('✅ [JwtStrategy] Token validé:', user);
    return user;
  }
}
