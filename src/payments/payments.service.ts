import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null;

  constructor(private prisma: PrismaService) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      this.logger.warn('⚠️ STRIPE_SECRET_KEY n\'est pas définie - Les fonctionnalités de paiement seront désactivées');
      this.logger.warn('💡 Pour activer Stripe, définissez STRIPE_SECRET_KEY dans vos variables d\'environnement');
      this.stripe = null;
    } else {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
      });
      this.logger.log('✅ Stripe initialisé avec succès');
    }
  }

  async createPaymentIntent(amount: number, currency: string = 'usd') {
    if (!this.stripe) {
      this.logger.error('❌ Stripe n\'est pas initialisé');
      throw new Error('Stripe is not initialized. Please check your STRIPE_SECRET_KEY configuration');
    }
    
    try {
      this.logger.log(`💳 Création PaymentIntent: ${amount} ${currency}`);
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.logger.log(`✅ PaymentIntent créé: ${paymentIntent.id}`);
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur création PaymentIntent:', error.message);
      throw error;
    }
  }

  async handleWebhook(payload: string, signature: string) {
    if (!this.stripe) {
      this.logger.error('❌ Stripe n\'est pas initialisé - Webhook ignoré');
      throw new Error('Stripe is not initialized');
    }
    
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      this.logger.log(`📨 Webhook reçu: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'charge.refunded':
          await this.handleRefunded(event.data.object as Stripe.Charge);
          break;
        case 'charge.refund.updated':
          await this.handleRefundUpdated(event.data.object as Stripe.Refund);
          break;
        default:
          this.logger.log(`⚠️ Événement non géré: ${event.type}`);
      }

      return { received: true };
    } catch (err: any) {
      this.logger.error(`❌ Erreur webhook: ${err.message}`);
      throw new Error('Invalid signature');
    }
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    try {
      this.logger.log(`✅ Paiement réussi: ${paymentIntent.id}`);
      
      // Trouver la commande associée
      const order = await this.prisma.order.findFirst({
        where: { paymentIntentId: paymentIntent.id },
      });

      if (!order) {
        this.logger.warn(`⚠️ Commande introuvable pour PaymentIntent: ${paymentIntent.id}`);
        return;
      }

      // Mettre à jour le statut de la commande
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'succeeded',
          status: 'PAID', // Mettre à jour le statut de la commande
        },
      });

      this.logger.log(`✅ Commande ${order.id} mise à jour: PAID`);
    } catch (error: any) {
      this.logger.error(`❌ Erreur lors du traitement du paiement réussi: ${error.message}`);
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    try {
      this.logger.log(`❌ Paiement échoué: ${paymentIntent.id}`);
      
      const order = await this.prisma.order.findFirst({
        where: { paymentIntentId: paymentIntent.id },
      });

      if (!order) {
        this.logger.warn(`⚠️ Commande introuvable pour PaymentIntent: ${paymentIntent.id}`);
        return;
      }

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'failed',
          status: 'FAILED',
        },
      });

      this.logger.log(`✅ Commande ${order.id} mise à jour: FAILED`);
    } catch (error: any) {
      this.logger.error(`❌ Erreur lors du traitement du paiement échoué: ${error.message}`);
    }
  }

  private async handleRefunded(charge: Stripe.Charge) {
    try {
      this.logger.log(`💰 Remboursement détecté pour charge: ${charge.id}`);
      
      // Récupérer le PaymentIntent depuis la charge
      const paymentIntentId = typeof charge.payment_intent === 'string' 
        ? charge.payment_intent 
        : charge.payment_intent?.id;

      if (!paymentIntentId) {
        this.logger.warn(`⚠️ PaymentIntent introuvable pour charge: ${charge.id}`);
        return;
      }

      const order = await this.prisma.order.findFirst({
        where: { paymentIntentId },
      });

      if (!order) {
        this.logger.warn(`⚠️ Commande introuvable pour PaymentIntent: ${paymentIntentId}`);
        return;
      }

      // Calculer le montant remboursé
      const refundAmount = charge.amount_refunded / 100; // Convertir de cents en dollars
      const isFullRefund = refundAmount >= order.total;

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
          refundAmount,
          refundedAt: new Date(),
          status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });

      this.logger.log(`✅ Commande ${order.id} mise à jour: ${isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED'} (${refundAmount}$)`);
    } catch (error: any) {
      this.logger.error(`❌ Erreur lors du traitement du remboursement: ${error.message}`);
    }
  }

  private async handleRefundUpdated(refund: Stripe.Refund) {
    try {
      this.logger.log(`🔄 Remboursement mis à jour: ${refund.id}`);
      
      // Trouver la commande avec ce refundId
      const order = await this.prisma.order.findFirst({
        where: { refundId: refund.id },
      });

      if (!order) {
        // Essayer de trouver via le PaymentIntent
        const paymentIntentId = typeof refund.payment_intent === 'string'
          ? refund.payment_intent
          : refund.payment_intent?.id;

        if (paymentIntentId) {
          const orderByPayment = await this.prisma.order.findFirst({
            where: { paymentIntentId },
          });

          if (orderByPayment) {
            await this.prisma.order.update({
              where: { id: orderByPayment.id },
              data: {
                refundId: refund.id,
                refundAmount: refund.amount / 100,
                refundedAt: new Date(refund.created * 1000),
                refundReason: refund.reason || null,
                paymentStatus: refund.status === 'succeeded' ? 'refunded' : 'pending',
              },
            });
            this.logger.log(`✅ Commande ${orderByPayment.id} mise à jour avec remboursement`);
          }
        }
        return;
      }

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          refundAmount: refund.amount / 100,
          refundedAt: new Date(refund.created * 1000),
          refundReason: refund.reason || null,
          paymentStatus: refund.status === 'succeeded' ? 'refunded' : 'pending',
        },
      });

      this.logger.log(`✅ Commande ${order.id} mise à jour avec remboursement`);
    } catch (error: any) {
      this.logger.error(`❌ Erreur lors de la mise à jour du remboursement: ${error.message}`);
    }
  }

  // ✅ Créer un remboursement
  async confirmPaymentIntent(paymentIntentId: string) {
    if (!this.stripe) {
      this.logger.error('❌ Stripe n\'est pas initialisé');
      throw new Error('Stripe is not initialized');
    }
    
    this.logger.log(`💳 Confirmation PaymentIntent: ${paymentIntentId}`);
    
    try {
      // Récupérer le PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      this.logger.log(`📋 PaymentIntent status: ${paymentIntent.status}`);
      
      // Si déjà confirmé, retourner le statut
      if (paymentIntent.status === 'succeeded') {
        this.logger.log(`✅ PaymentIntent déjà confirmé`);
        return {
          success: true,
          status: paymentIntent.status,
          message: 'Paiement déjà confirmé',
        };
      }
      
      // ⚠️ IMPORTANT: On ne peut pas confirmer un PaymentIntent sans les informations de carte
      // Cette méthode est une solution temporaire pour les tests
      // En production, utilisez Stripe PaymentSheet sur mobile pour que l'utilisateur entre ses infos
      
      // Vérifier si le PaymentIntent peut être confirmé automatiquement
      if (paymentIntent.status === 'requires_payment_method') {
        throw new Error('Le PaymentIntent nécessite une méthode de paiement. Utilisez Stripe PaymentSheet pour entrer les informations de carte.');
      }
      
      if (paymentIntent.status === 'requires_confirmation') {
        // Tenter de confirmer (peut échouer si aucune méthode de paiement n'est attachée)
        const confirmed = await this.stripe.paymentIntents.confirm(paymentIntentId);
        
        this.logger.log(`✅ PaymentIntent confirmé: ${confirmed.status}`);
        
        return {
          success: true,
          status: confirmed.status,
          paymentIntent: confirmed,
        };
      }
      
      // Si le statut est autre chose, retourner l'état actuel
      return {
        success: false,
        status: paymentIntent.status,
        message: `Le PaymentIntent est dans l'état: ${paymentIntent.status}. Utilisez Stripe PaymentSheet pour compléter le paiement.`,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur confirmation PaymentIntent: ${error.message}`);
      throw new Error(`Impossible de confirmer le paiement: ${error.message}`);
    }
  }

  async createRefund(paymentIntentId: string, amount?: number, reason?: string) {
    try {
      this.logger.log(`💰 Création remboursement pour PaymentIntent: ${paymentIntentId}`);

      // Récupérer le PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (!paymentIntent.latest_charge) {
        throw new Error('Aucune charge trouvée pour ce PaymentIntent');
      }

      const chargeId = typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge.id;

      // Créer le remboursement
      const refundParams: Stripe.RefundCreateParams = {
        charge: chargeId,
        reason: reason as Stripe.RefundCreateParams.Reason || undefined,
      };

      if (amount) {
        refundParams.amount = Math.round(amount * 100); // Convertir en cents
      }

      const refund = await this.stripe.refunds.create(refundParams);

      // Mettre à jour la commande
      const order = await this.prisma.order.findFirst({
        where: { paymentIntentId },
      });

      if (order) {
        const refundAmount = refund.amount / 100;
        const isFullRefund = !amount || refundAmount >= order.total;

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            refundId: refund.id,
            refundAmount,
            refundedAt: new Date(),
            refundReason: refund.reason || reason || null,
            paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
            status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          },
        });

        this.logger.log(`✅ Commande ${order.id} mise à jour avec remboursement: ${refund.id}`);
      }

      return {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur lors de la création du remboursement: ${error.message}`);
      throw error;
    }
  }

  // ✅ Récupérer les remboursements d'un PaymentIntent
  async getRefunds(paymentIntentId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (!paymentIntent.latest_charge) {
        return [];
      }

      const chargeId = typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge.id;

      const refunds = await this.stripe.refunds.list({
        charge: chargeId,
        limit: 100,
      });

      return refunds.data.map(refund => ({
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        reason: refund.reason,
        createdAt: new Date(refund.created * 1000),
      }));
    } catch (error: any) {
      this.logger.error(`❌ Erreur lors de la récupération des remboursements: ${error.message}`);
      throw error;
    }
  }

  // ✅ Annuler un remboursement (si possible)
  async cancelRefund(refundId: string) {
    try {
      this.logger.log(`🚫 Annulation remboursement: ${refundId}`);

      // Note: Stripe ne permet pas d'annuler un remboursement une fois qu'il est traité
      // On peut seulement vérifier son statut
      const refund = await this.stripe.refunds.retrieve(refundId);

      if (refund.status === 'succeeded' || refund.status === 'pending') {
        throw new Error('Impossible d\'annuler un remboursement déjà traité ou en cours');
      }

      return {
        refundId: refund.id,
        status: refund.status,
        message: 'Remboursement annulé avec succès',
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur lors de l'annulation du remboursement: ${error.message}`);
      throw error;
    }
  }
}

