import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'categories');

  constructor() {
    // Créer le dossier d'upload s'il n'existe pas
    this.ensureUploadDirectoryExists();
  }

  private ensureUploadDirectoryExists() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`📁 Dossier d'upload créé: ${this.uploadDir}`);
    }
  }

  /**
   * Sauvegarder un fichier image pour une catégorie
   */
  async saveCategoryImage(file: any, categoryId: string): Promise<string> {
    try {
      // Générer un nom de fichier unique
      const fileExtension = path.extname(file.originalname);
      const fileName = `category-${categoryId}-${Date.now()}${fileExtension}`;
      const filePath = path.join(this.uploadDir, fileName);

      // Écrire le fichier
      fs.writeFileSync(filePath, file.buffer);

      // Retourner l'URL relative pour l'accès via le serveur
      const relativePath = `/uploads/categories/${fileName}`;
      this.logger.log(`✅ Image sauvegardée: ${relativePath}`);
      
      return relativePath;
    } catch (error) {
      this.logger.error('❌ Erreur lors de la sauvegarde de l\'image:', error);
      throw error;
    }
  }

  /**
   * Supprimer une image de catégorie
   */
  async deleteCategoryImage(imageUrl: string): Promise<void> {
    try {
      // Extraire le nom du fichier de l'URL
      const fileName = path.basename(imageUrl);
      const filePath = path.join(this.uploadDir, fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`🗑️ Image supprimée: ${filePath}`);
      }
    } catch (error) {
      this.logger.error('❌ Erreur lors de la suppression de l\'image:', error);
      throw error;
    }
  }

  /**
   * Valider le type de fichier (uniquement les images)
   */
  validateImageFile(file: any): boolean {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    return allowedMimeTypes.includes(file.mimetype);
  }

  /**
   * Valider la taille du fichier (max 5MB)
   */
  validateFileSize(file: any): boolean {
    const maxSize = 5 * 1024 * 1024; // 5MB
    return file.size <= maxSize;
  }
}

