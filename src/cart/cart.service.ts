import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    return this.prisma.cartItem.findMany({
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
  }

  async addToCart(
    userId: string,
    productId: string,
    quantity: number = 1,
    variantId?: string,
    variantDetails?: any,
  ) {
    // Chercher un item existant avec le même productId et variantId (ou sans variantId)
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        variantId: variantId || null,
      },
    });

    if (existingItem) {
      // Mettre à jour la quantité et les détails du variant
      return this.prisma.cartItem.update({
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
    } else {
      // Créer un nouvel item
      return this.prisma.cartItem.create({
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

