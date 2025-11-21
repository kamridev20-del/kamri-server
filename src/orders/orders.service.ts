import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderCJIntegrationService } from './order-cj-integration.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private orderCJIntegration: OrderCJIntegrationService,
  ) {}

  async saveShippingAddress(userId: string, address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }) {
    this.logger.log(`💾 Sauvegarde adresse de livraison pour user ${userId}`);
    
    // Vérifier si une adresse par défaut existe déjà
    const existingAddress = await this.prisma.address.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });

    if (existingAddress) {
      // Mettre à jour l'adresse existante
      await this.prisma.address.update({
        where: { id: existingAddress.id },
        data: {
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          country: address.country,
        },
      });
      this.logger.log(`✅ Adresse mise à jour: ${existingAddress.id}`);
    } else {
      // Créer une nouvelle adresse par défaut
      await this.prisma.address.create({
        data: {
          userId,
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          country: address.country,
          isDefault: true,
        },
      });
      this.logger.log(`✅ Nouvelle adresse créée pour user ${userId}`);
    }
  }

  async createOrder(
    userId: string, 
    items: any[],
    options?: {
      shippingMethod?: string;
      shippingCost?: number;
      paymentMethod?: string;
      paymentIntentId?: string;
      shippingAddress?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
      };
      total?: number;
    }
  ) {
    this.logger.log(`📦 Création commande pour user ${userId}`);
    this.logger.log(`📋 ${items.length} item(s) reçu(s):`, JSON.stringify(items.map(i => ({
      productId: i.productId,
      variantId: i.variantId || '(aucun)',
      quantity: i.quantity,
      price: i.price
    })), null, 2));
    
    // ✅ Vérifier que l'utilisateur existe AVANT la transaction
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    
    if (!userExists) {
      throw new Error(`Utilisateur ${userId} introuvable`);
    }
    
    // ✅ Vérifier que tous les produits existent AVANT la transaction
    for (const item of items) {
      const productExists = await this.prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true },
      });
      
      if (!productExists) {
        throw new Error(`Produit ${item.productId} introuvable`);
      }
      
      // ✅ Vérifier que le variantId existe s'il est fourni
      if (item.variantId) {
        const variantIdStr = String(item.variantId).trim();
        
        // Ignorer les valeurs invalides
        if (variantIdStr === '' || variantIdStr === 'null' || variantIdStr === 'undefined') {
          this.logger.warn(`⚠️ VariantId invalide pour produit ${item.productId}: "${variantIdStr}", sera ignoré`);
          item.variantId = null;
        } else {
          try {
            const variantExists = await this.prisma.productVariant.findUnique({
              where: { id: variantIdStr },
              select: { id: true, productId: true },
            });
            
            if (!variantExists) {
              this.logger.warn(`⚠️ Variant ${variantIdStr} introuvable dans la base de données pour produit ${item.productId}, sera ignoré`);
              item.variantId = null; // Supprimer le variantId invalide
            } else if (variantExists.productId !== item.productId) {
              this.logger.warn(`⚠️ Variant ${variantIdStr} appartient au produit ${variantExists.productId}, pas à ${item.productId}, sera ignoré`);
              item.variantId = null; // Supprimer le variantId invalide
            } else {
              this.logger.log(`✅ Variant ${variantIdStr} validé pour produit ${item.productId}`);
            }
          } catch (error: any) {
            this.logger.error(`❌ Erreur lors de la vérification du variant ${variantIdStr} pour produit ${item.productId}:`, error.message);
            item.variantId = null; // Supprimer le variantId en cas d'erreur
          }
        }
      }
    }
    
    // ✅ Préparer les items AVANT la transaction (les validations sont déjà faites)
    const orderItemsData = items.map((item) => {
      // Base de données pour l'item (sans variantId par défaut)
      const orderItemData: {
        productId: string;
        quantity: number;
        price: number;
        variantId?: string; // Optionnel, seulement si valide
      } = {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      };
      
      // Inclure variantId SEULEMENT s'il existe, est valide, et a été vérifié
      // Ne pas inclure si null, undefined, ou chaîne vide
      // IMPORTANT: Ne pas inclure la propriété variantId du tout si elle est null/undefined
      const variantIdValue = item.variantId;
      if (variantIdValue && 
          variantIdValue !== null && 
          variantIdValue !== undefined &&
          variantIdValue !== 'null' && 
          variantIdValue !== 'undefined' &&
          String(variantIdValue).trim() !== '') {
        // Si item.variantId n'a pas été mis à null lors de la validation précédente,
        // c'est qu'il est valide, donc on peut l'inclure
        const trimmedVariantId = String(variantIdValue).trim();
        orderItemData.variantId = trimmedVariantId;
        this.logger.log(`✅ Item ${item.productId}: variantId=${trimmedVariantId} inclus`);
      } else {
        // Ne pas inclure variantId du tout si invalide (ne pas mettre à null explicitement)
        this.logger.log(`ℹ️ Item ${item.productId}: pas de variantId valide, création sans variant`);
      }
      
      return orderItemData;
    });
    
    this.logger.log(`📦 ${orderItemsData.length} item(s) préparé(s) pour création`);
    orderItemsData.forEach((item, idx) => {
      this.logger.log(`  Item ${idx + 1}: productId=${item.productId}, variantId=${item.variantId || '(aucun)'}, quantity=${item.quantity}, price=${item.price}`);
    });
    
    // Créer la commande KAMRI dans une transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Calculate total (utiliser le total fourni ou calculer)
      const calculatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const shippingCost = options?.shippingCost || 0;
      const finalTotal = options?.total || (calculatedTotal + shippingCost);

      // Les validations sont déjà faites avant la transaction
      // Create order
      try {
        this.logger.log(`🚀 Tentative création commande avec ${orderItemsData.length} item(s)...`);
        this.logger.log(`📋 Données à créer:`, JSON.stringify({
          userId,
          total: finalTotal,
          itemsCount: orderItemsData.length,
          items: orderItemsData.map(item => ({
            productId: item.productId,
            variantId: item.variantId || '(aucun)',
            quantity: item.quantity,
            price: item.price
          }))
        }, null, 2));
        
        const createdOrder = await tx.order.create({
          data: {
            userId,
            total: finalTotal,
            // ✅ Informations de paiement Stripe
            paymentIntentId: options?.paymentIntentId || null,
            paymentStatus: options?.paymentIntentId ? 'pending' : null,
            paymentMethod: options?.paymentMethod || null,
            // ✅ Informations de livraison
            shippingMethod: options?.shippingMethod || null,
            shippingCost: options?.shippingCost || null,
            shippingAddress: options?.shippingAddress ? JSON.stringify(options.shippingAddress) : null,
            items: {
              create: orderItemsData,
            },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });
        
        this.logger.log(`✅ Commande créée avec succès: ${createdOrder.id}`);

        // Clear cart
        await tx.cartItem.deleteMany({
          where: { userId },
        });

        return createdOrder;
      } catch (error: any) {
        this.logger.error(`❌ Erreur lors de la création de la commande:`, error);
        this.logger.error(`❌ Détails de l'erreur:`, {
          message: error.message,
          code: error.code,
          meta: error.meta,
          userId,
          items: orderItemsData,
          itemsCount: orderItemsData.length,
        });
        
        // Si c'est une erreur de contrainte de clé étrangère, donner plus de détails
        if (error.code === 'P2003') {
          const fieldName = error.meta?.field_name || 'unknown';
          const targetModel = error.meta?.model_name || 'unknown';
          this.logger.error(`❌ Contrainte FK violée: champ "${fieldName}" dans modèle "${targetModel}"`);
          
          // Vérifier quel champ cause le problème
          if (fieldName.includes('variantId') || fieldName.includes('variant')) {
            const problematicItems = orderItemsData.filter(item => item.variantId);
            this.logger.error(`❌ Items avec variantId problématique:`, problematicItems);
          } else if (fieldName.includes('productId') || fieldName.includes('product')) {
            const problematicItems = orderItemsData.filter(item => item.productId);
            this.logger.error(`❌ Items avec productId problématique:`, problematicItems);
          } else if (fieldName.includes('userId') || fieldName.includes('user')) {
            this.logger.error(`❌ userId problématique: ${userId}`);
          }
        }
        
        throw error;
      }
    });

    // ✨ NOUVEAU : Créer automatiquement la commande CJ si nécessaire
    // Note: On fait ça après la transaction pour éviter de bloquer la création KAMRI
    // en cas d'erreur CJ
    try {
      const cjResult = await this.orderCJIntegration.createCJOrder(order.id);
      
      if (cjResult.success) {
        this.logger.log(`✅ Commande CJ créée automatiquement: ${cjResult.cjOrderId}`);
      } else if (cjResult.skipped) {
        this.logger.log(`ℹ️ Commande sans produits CJ, skip`);
      } else {
        this.logger.warn(`⚠️ Échec création CJ: ${cjResult.message}`);
        // Ne pas bloquer la commande KAMRI si échec CJ
        // TODO: Ajouter à une queue de retry
      }
    } catch (error: any) {
      this.logger.error(`❌ Erreur création commande CJ:`, error.message);
      // Ne pas bloquer la commande KAMRI
    }

    return order;
  }

  async getOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
            variant: true,
          },
        },
        // ✅ Inclure le mapping CJ pour le suivi
        cjMapping: {
          select: {
            cjOrderId: true,
            cjOrderNumber: true,
            status: true,
            trackNumber: true,
            metadata: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getAllOrders() {
    console.log('📦 [OrdersService] Récupération de TOUTES les commandes (admin)');
    
    const orders = await this.prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                images: true,
                category: true,
                supplier: true,
              },
            },
          },
        },
        cjMapping: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('📦 [OrdersService] Total commandes trouvées:', orders.length);
    return {
      data: orders,
      message: 'Toutes les commandes récupérées avec succès',
    };
  }

  async getUserOrders(userId: string) {
    console.log('📦 [OrdersService] Récupération des commandes pour userId:', userId);
    
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
                category: true,
                supplier: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('📦 [OrdersService] Commandes trouvées:', orders.length);
    return {
      data: orders,
      message: 'Commandes récupérées avec succès',
    };
  }

  async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            addresses: {
              where: {
                isDefault: true,
              },
              take: 1,
            },
          },
        },
        items: {
          include: {
            product: {
              include: {
                images: true,
                supplier: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    // Type guard pour vérifier que user et items sont bien présents
    if (!order.user || !order.items) {
      return null;
    }

    // Type assertion pour indiquer à TypeScript que user et items sont présents
    const orderWithIncludes = order as typeof order & {
      user: NonNullable<typeof order.user>;
      items: NonNullable<typeof order.items>;
    };

    // Transformer les données pour correspondre à l'interface frontend
    const shippingAddress = orderWithIncludes.user.addresses && orderWithIncludes.user.addresses.length > 0
      ? {
          firstName: orderWithIncludes.user.firstName || '',
          lastName: orderWithIncludes.user.lastName || '',
          street: orderWithIncludes.user.addresses[0].street,
          complement: '',
          city: orderWithIncludes.user.addresses[0].city,
          state: orderWithIncludes.user.addresses[0].state,
          postalCode: orderWithIncludes.user.addresses[0].zipCode,
          country: orderWithIncludes.user.addresses[0].country,
          phone: orderWithIncludes.user.phone || '',
        }
      : null;

    return {
      id: order.id,
      userId: order.userId,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      user: {
        id: orderWithIncludes.user.id,
        name: orderWithIncludes.user.name || `${orderWithIncludes.user.firstName || ''} ${orderWithIncludes.user.lastName || ''}`.trim(),
        email: orderWithIncludes.user.email,
        firstName: orderWithIncludes.user.firstName,
        lastName: orderWithIncludes.user.lastName,
        phone: orderWithIncludes.user.phone,
      },
      items: orderWithIncludes.items.map(item => ({
        id: item.id,
        product: {
          id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          image: item.product.images && item.product.images.length > 0 
            ? item.product.images[0].url 
            : item.product.image || null,
          supplier: item.product.supplier ? {
            name: item.product.supplier.name,
          } : null,
        },
        quantity: item.quantity,
        price: item.price,
      })),
      shippingAddress,
    };
  }
}

