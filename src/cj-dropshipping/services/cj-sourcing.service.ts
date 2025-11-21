import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CJAPIClient } from '../cj-api-client';
import {
  CJSourcingCreateRequest,
  CJSourcingStatus,
  mapCJSourcingStatus
} from '../interfaces/cj-sourcing.interface';

@Injectable()
export class CjSourcingService {
  private readonly logger = new Logger(CjSourcingService.name);

  constructor(
    private prisma: PrismaService,
    private apiClient: CJAPIClient
  ) {}

  /**
   * Créer une nouvelle demande de sourcing
   */
  async createSourcingRequest(data: CJSourcingCreateRequest) {
    this.logger.log(`📝 Création demande sourcing: ${data.productName}`);
    
    try {
      // 1. Appeler l'API CJ
      const response = await this.apiClient.createSourcingRequest(data);
      
      if (!response.success) {
        throw new Error('Échec création demande CJ');
      }
      
      // 2. Sauvegarder dans la base de données
      const request = await this.prisma.cJSourcingRequest.create({
        data: {
          cjSourcingId: response.data.cjSourcingId,
          thirdProductId: data.thirdProductId,
          thirdVariantId: data.thirdVariantId,
          thirdProductSku: data.thirdProductSku,
          productName: data.productName,
          productImage: data.productImage,
          productUrl: data.productUrl,
          price: data.price ? parseFloat(data.price) : null,
          remark: data.remark,
          status: CJSourcingStatus.PENDING
        }
      });
      
      this.logger.log(`✅ Demande sauvegardée: ${request.id}`);
      
      return {
        success: true,
        request: request,
        cjSourcingId: response.data.cjSourcingId
      };
      
    } catch (error) {
      this.logger.error(`❌ Erreur création demande:`, error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les demandes
   */
  async getAllRequests() {
    return this.prisma.cJSourcingRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Récupérer les demandes en attente/en cours
   */
  async getPendingRequests() {
    return this.prisma.cJSourcingRequest.findMany({
      where: {
        status: {
          in: [CJSourcingStatus.PENDING, CJSourcingStatus.PROCESSING]
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Mettre à jour le statut d'une demande
   */
  async updateRequestStatus(id: string) {
    this.logger.log(`🔄 Mise à jour statut: ${id}`);
    
    try {
      const request = await this.prisma.cJSourcingRequest.findUnique({
        where: { id }
      });
      
      if (!request || !request.cjSourcingId) {
        throw new Error('Demande introuvable');
      }
      
      // Vérifier le statut via l'API CJ
      const details = await this.apiClient.querySingleSourcingRequest(request.cjSourcingId);
      
      if (!details) {
        throw new Error('Impossible de récupérer le statut');
      }
      
      // Mapper le statut
      const newStatus = mapCJSourcingStatus(details.sourceStatus);
      
      // Mettre à jour
      const updated = await this.prisma.cJSourcingRequest.update({
        where: { id },
        data: {
          status: newStatus,
          statusChinese: details.sourceStatusStr,
          sourceNumber: details.sourceNumber,
          cjProductId: details.cjProductId,
          cjVariantSku: details.cjVariantSku,
          shopId: details.shopId,
          shopName: details.shopName,
          lastCheckedAt: new Date(),
          foundAt: details.cjProductId ? new Date() : null
        }
      });
      
      this.logger.log(`✅ Statut mis à jour: ${newStatus}`);
      
      return {
        success: true,
        request: updated,
        statusChanged: request.status !== newStatus
      };
      
    } catch (error) {
      this.logger.error(`❌ Erreur mise à jour statut:`, error);
      throw error;
    }
  }

  /**
   * Mettre à jour toutes les demandes en attente
   */
  async updateAllPendingRequests() {
    this.logger.log(`🔄 === MISE À JOUR TOUTES LES DEMANDES EN ATTENTE ===`);
    
    const pending = await this.getPendingRequests();
    
    if (pending.length === 0) {
      this.logger.log('✅ Aucune demande en attente');
      return { updated: 0, found: 0 };
    }
    
    this.logger.log(`📋 ${pending.length} demande(s) à mettre à jour`);
    
    let updated = 0;
    let found = 0;
    
    for (const request of pending) {
      try {
        const result = await this.updateRequestStatus(request.id);
        updated++;
        
        if (result.request.status === CJSourcingStatus.FOUND) {
          found++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        this.logger.error(`❌ Erreur MAJ ${request.id}:`, error);
      }
    }
    
    this.logger.log(`✅ ${updated} demandes mises à jour, ${found} produits trouvés`);
    
    return { updated, found };
  }

  /**
   * Marquer une demande comme importée
   */
  async markAsImported(id: string, importedProductId: string) {
    return this.prisma.cJSourcingRequest.update({
      where: { id },
      data: {
        imported: true,
        importedProductId: importedProductId
      }
    });
  }
}

