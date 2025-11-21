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
      },
    });
  }

  async addToCart(userId: string, productId: string, quantity: number = 1) {
    return this.prisma.cartItem.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      create: {
        userId,
        productId,
        quantity,
      },
      include: {
        product: {
          include: {
            images: true,
            category: true,
          },
        },
      },
    });
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

