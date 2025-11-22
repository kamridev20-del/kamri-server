import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Param,
  BadRequestException,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('upload')
@Controller('api/upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('categories/:categoryId/image')
  @ApiOperation({ summary: 'Uploader une image pour une catégorie' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Image uploadée avec succès' })
  @ApiResponse({ status: 400, description: 'Fichier invalide' })
  @UseInterceptors(FileInterceptor('image'))
  async uploadCategoryImage(
    @Param('categoryId') categoryId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    // Valider le type de fichier
    if (!this.uploadService.validateImageFile(file)) {
      throw new BadRequestException(
        'Type de fichier non autorisé. Formats acceptés: JPEG, PNG, WebP, GIF',
      );
    }

    // Valider la taille du fichier
    if (!this.uploadService.validateFileSize(file)) {
      throw new BadRequestException('Fichier trop volumineux. Taille maximale: 5MB');
    }

    try {
      const imageUrl = await this.uploadService.saveCategoryImage(file, categoryId);
      return {
        success: true,
        imageUrl,
        message: 'Image uploadée avec succès',
      };
    } catch (error) {
      throw new BadRequestException('Erreur lors de l\'upload de l\'image');
    }
  }

  @Delete('categories/:categoryId/image')
  @ApiOperation({ summary: 'Supprimer l\'image d\'une catégorie' })
  @ApiResponse({ status: 200, description: 'Image supprimée avec succès' })
  async deleteCategoryImage(@Param('categoryId') categoryId: string) {
    // Note: L'URL de l'image devrait être passée dans le body
    // Pour simplifier, on peut aussi la récupérer depuis la catégorie
    return {
      success: true,
      message: 'Endpoint de suppression - à implémenter avec l\'URL de l\'image',
    };
  }
}

