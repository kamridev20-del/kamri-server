import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, UseGuards, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { OrderCJIntegrationService } from './order-cj-integration.service';

@ApiTags('orders')
@Controller('api/orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderCJIntegration: OrderCJIntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  async createOrder(
    @GetUser() user: any, 
    @Body() body: { 
      items: any[];
      shippingAddress?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
      };
      shippingMethod?: string;
      shippingCost?: number;
      paymentMethod?: string;
      paymentIntentId?: string;
      total?: number;
    }
  ) {
    try {
      this.logger.log(`📦 Création commande demandée pour user ${user.userId} avec ${body.items?.length || 0} item(s)`);
      
      // Créer ou mettre à jour l'adresse si fournie
      if (body.shippingAddress) {
        await this.ordersService.saveShippingAddress(user.userId, body.shippingAddress);
      }
      
      const order = await this.ordersService.createOrder(user.userId, body.items, {
        shippingMethod: body.shippingMethod,
        shippingCost: body.shippingCost,
        paymentMethod: body.paymentMethod,
        paymentIntentId: body.paymentIntentId,
        shippingAddress: body.shippingAddress,
        total: body.total,
      });
      
      return order;
    } catch (error: any) {
      this.logger.error(`❌ Erreur création commande:`, error);
      this.logger.error(`❌ Stack trace:`, error.stack);
      
      // Retourner un message d'erreur plus clair
      const errorMessage = error.message || 'Erreur lors de la création de la commande';
      const statusCode = error.code === 'P2003' ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
      
      throw new HttpException(
        {
          statusCode,
          message: errorMessage,
          error: error.code || 'INTERNAL_SERVER_ERROR',
          details: error.meta || null,
        },
        statusCode
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get user orders or all orders for admin' })
  async getUserOrders(@GetUser() user: any) {
    // Si l'utilisateur est admin, retourner toutes les commandes
    if (user.role === 'admin') {
      return this.ordersService.getAllOrders();
    }
    // Sinon, retourner seulement les commandes de l'utilisateur
    return this.ordersService.getUserOrders(user.userId);
  }

  /**
   * Créer manuellement une commande CJ
   * POST /api/orders/:id/create-cj
   */
  @Post(':id/create-cj')
  @ApiOperation({ summary: 'Créer manuellement une commande CJ' })
  async createCJOrder(@Param('id') id: string) {
    try {
      const result = await this.orderCJIntegration.createCJOrder(id);
      
      return {
        success: result.success,
        message: result.message,
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erreur création commande CJ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Ajouter une commande CJ au panier
   * POST /api/orders/:id/cj-add-cart
   */
  @Post(':id/cj-add-cart')
  @ApiOperation({ summary: 'Ajouter une commande CJ au panier' })
  async addCJOrderToCart(@Param('id') id: string) {
    try {
      const mapping = await this.prisma.cJOrderMapping.findUnique({
        where: { orderId: id },
      });

      if (!mapping) {
        throw new HttpException(
          'Commande CJ non trouvée',
          HttpStatus.NOT_FOUND,
        );
      }

      const result = await this.orderCJIntegration.addCJOrderToCart(mapping.cjOrderId);
      
      return {
        success: true,
        message: 'Commande ajoutée au panier CJ avec succès',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erreur lors de l\'ajout au panier CJ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Confirmer le panier CJ pour une commande
   * POST /api/orders/:id/cj-confirm-cart
   */
  @Post(':id/cj-confirm-cart')
  @ApiOperation({ summary: 'Confirmer le panier CJ pour une commande' })
  async confirmCJCart(@Param('id') id: string) {
    try {
      const mapping = await this.prisma.cJOrderMapping.findUnique({
        where: { orderId: id },
      });

      if (!mapping) {
        throw new HttpException(
          'Commande CJ non trouvée',
          HttpStatus.NOT_FOUND,
        );
      }

      const result = await this.orderCJIntegration.confirmCJCart(mapping.cjOrderId);
      
      return {
        success: true,
        message: 'Panier CJ confirmé avec succès',
        data: result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erreur lors de la confirmation du panier CJ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtenir le statut CJ d'une commande
   * GET /api/orders/:id/cj-status
   */
  @Get(':id/cj-status')
  @ApiOperation({ summary: 'Obtenir le statut CJ d\'une commande' })
  async getCJStatus(@Param('id') id: string) {
    try {
      const mapping = await this.prisma.cJOrderMapping.findUnique({
        where: { orderId: id },
      });

      if (!mapping) {
        return {
          success: false,
          message: 'Commande CJ non trouvée',
          hasCJOrder: false,
        };
      }

      return {
        success: true,
        hasCJOrder: true,
        data: mapping,
      };
    } catch (error: any) {
      throw new HttpException(
        'Erreur récupération statut CJ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Vérifier si commande a des produits CJ
   * GET /api/orders/:id/has-cj-products
   */
  @Get(':id/has-cj-products')
  @ApiOperation({ summary: 'Vérifier si une commande contient des produits CJ' })
  async hasCJProducts(@Param('id') id: string) {
    try {
      const hasCJ = await this.orderCJIntegration.hasCJProducts(id);
      
      return {
        success: true,
        hasCJProducts: hasCJ,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erreur vérification produits CJ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Tester la transformation d'une commande en format CJ (sans créer la commande)
   * GET /api/orders/:id/test-cj-transform
   */
  @Get(':id/test-cj-transform')
  @ApiOperation({ summary: 'Tester la transformation d\'une commande en format CJ (debug)' })
  async testCJTransform(@Param('id') id: string) {
    try {
      const { cjOrderData, errors } = await this.orderCJIntegration.transformOrderToCJ(id);
      
      return {
        success: true,
        data: {
          cjOrderData,
          errors: errors || null,
          productsCount: cjOrderData.products.length,
          products: cjOrderData.products.map((p, idx) => ({
            index: idx + 1,
            vid: p.vid,
            vidType: typeof p.vid,
            vidLength: String(p.vid).length,
            quantity: p.quantity,
            quantityType: typeof p.quantity,
            storeLineItemId: p.storeLineItemId,
          })),
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erreur transformation commande CJ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtenir les détails complets d'une commande CJ
   * GET /api/orders/:id/cj-details
   */
  @Get(':id/cj-details')
  @ApiOperation({ summary: 'Obtenir les détails complets d\'une commande CJ' })
  async getCJDetails(@Param('id') id: string) {
    try {
      const mapping = await this.prisma.cJOrderMapping.findUnique({
        where: { orderId: id },
      });

      if (!mapping) {
        return {
          success: false,
          message: 'Commande CJ non trouvée',
          hasCJOrder: false,
        };
      }

      // Parser les métadonnées
      let metadata = {};
      if (mapping.metadata) {
        try {
          metadata = JSON.parse(mapping.metadata);
        } catch (e) {
          this.logger.warn(`Erreur parsing metadata pour commande ${id}:`, e);
        }
      }

      // Récupérer les détails depuis l'API CJ si possible
      let cjOrderDetails = null;
      try {
        // Accéder au service CJ via l'injection de dépendance
        const cjOrderService = (this.orderCJIntegration as any).cjOrderService;
        if (cjOrderService) {
          cjOrderDetails = await cjOrderService.getOrderStatus(mapping.cjOrderId);
        }
      } catch (error) {
        this.logger.warn(`Impossible de récupérer les détails depuis CJ pour ${mapping.cjOrderId}:`, error);
      }

      return {
        success: true,
        hasCJOrder: true,
        data: {
          mapping: {
            id: mapping.id,
            cjOrderId: mapping.cjOrderId,
            cjOrderNumber: mapping.cjOrderNumber,
            status: mapping.status,
            trackNumber: mapping.trackNumber,
            createdAt: mapping.createdAt,
            updatedAt: mapping.updatedAt,
          },
          metadata,
          cjOrderDetails,
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erreur récupération détails CJ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Synchroniser le statut d'une commande CJ manuellement
   * POST /api/orders/:id/sync-cj-status
   */
  @Post(':id/sync-cj-status')
  @ApiOperation({ summary: 'Synchroniser le statut d\'une commande CJ manuellement' })
  async syncCJStatus(@Param('id') id: string) {
    try {
      const mapping = await this.prisma.cJOrderMapping.findUnique({
        where: { orderId: id },
      });

      if (!mapping) {
        throw new HttpException(
          'Commande CJ non trouvée',
          HttpStatus.NOT_FOUND,
        );
      }

      // Récupérer le statut depuis l'API CJ
      const cjOrderService = (this.orderCJIntegration as any).cjOrderService;
      if (!cjOrderService) {
        throw new HttpException(
          'Service CJ non disponible',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const cjOrder = await cjOrderService.getOrderStatus(mapping.cjOrderId);

      // Mettre à jour le mapping
      const updatedMapping = await this.prisma.cJOrderMapping.update({
        where: { id: mapping.id },
        data: {
          status: cjOrder.orderStatus || mapping.status,
          trackNumber: cjOrder.trackNumber || mapping.trackNumber,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Statut CJ synchronisé avec succès',
        data: {
          oldStatus: mapping.status,
          newStatus: updatedMapping.status,
          trackNumber: updatedMapping.trackNumber,
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erreur synchronisation statut CJ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('order/:id')
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@Param('id') id: string) {
    try {
      const order = await this.ordersService.getOrder(id);
      
      if (!order) {
        throw new HttpException(
          'Commande introuvable',
          HttpStatus.NOT_FOUND,
        );
      }
      
      return order;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Erreur lors de la récupération de la commande',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtenir les statistiques des commandes CJ
   * GET /api/orders/cj/stats
   */
  @Get('cj/stats')
  @ApiOperation({ summary: 'Obtenir les statistiques des commandes CJ' })
  async getCJStats() {
    try {
      const mappings = await this.prisma.cJOrderMapping.findMany({
        include: {
          order: true,
        },
      });

      const total = mappings.length;
      const byStatus: Record<string, number> = {};
      let totalAmount = 0;
      let totalProductAmount = 0;
      let totalPostageAmount = 0;
      let successCount = 0;

      const last30Days = {
        created: 0,
        paid: 0,
        shipped: 0,
        delivered: 0,
      };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      mappings.forEach((mapping) => {
        // Compter par statut
        byStatus[mapping.status] = (byStatus[mapping.status] || 0) + 1;

        // Calculer les montants depuis metadata
        if (mapping.metadata) {
          try {
            const metadata = JSON.parse(mapping.metadata);
            totalProductAmount += metadata.productAmount || 0;
            totalPostageAmount += metadata.postageAmount || 0;
            totalAmount += metadata.orderAmount || 0;
          } catch (e) {
            // Ignorer les erreurs de parsing
          }
        }

        // Compter les succès (commandes créées avec succès)
        if (mapping.status !== 'ERROR' && mapping.cjOrderId) {
          successCount++;
        }

        // Statistiques des 30 derniers jours
        if (mapping.createdAt >= thirtyDaysAgo) {
          if (mapping.status === 'CREATED') last30Days.created++;
          if (mapping.status === 'PAID') last30Days.paid++;
          if (mapping.status === 'SHIPPED') last30Days.shipped++;
          if (mapping.status === 'DELIVERED') last30Days.delivered++;
        }
      });

      const successRate = total > 0 ? (successCount / total) * 100 : 0;

      return {
        success: true,
        data: {
          total,
          byStatus,
          totalAmount,
          totalProductAmount,
          totalPostageAmount,
          successRate: Math.round(successRate * 100) / 100,
          last30Days,
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erreur récupération statistiques CJ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

