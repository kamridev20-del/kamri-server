import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, Min, Max } from 'class-validator';

export class EditProductDto {
  @ApiProperty({ description: 'Nom du produit', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Description du produit', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Marge à appliquer (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  margin?: number;

  @ApiProperty({ description: 'ID de la catégorie KAMRI', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: 'Image principale', required: false })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ description: 'Liste des images', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ description: 'Badge du produit', required: false })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiProperty({ description: 'Stock disponible', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;
}

