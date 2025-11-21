import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ description: 'Nom du fournisseur' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description du fournisseur', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'URL de l\'API du fournisseur' })
  @IsUrl()
  apiUrl: string;

  @ApiProperty({ description: 'Clé API du fournisseur', required: false })
  @IsOptional()
  @IsString()
  apiKey?: string;
}
