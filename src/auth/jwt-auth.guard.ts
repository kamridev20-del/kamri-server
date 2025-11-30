import { ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  canActivate(context: ExecutionContext) {
    // ✅ Réduire les logs en production pour éviter le rate limit Railway
    if (!this.isProduction) {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers.authorization;
      this.logger.debug(`🛡️ Protection activée pour: ${request.url}`);
      this.logger.debug(`🔑 Authorization header: ${authHeader ? authHeader.substring(0, 30) + '...' : 'AUCUN'}`);
    }
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // ✅ Toujours logger les erreurs d'authentification
      this.logger.error('❌ Erreur d\'authentification');
      if (err) {
        this.logger.error(`❌ err: ${err?.message || err}`);
      }
      if (info) {
        this.logger.error(`❌ info: ${info?.message || info?.name || info}`);
      }
      const errorMessage = err?.message || info?.message || info?.name || 'Token invalide ou expiré';
      this.logger.error(`❌ Message: ${errorMessage}`);
      throw err || new UnauthorizedException(errorMessage);
    }
    // ✅ Réduire les logs de succès en production
    if (!this.isProduction) {
      this.logger.debug(`✅ Utilisateur authentifié: ${user.email}`);
    }
    return user;
  }
}