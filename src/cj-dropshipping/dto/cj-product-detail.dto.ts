import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CJProductDetailDto {
  @ApiProperty({ 
    description: 'ID du produit CJ (PID)', 
    example: '04A22450-67F0-4617-A132-E7AE7F8963B0',
    required: true 
  })
  @IsString()
  @IsNotEmpty()
  pid: string;
}

export class CJProductVariantStockDto {
  @ApiProperty({ 
    description: 'ID du produit CJ', 
    example: '04A22450-67F0-4617-A132-E7AE7F8963B0',
    required: true 
  })
  @IsString()
  @IsNotEmpty()
  pid: string;

  @ApiProperty({ 
    description: 'ID de la variante (optionnel)', 
    example: 'var123',
    required: false 
  })
  @IsString()
  variantId?: string;

  @ApiProperty({ 
    description: 'Code pays pour le stock', 
    example: 'US',
    required: false 
  })
  @IsString()
  countryCode?: string;
}