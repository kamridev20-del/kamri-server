/**
 * Utilitaires pour la gestion d'erreurs dans les modules CJ
 */

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Erreur inconnue';
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

export function logError(logger: any, message: string, error: unknown): void {
  logger.error(
    `${message}: ${getErrorMessage(error)}`,
    getErrorStack(error)
  );
}
