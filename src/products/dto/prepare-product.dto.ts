import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class PrepareProductDto {
  @ApiProperty({ description: 'ID de la catégorie KAMRI' })
  @IsString()
  categoryId: string;

  @ApiProperty({ description: 'Marge à appliquer (%)', required: false, default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  margin?: number;

  @ApiProperty({ description: 'ID du fournisseur', required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;
}

