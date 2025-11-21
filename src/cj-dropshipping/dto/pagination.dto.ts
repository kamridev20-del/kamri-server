import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
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
    example: 20,
    minimum: 1,
    maximum: 200,
    required: false,
    default: 20
  })
  @IsNumber()
  @Min(1)
  @Max(200) // Maximum selon la doc CJ
  @Type(() => Number)
  @IsOptional()
  pageSize?: number = 20;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  pageNum: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}