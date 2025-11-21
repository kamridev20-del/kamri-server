import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @ApiProperty({ description: 'Thème de l\'interface', required: false })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({ description: 'Devise par défaut', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Langue par défaut', required: false })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ description: 'Couleur d\'accent', required: false })
  @IsOptional()
  @IsString()
  accentColor?: string;

  @ApiProperty({ description: 'Nom de l\'entreprise', required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ description: 'Email de l\'entreprise', required: false })
  @IsOptional()
  @IsEmail()
  companyEmail?: string;

  @ApiProperty({ description: 'Téléphone de l\'entreprise', required: false })
  @IsOptional()
  @IsString()
  companyPhone?: string;

  @ApiProperty({ description: 'Adresse de l\'entreprise', required: false })
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiProperty({ description: 'Limite de taux API', required: false })
  @IsOptional()
  @IsInt()
  apiRateLimit?: number;

  @ApiProperty({ description: 'Synchronisation automatique', required: false })
  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @ApiProperty({ description: 'Notifications activées', required: false })
  @IsOptional()
  @IsBoolean()
  notifications?: boolean;

  @ApiProperty({ description: 'Notifications email', required: false })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({ description: 'Notifications SMS', required: false })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;
}
