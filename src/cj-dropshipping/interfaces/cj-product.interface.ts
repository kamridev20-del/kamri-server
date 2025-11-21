export interface CJProduct {
  pid: string;
  productName: string;
  productNameEn: string;
  productSku: string;
  productImage: string;
  sellPrice: number;
  variants: CJVariant[];
  categoryName: string;
  description: string;
  weight: number;
  dimensions: string;
  brand: string;
  tags: string[];
  reviews: CJReview[];
  rating: number;
  totalReviews: number;
  stockInfo?: any;
}

/**
 * Variant d'un produit CJ (structure complète selon API CJ 2.1 et 2.2)
 */
export interface CJVariant {
  // Identifiants
  vid: string;                    // Variant ID
  pid: string;                    // Product ID
  
  // Noms et SKU
  variantName?: string | null;    // Nom chinois (peut être null)
  variantNameEn?: string | null;  // Nom anglais
  variantSku: string;             // SKU du variant (ex: "CJJSBGDY00002-Grey")
  variantUnit?: string | null;    // Unité
  
  // Propriétés et clés
  variantProperty?: string | null; // JSON string des propriétés (ex: "[]")
  variantKey?: string;            // JSON string array (ex: "[\"XS\"]" ou "Grey")
  variantValue?: string;           // Valeur (pour compatibilité)
  variantStandard?: string;       // Format spécial (ex: "long=5,width=5,height=5")
  
  // Dimensions (en mm)
  variantLength?: number;         // Longueur
  variantWidth?: number;          // Largeur
  variantHeight?: number;         // Hauteur
  variantVolume?: number;         // Volume (mm³)
  
  // Poids et prix
  variantWeight?: number;         // Poids en grammes
  variantSellPrice: number;       // Prix de vente (USD)
  
  // Image (attention : pas array, mais string unique)
  variantImage?: string;          // URL image du variant
  images?: string[];              // Pour compatibilité (array d'images)
  
  // Dates
  createTime?: string | null;     // Date de création ISO (peut être null)
  
  // Stock (rempli via getInventoryByPid ou queryByVid)
  stock?: number;                 // Stock total calculé
  warehouseStock?: CJVariantStock[]; // Stock détaillé par entrepôt
}

/**
 * Stock d'un variant dans un entrepôt (endpoints 3.1 et 3.2)
 */
export interface CJVariantStock {
  vid?: string;                   // Variant ID (seulement dans 3.1)
  areaId?: number | string;       // ID entrepôt (seulement dans 3.1 et 3.2)
  areaEn?: string;                // Nom entrepôt (seulement dans 3.1 et 3.2)
  countryCode: string;            // Code pays (ex: "CN", "US")
  countryNameEn?: string;         // Nom pays (seulement dans 3.2)
  
  // Différences de noms selon l'endpoint
  totalInventoryNum?: number;     // 3.1 et 3.2 : Stock total
  cjInventoryNum?: number;        // 3.1 et 3.2 : Stock CJ
  factoryInventoryNum?: number;   // 3.1 et 3.2 : Stock usine
  
  totalInventory?: number;        // 3.3 : Stock total (nom différent !)
  cjInventory?: number;           // 3.3 : Stock CJ
  factoryInventory?: number;      // 3.3 : Stock usine
  
  verifiedWarehouse?: number;     // 3.3 uniquement : Entrepôt vérifié
  
  // Déprécié mais encore présent
  storageNum?: number;            // Déprécié, utiliser totalInventoryNum
}

/**
 * Réponse de l'endpoint 3.3 (getInventoryByPid)
 */
export interface CJProductInventoryResponse {
  inventories?: Array<{
    areaEn: string;
    areaId: number;
    countryCode: string;
    totalInventoryNum: number;
    cjInventoryNum: number;
    factoryInventoryNum: number;
    countryNameEn: string;
  }>;
  variantInventories: Array<{
    vid: string;
    inventory: Array<{
      countryCode: string;
      totalInventory: number;     // ⚠️ Nom différent !
      cjInventory: number;
      factoryInventory: number;
      verifiedWarehouse: number;
    }>;
  }>;
}

/**
 * Review d'un produit CJ (structure réelle de l'API)
 */
export interface CJReview {
  // Identifiants
  commentId: number | string;       // ID du commentaire (number dans l'API)
  pid: string;                      // Product ID
  
  // Contenu
  comment: string;                  // Commentaire texte
  score: string;                    // Note en string ("1" à "5") ⚠️
  
  // Auteur
  commentUser: string;              // Nom utilisateur (anonymisé: "F***o")
  
  // Médias
  commentUrls?: string[];           // URLs des images du review
  
  // Localisation
  countryCode?: string;             // Code pays (ex: "MX", "US")
  flagIconUrl?: string;             // URL du drapeau du pays
  
  // Date
  commentDate: string;              // Date ISO avec timezone
  
  // ✅ Champs calculés/mappés pour compatibilité frontend
  id?: string;                      // Alias de commentId (pour le frontend)
  rating?: number;                  // Score converti en number (pour le frontend)
  userName?: string;                // Alias de commentUser (pour le frontend)
  images?: string[];                // Alias de commentUrls (pour le frontend)
  createdAt?: string;               // Alias de commentDate (pour le frontend)
  verified?: boolean;               // Toujours true pour les reviews CJ
}

/**
 * Réponse paginée de l'API reviews
 */
export interface CJReviewsResponse {
  pageNum: string;                  // Numéro de page (string dans l'API)
  pageSize: string;                 // Taille de page (string dans l'API)
  total: string;                    // Total de reviews (string dans l'API)
  list: CJReview[];                 // Liste des reviews
}

/**
 * Statistiques des reviews
 */
export interface CJReviewStats {
  totalReviews: number;             // Total de reviews
  averageRating: number;            // Note moyenne (0-5)
  ratingDistribution: {             // Répartition par note
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  withPhotos: number;               // Nombre avec photos
}

/**
 * Options de filtrage des reviews
 */
export interface CJReviewFilters {
  rating?: number;                      // Filtrer par note (1-5, 0 = toutes)
  verified?: boolean;                   // Seulement achats vérifiés
  withPhotos?: boolean;                 // Seulement avec photos
  sortBy?: 'recent' | 'helpful' | 'rating'; // Tri
  page?: number;                        // Pagination
  pageSize?: number;                    // Taille de page
}

/**
 * Mapper un review CJ vers le format frontend
 */
export function mapCJReview(review: CJReview): CJReview {
  const rating = parseInt(review.score || "0", 10);
  
  return {
    ...review,
    id: String(review.commentId),
    rating: rating,
    userName: review.commentUser,
    images: review.commentUrls || [],
    createdAt: review.commentDate,
    verified: true  // Tous les reviews CJ sont vérifiés
  };
}

/**
 * Calculer les statistiques des reviews
 */
export function calculateReviewStats(reviews: CJReview[]): CJReviewStats {
  if (!reviews || reviews.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      withPhotos: 0
    };
  }
  
  const totalReviews = reviews.length;
  
  // Calculer la note moyenne
  const totalRating = reviews.reduce((sum, r) => {
    const rating = parseInt(r.score || "0", 10);
    return sum + rating;
  }, 0);
  const averageRating = totalRating / totalReviews;
  
  // Calculer la répartition
  const ratingDistribution = {
    5: reviews.filter(r => r.score === "5").length,
    4: reviews.filter(r => r.score === "4").length,
    3: reviews.filter(r => r.score === "3").length,
    2: reviews.filter(r => r.score === "2").length,
    1: reviews.filter(r => r.score === "1").length
  };
  
  // Compter les reviews avec photos
  const withPhotos = reviews.filter(r => 
    r.commentUrls && r.commentUrls.length > 0
  ).length;
  
  return {
    totalReviews,
    averageRating: parseFloat(averageRating.toFixed(1)),
    ratingDistribution,
    withPhotos
  };
}

/**
 * Filtrer et trier les reviews
 */
export function filterAndSortReviews(
  reviews: CJReview[],
  filters: CJReviewFilters
): CJReview[] {
  let filtered = [...reviews];
  
  // Filtrer par note
  if (filters.rating && filters.rating > 0) {
    filtered = filtered.filter(r => r.rating === filters.rating);
  }
  
  // Filtrer par vérifié
  if (filters.verified) {
    filtered = filtered.filter(r => r.verified === true);
  }
  
  // Filtrer par photos
  if (filters.withPhotos) {
    filtered = filtered.filter(r => r.images && r.images.length > 0);
  }
  
  // Trier
  switch (filters.sortBy) {
    case 'recent':
      filtered.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      break;
      case 'helpful':
        // Les reviews CJ n'ont pas de champ helpful, on trie par date
        filtered.sort((a, b) => {
          const dateA = a.commentDate || a.createdAt || 0;
          const dateB = b.commentDate || b.createdAt || 0;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
        break;
    case 'rating':
      filtered.sort((a, b) => b.rating - a.rating);
      break;
  }
  
  return filtered;
}

/**
 * Options de recherche de produits (API V2)
 */
export interface CJProductSearchOptions {
  // Pagination V2
  page?: number;                      // ✅ V2 utilise "page" (min 1, max 1000)
  size?: number;                      // ✅ V2 utilise "size" (min 1, max 100)
  
  // Recherche
  keyWord?: string;                   // ✅ V2 utilise "keyWord" au lieu de productName
  
  // Catégories
  categoryId?: string;                // ID catégorie niveau 3
  lv2categoryList?: string[];         // ✅ NOUVEAU : Liste IDs catégories niveau 2
  lv3categoryList?: string[];         // ✅ NOUVEAU : Liste IDs catégories niveau 3
  
  // Filtres de prix
  minPrice?: number;                  // → Devient startSellPrice en V2
  maxPrice?: number;                  // → Devient endSellPrice en V2
  
  // Filtres d'inventaire
  startInventory?: number;            // → Devient startWarehouseInventory en V2
  endInventory?: number;              // → Devient endWarehouseInventory en V2
  verifiedWarehouse?: number;         // 0=Tous, 1=Vérifié, 2=Non vérifié
  
  // Localisation
  countryCode?: string;               // Ex: "CN", "US", "FR"
  zonePlatform?: string;              // ✅ NOUVEAU : Ex: "shopify", "ebay", "amazon"
  isWarehouse?: boolean;              // ✅ NOUVEAU : true=recherche entrepôt global
  currency?: string;                  // ✅ NOUVEAU : Ex: "USD", "AUD", "EUR"
  
  // Certifications et personnalisation
  hasCertification?: number;          // ✅ NOUVEAU : 0=Non, 1=Oui
  customization?: number;             // ✅ NOUVEAU : 0=Non, 1=Oui
  
  // Filtres de temps
  timeStart?: number;                 // Timestamp (millisecondes)
  timeEnd?: number;                   // Timestamp (millisecondes)
  
  // Tri
  sort?: 'asc' | 'desc';              // Ordre de tri
  orderBy?: number;                   // ✅ V2 utilise des nombres: 0=best match, 1=listing, 2=price, 3=time, 4=inventory
  
  // Fournisseur
  supplierId?: string;                // ID du fournisseur
  
  // ✅ NOUVEAU : Features (V2)
  features?: string[];                // Ex: ['enable_description', 'enable_category', 'enable_video']
  
  // Type de produit
  productType?: number;               // Type de produit
  productFlag?: number;                // ✅ NOUVEAU : 0=Trending, 1=New, 2=Video, 3=Slow-moving
  
  // Livraison
  isFreeShipping?: number;            // 0=Non, 1=Oui
  isSelfPickup?: number;              // 0=Non, 1=Oui
  
  // Legacy support
  pageNum?: number;                   // Pour compatibilité avec ancien code
  pageSize?: number;                  // Pour compatibilité avec ancien code
  productName?: string;               // Pour compatibilité avec ancien code
  productNameEn?: string;             // Pour compatibilité avec ancien code
}

export interface CJProductSearchResult {
  products: CJProduct[];              // ✅ V2 utilise "products" au lieu de "list"
  total: number;                      // Total de résultats (totalRecords en V2)
  pageNumber: number;                 // ✅ V2 utilise "pageNumber" au lieu de "pageNum"
  pageSize: number;                   // Taille de page
  totalPages?: number;                 // ✅ NOUVEAU : Nombre total de pages
  relatedCategories?: CJCategory[];   // ✅ NOUVEAU : Catégories liées
  warehouses?: CJWarehouse[];         // ✅ NOUVEAU : Entrepôts disponibles
  keyWord?: string;                   // ✅ NOUVEAU : Mot-clé utilisé
  searchHit?: string;                 // ✅ NOUVEAU : Statistiques de recherche
  // Legacy support
  list?: CJProduct[];                 // Pour compatibilité avec ancien code
  pageNum?: number;                   // Pour compatibilité avec ancien code
}

/**
 * Catégorie liée (V2)
 */
export interface CJCategory {
  categoryId: string;
  categoryName: string;
}

/**
 * Entrepôt (V2)
 */
export interface CJWarehouse {
  warehouseId: string;
  warehouseName: string;
  countryCode: string;
}

/**
 * Options pour récupérer My Products (favoris)
 */
export interface CJMyProductsOptions {
  keyword?: string;       // Filtrer par nom/SKU
  categoryId?: string;    // Filtrer par catégorie
  startAt?: string;       // Date début (format: yyyy-MM-dd hh:mm:ss)
  endAt?: string;         // Date fin
  isListed?: number;      // 0 ou 1
  visiable?: number;      // 0 ou 1
  hasPacked?: number;     // 0 ou 1
  hasVirPacked?: number;  // 0 ou 1
  pageSize?: number;      // Max 100
}

/**
 * Structure d'un produit My Product (favori CJ)
 */
export interface CJMyProduct {
  productId: string;           // ID du produit
  bigImage: string;            // Image principale
  nameEn: string;              // Nom anglais
  sku: string;                 // SKU du produit
  vid: string;                 // ID du variant
  packWeight: string;          // Poids avec emballage (g)
  weight: string;              // Poids produit (g)
  sellPrice: string;           // Prix de vente
  discountPrice?: string;      // Prix réduit
  discountPriceRate?: string;  // Taux de réduction
  totalPrice: string;          // Prix total
  productType: string;         // Type de produit
  propertyKeyList: string[];   // Propriétés logistiques
  defaultArea: string;         // Entrepôt par défaut
  areaId: string;              // ID entrepôt
  areaCountryCode: string;     // Code pays entrepôt
  listedShopNum: string;       // Nombre de boutiques listées
  createAt: number;            // Timestamp ajout aux favoris
  hasPacked: number;           // A un packaging
  hasVirPacked: number;        // A un packaging virtuel
  shopMethod: string;          // Méthode d'expédition
  trialFreight: string;        // Frais de test
  freightDiscount: string;      // Réduction livraison
  lengthList?: number[];       // Liste des longueurs (mm)
  heightList?: number[];       // Liste des hauteurs (mm)
  widthList?: number[];        // Liste des largeurs (mm)
  volumeList?: number[];       // Liste des volumes (mm³)
}

/**
 * Réponse paginée My Products
 */
export interface CJMyProductsResponse {
  pageSize: number;
  pageNumber: number;
  totalRecords: number;
  totalPages: number;
  content: CJMyProduct[];
}

export interface CJProductImportResult {
  productId: string;
  cjProductId: string;
  success: boolean;
  message?: string;
}

