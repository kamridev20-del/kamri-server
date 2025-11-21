import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateCJConfigDto {
  @ApiProperty({ description: 'Email du compte CJ Dropshipping', example: 'user@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Clé API CJ Dropshipping' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiProperty({ 
    description: 'Niveau d\'abonnement CJ', 
    enum: ['free', 'plus', 'prime', 'advanced'],
    example: 'free'
  })
  @IsEnum(['free', 'plus', 'prime', 'advanced'])
  @IsOptional()
  tier?: 'free' | 'plus' | 'prime' | 'advanced';

  @ApiProperty({ description: 'Token de plateforme (optionnel)' })
  @IsString()
  @IsOptional()
  platformToken?: string;

  @ApiProperty({ description: 'Activer/désactiver l\'intégration CJ' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class CJConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  tier: string;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  connected: boolean;

  @ApiProperty()
  lastSync?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

