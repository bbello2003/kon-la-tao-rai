import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentPage(shareToken: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: {
        shareToken,
      },
      include: {
        bill: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!settlement) {
      throw new NotFoundException('Payment link not found');
    }

    const payer = await this.prisma.billParticipant.findUnique({
      where: {
        id: settlement.fromParticipantId,
      },
    });

    const recipient = await this.prisma.billParticipant.findUnique({
      where: {
        id: settlement.toParticipantId,
      },
      include: {
        paymentInfo: true,
      },
    });

    if (!payer || !recipient) {
      throw new NotFoundException('Payment information not found');
    }

    return {
      bill: settlement.bill,

      payment: {
        from: {
          id: payer.id,
          name: payer.name,
        },

        to: {
          id: recipient.id,
          name: recipient.name,
        },

        amountSatang: settlement.amountSatang,
        amountBaht: (settlement.amountSatang / 100).toFixed(2),

        status: settlement.status,
        paidAt: settlement.paidAt,
      },

      paymentInfo: recipient.paymentInfo
        ? {
            method: recipient.paymentInfo.method,
            promptPayId: recipient.paymentInfo.promptPayId,
            bankName: recipient.paymentInfo.bankName,
            accountName: recipient.paymentInfo.accountName,
            accountNumber: recipient.paymentInfo.accountNumber,
          }
        : null,
    };
  }

  async markPaid(shareToken: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: {
        shareToken,
      },
    });

    if (!settlement) {
      throw new NotFoundException('Payment link not found');
    }

    if (settlement.status === 'PAID') {
      throw new ConflictException(
        'This payment has already been marked as paid',
      );
    }

    return this.prisma.settlement.update({
      where: {
        id: settlement.id,
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });
  }

  async getQrCode(shareToken: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: {
        shareToken,
      },
    });

    if (!settlement) {
      throw new NotFoundException('Payment link not found');
    }

    const recipient = await this.prisma.billParticipant.findUnique({
      where: {
        id: settlement.toParticipantId,
      },
      include: {
        paymentInfo: true,
      },
    });

    if (!recipient) {
      throw new NotFoundException('Payment recipient not found');
    }

    if (!recipient.paymentInfo) {
      throw new NotFoundException('Payment information not found');
    }

    if (
      recipient.paymentInfo.method !== 'PROMPTPAY' ||
      !recipient.paymentInfo.promptPayId
    ) {
      throw new BadRequestException(
        'PromptPay payment method is not configured',
      );
    }

    const amount = settlement.amountSatang / 100;

    const payload = generatePayload(recipient.paymentInfo.promptPayId, {
      amount,
    });

    const qrDataUrl = await QRCode.toDataURL(payload);

    return {
      amountSatang: settlement.amountSatang,
      amountBaht: amount.toFixed(2),
      promptPayId: recipient.paymentInfo.promptPayId,
      qrCode: qrDataUrl,
    };
  }
}
