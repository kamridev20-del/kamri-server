/**
 * Interfaces pour le Product Sourcing CJ
 */

/**
 * Données pour créer une demande de sourcing
 */
export interface CJSourcingCreateRequest {
  // IDs de référence (optionnels)
  thirdProductId?: string;    // Votre product ID
  thirdVariantId?: string;    // Votre variant ID
  thirdProductSku?: string;   // Votre SKU
  
  // Informations produit (requis)
  productName: string;        // Nom du produit
  productImage: string;       // URL de l'image
  productUrl?: string;        // URL source (AliExpress, etc.)
  remark?: string;            // Remarques
  price?: string;             // Prix actuel (USD)
}

/**
 * Réponse de création de sourcing
 */
export interface CJSourcingCreateResponse {
  success: boolean;
  code: number;
  message: string | null;
  data: {
    cjSourcingId: string;     // ID de la demande CJ
    result: string;            // "success" ou autre
  };
  requestId: string;
}

/**
 * Requête pour vérifier le statut
 */
export interface CJSourcingQueryRequest {
  sourceIds: string[];        // Liste des IDs à vérifier
}

/**
 * Détails d'une demande de sourcing
 */
export interface CJSourcingDetails {
  sourceId: string;           // ID de la demande
  sourceNumber: string;       // Numéro court
  productId?: string;         // Votre product ID
  variantId?: string;         // Votre variant ID
  shopId?: string;            // ID de votre boutique
  shopName?: string;          // Nom de votre boutique
  sourceStatus: string;       // Code statut (1-5)
  sourceStatusStr: string;    // Statut en chinois
  cjProductId?: string;       // Product ID CJ (si trouvé)
  cjVariantSku?: string;      // SKU CJ (si trouvé)
}

/**
 * Réponse de vérification de statut
 */
export interface CJSourcingQueryResponse {
  success: boolean;
  code: number;
  message: string | null;
  data: CJSourcingDetails | CJSourcingDetails[];
  requestId: string;
}

/**
 * Statuts possibles
 */
export enum CJSourcingStatus {
  PENDING = 'pending',        // En attente
  PROCESSING = 'processing',  // En cours de recherche
  FOUND = 'found',            // Produit trouvé
  FAILED = 'failed'           // Échec de recherche
}

/**
 * Mapper le code statut CJ vers notre enum
 */
export function mapCJSourcingStatus(statusCode: string): CJSourcingStatus {
  switch (statusCode) {
    case '1':
    case '2':
      return CJSourcingStatus.PROCESSING;
    case '3':
    case '4':
      return CJSourcingStatus.FOUND;
    case '5':
      return CJSourcingStatus.FAILED;
    default:
      return CJSourcingStatus.PENDING;
  }
}

