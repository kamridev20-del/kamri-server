import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CJProductSearchDto {
  @ApiProperty({ 
    description: 'Numéro de page (V2: max 1000)', 
    example: 1,
    minimum: 1,
    maximum: 1000,
    required: false 
  })
  @IsInt()
  @Min(1)
  @Max(1000) // ✅ V2 limite à 1000 pages
  @Type(() => Number)
  @IsOptional()
  pageNum?: number;

  @ApiProperty({ 
    description: 'Taille de page (V2: max 100)', 
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false 
  })
  @IsInt()
  @Min(1)
  @Max(100) // ✅ V2 limite à 100 (pas 200)
  @Type(() => Number)
  @IsOptional()
  pageSize?: number;

  @ApiProperty({ 
    description: 'ID de catégorie', 
    required: false 
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ 
    description: 'Liste IDs catégories niveau 2 (V2)', 
    required: false,
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  lv2categoryList?: string[];

  @ApiProperty({ 
    description: 'Liste IDs catégories niveau 3 (V2)', 
    required: false,
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  lv3categoryList?: string[];

  @ApiProperty({ 
    description: 'Product ID', 
    required: false 
  })
  @IsString()
  @IsOptional()
  pid?: string;

  @ApiProperty({ 
    description: 'Product SKU', 
    required: false 
  })
  @IsString()
  @IsOptional()
  productSku?: string;

  @ApiProperty({ 
    description: 'Nom du produit (chinois)', 
    required: false 
  })
  @IsString()
  @IsOptional()
  productName?: string;

  @ApiProperty({ 
    description: 'Nom du produit (anglais)', 
    required: false 
  })
  @IsString()
  @IsOptional()
  productNameEn?: string;

  @ApiProperty({ 
    description: 'Type de produit (V2: nombre)', 
    enum: [4, 10, 11],
    required: false 
  })
  @IsInt()
  @IsOptional()
  productType?: number;

  @ApiProperty({ 
    description: 'Product Flag (V2: 0=Trending, 1=New, 2=Video, 3=Slow-moving)', 
    enum: [0, 1, 2, 3],
    required: false 
  })
  @IsInt()
  @Min(0)
  @Max(3)
  @Type(() => Number)
  @IsOptional()
  productFlag?: number;

  @ApiProperty({ 
    description: 'Code pays (ex: CN, US)', 
    required: false 
  })
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiProperty({ 
    description: 'Zone Platform (V2: shopify, ebay, amazon, tiktok, etsy)', 
    required: false 
  })
  @IsString()
  @IsOptional()
  zonePlatform?: string;

  @ApiProperty({ 
    description: 'Is Warehouse (V2: recherche entrepôt global)', 
    required: false 
  })
  @IsBoolean()
  @IsOptional()
  isWarehouse?: boolean;

  @ApiProperty({ 
    description: 'Currency (V2: USD, AUD, EUR)', 
    required: false 
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ 
    description: 'Délai de livraison en heures', 
    enum: ['24', '48', '72'],
    required: false 
  })
  @IsString()
  @IsOptional()
  deliveryTime?: string;

  @ApiProperty({ 
    description: 'Type d\'inventaire vérifié (1=Vérifié, 2=Non vérifié)', 
    enum: [1, 2],
    required: false 
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  verifiedWarehouse?: number;

  @ApiProperty({ 
    description: 'Stock minimum', 
    minimum: 0,
    required: false 
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  startInventory?: number;

  @ApiProperty({ 
    description: 'Stock maximum', 
    minimum: 0,
    required: false 
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  endInventory?: number;

  @ApiProperty({ 
    description: 'Date de création (début) - format: yyyy-MM-dd hh:mm:ss', 
    required: false 
  })
  @IsString()
  @IsOptional()
  createTimeFrom?: string;

  @ApiProperty({ 
    description: 'Date de création (fin) - format: yyyy-MM-dd hh:mm:ss', 
    required: false 
  })
  @IsString()
  @IsOptional()
  createTimeTo?: string;

  @ApiProperty({ 
    description: 'ID de marque', 
    required: false 
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  brandOpenId?: number;

  @ApiProperty({ 
    description: 'Prix minimum', 
    example: 1.0,
    minimum: 0,
    required: false 
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minPrice?: number;

  @ApiProperty({ 
    description: 'Prix maximum', 
    example: 100.0,
    minimum: 0,
    required: false 
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  maxPrice?: number;

  @ApiProperty({ 
    description: 'Type de recherche (0=Tous, 2=Tendances, 21=Plus de tendances)', 
    enum: [0, 2, 21],
    required: false 
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  searchType?: number;

  @ApiProperty({ 
    description: 'Nombre minimum de listes', 
    minimum: 0,
    required: false 
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minListedNum?: number;

  @ApiProperty({ 
    description: 'Nombre maximum de listes', 
    minimum: 0,
    required: false 
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  maxListedNum?: number;

  @ApiProperty({ 
    description: 'Type de tri (desc/asc)', 
    enum: ['desc', 'asc'],
    required: false 
  })
  @IsString()
  @IsOptional()
  sort?: string;

  @ApiProperty({ 
    description: 'Champ de tri (V2: 0=best match, 1=listing, 2=price, 3=time, 4=inventory)', 
    enum: [0, 1, 2, 3, 4],
    required: false 
  })
  @Transform(({ value }) => {
    // ✅ Convertir les strings en nombres pour V2
    if (typeof value === 'string') {
      const mapping: { [key: string]: number } = {
        'createAt': 3,      // Create time
        'listedNum': 1,     // Listing count
        'sellPrice': 2,     // Sell price
        'inventory': 4,     // Inventory
        'default': 0,       // Best match
        'relevance': 0      // Best match
      };
      return mapping[value] !== undefined ? mapping[value] : parseInt(value, 10) || 0;
    }
    return typeof value === 'number' ? value : 0;
  })
  @IsInt()
  @Min(0)
  @Max(4)
  @Type(() => Number)
  @IsOptional()
  orderBy?: number | string; // Support string pour compatibilité (converti en nombre)

  @ApiProperty({ 
    description: 'Support pickup (1=supporté, 0=non supporté)', 
    enum: [0, 1],
    required: false 
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  isSelfPickup?: number;

  @ApiProperty({ 
    description: 'ID du fournisseur', 
    required: false 
  })
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiProperty({ 
    description: 'Livraison gratuite (0=non, 1=oui)', 
    enum: [0, 1],
    required: false 
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  isFreeShipping?: number;

  @ApiProperty({ 
    description: 'Version de personnalisation (1-5)', 
    enum: [1, 2, 3, 4, 5],
    required: false 
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  customizationVersion?: number;

  @ApiProperty({ 
    description: 'Has Certification (V2: 0=Non, 1=Oui)', 
    enum: [0, 1],
    required: false 
  })
  @IsInt()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  @IsOptional()
  hasCertification?: number;

  @ApiProperty({ 
    description: 'Customization (V2: 0=Non, 1=Oui)', 
    enum: [0, 1],
    required: false 
  })
  @IsInt()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  @IsOptional()
  customization?: number;

  @ApiProperty({ 
    description: 'Time Start (V2: timestamp millisecondes)', 
    required: false 
  })
  @IsNumber()
  @IsOptional()
  timeStart?: number;

  @ApiProperty({ 
    description: 'Time End (V2: timestamp millisecondes)', 
    required: false 
  })
  @IsNumber()
  @IsOptional()
  timeEnd?: number;

  // Pour compatibilité avec l'ancien code
  @ApiProperty({ 
    description: 'Mot-clé de recherche (legacy)', 
    required: false 
  })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiProperty({ 
    description: 'Critère de tri (legacy)', 
    required: false 
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiProperty({ 
    description: 'Features (V2: retour sélectif)', 
    enum: ['enable_description', 'enable_category', 'enable_combine', 'enable_video'],
    required: false,
    type: [String]
  })
  @IsArray()
  @IsIn(['enable_description', 'enable_category', 'enable_combine', 'enable_video'], { each: true })
  @IsOptional()
  features?: string[];
}

export class CJProductImportDto {
  @ApiProperty({ description: 'ID du produit CJ à importer' })
  @IsString()
  pid: string;

  @ApiProperty({ description: 'ID de la catégorie KAMRI', required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Marge à ajouter (en pourcentage)', required: false })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  margin?: number;
}

