import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@Controller('api/wishlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get user wishlist' })
  getWishlist(@GetUser() user: any) {
    console.log('🔍 [WishlistController] getWishlist appelé avec user:', user);
    return this.wishlistService.getWishlist(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add item to wishlist' })
  addToWishlist(
    @GetUser() user: any,
    @Body('productId') productId: string,
  ) {
    console.log('🔥 [WishlistController] addToWishlist appelé avec user:', user, 'productId:', productId);
    return this.wishlistService.addToWishlist(user.userId, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove item from wishlist' })
  removeFromWishlist(
    @GetUser() user: any,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.removeFromWishlist(user.userId, productId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear user wishlist' })
  clearWishlist(@GetUser() user: any) {
    return this.wishlistService.clearWishlist(user.userId);
  }
}
