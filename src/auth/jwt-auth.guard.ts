import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    console.log('🛡️ [JwtAuthGuard] Protection activée pour:', request.url);
    console.log('🔑 [JwtAuthGuard] Authorization header:', authHeader ? authHeader.substring(0, 30) + '...' : 'AUCUN');
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      console.error('❌ [JwtAuthGuard] Erreur d\'authentification');
      if (err) {
        console.error('❌ [JwtAuthGuard] err:', err?.message || err);
      }
      if (info) {
        console.error('❌ [JwtAuthGuard] info:', info?.message || info?.name || info);
      }
      const errorMessage = err?.message || info?.message || info?.name || 'Token invalide ou expiré';
      console.error('❌ [JwtAuthGuard] Message:', errorMessage);
      throw err || new UnauthorizedException(errorMessage);
    }
    console.log('✅ [JwtAuthGuard] Utilisateur authentifié:', user.email);
    return user;
  }
}