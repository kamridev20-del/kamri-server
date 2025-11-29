import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import { CartGroupingService } from './cart-grouping.service';

@ApiTags('cart')
@Controller('api/cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly cartGroupingService: CartGroupingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user cart' })
  getCart(@GetUser() user: any) {
    return this.cartService.getCart(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add item to cart' })
  addToCart(
    @GetUser() user: any,
    @Body('productId') productId: string,
    @Body('quantity') quantity: number = 1,
    @Body('variantId') variantId?: string,
    @Body('variantDetails') variantDetails?: any,
  ) {
    return this.cartService.addToCart(
      user.userId,
      productId,
      quantity,
      variantId,
      variantDetails,
    );
  }

  @Delete(':itemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  removeFromCart(
    @GetUser() user: any,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeFromCart(user.userId, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear user cart' })
  clearCart(@GetUser() user: any) {
    return this.cartService.clearCart(user.userId);
  }

  @Get('grouped')
  @ApiOperation({ summary: 'Get cart grouped by origin country with shipping costs' })
  @ApiQuery({ name: 'countryCode', required: true, description: 'Destination country code' })
  async getGroupedCart(
    @GetUser() user: any,
    @Query('countryCode') countryCode: string,
  ) {
    const cartItems = await this.cartService.getCart(user.userId);
    return this.cartGroupingService.groupCartByOrigin(cartItems, countryCode);
  }
}

