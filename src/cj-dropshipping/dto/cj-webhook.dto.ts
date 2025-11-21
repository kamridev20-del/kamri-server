import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum WebhookType {
  PRODUCT = 'PRODUCT',
  VARIANT = 'VARIANT',
  STOCK = 'STOCK',
  ORDER = 'ORDER',
  LOGISTIC = 'LOGISTIC',
  SOURCINGCREATE = 'SOURCINGCREATE',
  ORDERSPLIT = 'ORDERSPLIT',
}

export class CJProductParamsDto {
  @ApiProperty({ description: 'ID de catégorie', nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiProperty({ description: 'Nom de catégorie', nullable: true })
  @IsOptional()
  @IsString()
  categoryName?: string | null;

  @ApiProperty({ description: 'ID du produit CJ' })
  @IsString()
  pid: string;

  @ApiProperty({ description: 'Description du produit', nullable: true })
  @IsOptional()
  @IsString()
  productDescription?: string | null;

  @ApiProperty({ description: 'Image du produit', nullable: true })
  @IsOptional()
  @IsString()
  productImage?: string | null;

  @ApiProperty({ description: 'Nom du produit', nullable: true })
  @IsOptional()
  @IsString()
  productName?: string | null;

  @ApiProperty({ description: 'Nom en anglais', nullable: true })
  @IsOptional()
  @IsString()
  productNameEn?: string | null;

  @ApiProperty({ description: 'Propriété 1', nullable: true })
  @IsOptional()
  @IsString()
  productProperty1?: string | null;

  @ApiProperty({ description: 'Propriété 2', nullable: true })
  @IsOptional()
  @IsString()
  productProperty2?: string | null;

  @ApiProperty({ description: 'Propriété 3', nullable: true })
  @IsOptional()
  @IsString()
  productProperty3?: string | null;

  @ApiProperty({ description: 'Prix de vente', nullable: true })
  @IsOptional()
  productSellPrice?: number | null;

  @ApiProperty({ description: 'SKU du produit', nullable: true })
  @IsOptional()
  @IsString()
  productSku?: string | null;

  @ApiProperty({ description: 'Statut du produit', nullable: true })
  @IsOptional()
  @IsString()
  productStatus?: string | null;

  @ApiProperty({ description: 'Champs modifiés', type: [String] })
  @IsArray()
  @IsString({ each: true })
  fields: string[];
}

export class CJVariantParamsDto {
  @ApiProperty({ description: 'ID de la variante' })
  @IsString()
  vid: string;

  @ApiProperty({ description: 'Nom de la variante', nullable: true })
  @IsOptional()
  @IsString()
  variantName?: string | null;

  @ApiProperty({ description: 'Poids de la variante', nullable: true })
  @IsOptional()
  variantWeight?: number | null;

  @ApiProperty({ description: 'Longueur', nullable: true })
  @IsOptional()
  variantLength?: number | null;

  @ApiProperty({ description: 'Largeur', nullable: true })
  @IsOptional()
  variantWidth?: number | null;

  @ApiProperty({ description: 'Hauteur', nullable: true })
  @IsOptional()
  variantHeight?: number | null;

  @ApiProperty({ description: 'Image de la variante', nullable: true })
  @IsOptional()
  @IsString()
  variantImage?: string | null;

  @ApiProperty({ description: 'SKU de la variante', nullable: true })
  @IsOptional()
  @IsString()
  variantSku?: string | null;

  @ApiProperty({ description: 'Clé de la variante', nullable: true })
  @IsOptional()
  @IsString()
  variantKey?: string | null;

  @ApiProperty({ description: 'Prix de vente', nullable: true })
  @IsOptional()
  variantSellPrice?: number | null;

  @ApiProperty({ description: 'Statut de la variante', nullable: true })
  @IsOptional()
  @IsString()
  variantStatus?: string | null;

  @ApiProperty({ description: 'Valeur 1', nullable: true })
  @IsOptional()
  @IsString()
  variantValue1?: string | null;

  @ApiProperty({ description: 'Valeur 2', nullable: true })
  @IsOptional()
  @IsString()
  variantValue2?: string | null;

  @ApiProperty({ description: 'Valeur 3', nullable: true })
  @IsOptional()
  @IsString()
  variantValue3?: string | null;

  @ApiProperty({ description: 'Champs modifiés', type: [String] })
  @IsArray()
  @IsString({ each: true })
  fields: string[];
}

export class CJWebhookDto {
  @ApiProperty({ description: 'Type de webhook', enum: WebhookType })
  @IsEnum(WebhookType)
  type: WebhookType;

  @ApiProperty({ description: 'ID unique du message' })
  @IsString()
  messageId: string;

  @ApiProperty({ 
    description: 'Données du webhook', 
    oneOf: [
      { $ref: '#/components/schemas/CJProductParamsDto' },
      { $ref: '#/components/schemas/CJVariantParamsDto' }
    ]
  })
  @IsObject()
  params: CJProductParamsDto | CJVariantParamsDto | any;

  @ApiProperty({ description: 'Timestamp de réception', required: false })
  @IsString()
  @IsOptional()
  timestamp?: string;
}

export class CJWebhookConfigDto {
  @ApiProperty({ description: 'URL du webhook' })
  @IsString()
  webhookUrl: string;

  @ApiProperty({ 
    description: 'Types d\'événements à écouter',
    example: ['PRODUCT', 'STOCK', 'ORDER', 'LOGISTICS']
  })
  @IsString()
  events: string[];
}

export class CJWebhookLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  messageId: string;

  @ApiProperty()
  payload: any;

  @ApiProperty()
  processed: boolean;

  @ApiProperty({ required: false })
  error?: string;

  @ApiProperty()
  createdAt: Date;
}

