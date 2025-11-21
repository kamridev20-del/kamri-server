import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CJCategorySearchDto {
  @ApiProperty({ 
    description: 'ID de la catégorie parent pour récupérer les sous-catégories', 
    example: '121203',
    required: false 
  })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({ 
    description: 'Niveau de catégorie (1=principal, 2=sous-catégorie, 3=sous-sous-catégorie)', 
    example: 1,
    minimum: 1,
    maximum: 5,
    required: false 
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  @IsOptional()
  level?: number;

  @ApiProperty({ 
    description: 'Recherche par nom de catégorie', 
    example: 'Electronics',
    required: false 
  })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiProperty({ 
    description: 'Code pays pour filtrer les catégories disponibles', 
    example: 'FR',
    required: false 
  })
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiProperty({ 
    description: 'Inclure les catégories vides (sans produits)', 
    example: false,
    required: false,
    default: false
  })
  @IsOptional()
  includeEmpty?: boolean = false;

  @ApiProperty({ 
    description: 'Inclure le nombre de produits par catégorie', 
    example: true,
    required: false,
    default: true
  })
  @IsOptional()
  includeProductCount?: boolean = true;

  @ApiProperty({ 
    description: 'Numéro de page', 
    example: 1,
    minimum: 1,
    required: false,
    default: 1
  })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  pageNum?: number = 1;

  @ApiProperty({ 
    description: 'Taille de page', 
    example: 50,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 50
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  pageSize?: number = 50;
}

export interface CJCategory {
  categoryId: string;
  categoryName: string;
  categoryNameEn: string;
  level: number;
  parentId?: string;
  hasChildren: boolean;
  children?: CJCategory[];
  productCount?: number;
  isActive: boolean;
  sortOrder?: number;
  icon?: string;
  description?: string;
}

export interface CJCategoryResponse {
  code: number;
  success: boolean;
  message: string;
  data: {
    list: CJCategory[];
    total: number;
    pageNum: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}