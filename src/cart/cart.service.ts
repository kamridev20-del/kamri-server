import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: true,
            category: true,
            productVariants: true, // ✅ Inclure les variants pour le calcul de fret
          },
        },
        variant: true, // ✅ Inclure le variant choisi
      },
    });
    
    // Logs pour debug
    console.log('🛒 [CartService] getCart - Nombre d\'articles:', cartItems.length);
    cartItems.forEach((item, index) => {
      console.log(`🛒 [CartService] Article ${index + 1}:`, {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        variantId: item.variantId,
        variantDetails: item.variantDetails,
        variantDetailsType: typeof item.variantDetails,
        hasVariantDetails: !!item.variantDetails,
        variantDetailsKeys: item.variantDetails ? Object.keys(item.variantDetails as any) : []
      });
    });
    
    return cartItems;
  }

  async addToCart(
    userId: string,
    productId: string,
    quantity: number = 1,
    variantId?: string,
    variantDetails?: any,
  ) {
    console.log('🛒 [CartService] addToCart appelé:', {
      userId,
      productId,
      quantity,
      variantId,
      variantDetails,
      variantDetailsType: typeof variantDetails,
      variantDetailsKeys: variantDetails ? Object.keys(variantDetails) : [],
      variantDetailsStringified: variantDetails ? JSON.stringify(variantDetails) : 'null'
    });
    
    // Chercher un item existant avec le même productId et variantId (ou sans variantId)
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        variantId: variantId || null,
      },
    });

    console.log('🛒 [CartService] Item existant trouvé:', {
      exists: !!existingItem,
      existingItemId: existingItem?.id,
      existingVariantDetails: existingItem?.variantDetails
    });

    if (existingItem) {
      // Mettre à jour la quantité et les détails du variant
      const updated = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: {
            increment: quantity,
          },
          variantDetails: variantDetails || existingItem.variantDetails,
        },
        include: {
          product: {
            include: {
              images: true,
              category: true,
            },
          },
          variant: true, // ✅ Inclure le variant choisi
        },
      });
      
      console.log('✅ [CartService] Item mis à jour:', {
        id: updated.id,
        variantDetails: updated.variantDetails,
        variantDetailsType: typeof updated.variantDetails
      });
      
      return updated;
    } else {
      // Créer un nouvel item
      const created = await this.prisma.cartItem.create({
        data: {
          userId,
          productId,
          variantId: variantId || null,
          variantDetails: variantDetails || null,
          quantity,
        },
        include: {
          product: {
            include: {
              images: true,
              category: true,
            },
          },
          variant: true, // ✅ Inclure le variant choisi
        },
      });
      
      console.log('✅ [CartService] Nouvel item créé:', {
        id: created.id,
        variantDetails: created.variantDetails,
        variantDetailsType: typeof created.variantDetails
      });
      
      return created;
    }
  }

  async removeFromCart(userId: string, itemId: string) {
    return this.prisma.cartItem.delete({
      where: { id: itemId },
    });
  }

  async clearCart(userId: string) {
    return this.prisma.cartItem.deleteMany({
      where: { userId },
    });
  }
}

