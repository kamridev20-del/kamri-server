import { Body, Controller, Get, Headers, Param, Post, RawBody } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @ApiOperation({ summary: 'Create payment intent' })
  createPaymentIntent(
    @Body() body: { amount: number; currency?: string },
  ) {
    return this.paymentsService.createPaymentIntent(
      body.amount,
      body.currency,
    );
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Handle Stripe webhook' })
  async handleWebhook(
    @RawBody() payload: Buffer,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(payload.toString(), signature);
  }

  @Post('refund')
  @ApiOperation({ summary: 'Create a refund' })
  createRefund(
    @Body() body: { paymentIntentId: string; amount?: number; reason?: string },
  ) {
    return this.paymentsService.createRefund(
      body.paymentIntentId,
      body.amount,
      body.reason,
    );
  }

  @Get('refunds/:paymentIntentId')
  @ApiOperation({ summary: 'Get refunds for a payment intent' })
  getRefunds(@Param('paymentIntentId') paymentIntentId: string) {
    return this.paymentsService.getRefunds(paymentIntentId);
  }

  @Post('refund/:refundId/cancel')
  @ApiOperation({ summary: 'Cancel a refund (if possible)' })
  cancelRefund(@Param('refundId') refundId: string) {
    return this.paymentsService.cancelRefund(refundId);
  }

  @Post('confirm-intent')
  @ApiOperation({ summary: 'Confirm a payment intent (for mobile - requires PaymentSheet integration)' })
  async confirmPaymentIntent(
    @Body() body: { paymentIntentId: string },
  ) {
    // ⚠️ NOTE: Cette méthode est une solution temporaire
    // Pour une vraie intégration mobile, utilisez Stripe PaymentSheet (@stripe/stripe-react-native)
    // qui permet à l'utilisateur d'entrer ses informations de carte de manière sécurisée
    return this.paymentsService.confirmPaymentIntent(body.paymentIntentId);
  }
}

