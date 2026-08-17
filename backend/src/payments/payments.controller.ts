import {
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';

@Controller('pay')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get(':token')
  getPaymentPage(
    @Param('token') token: string,
  ) {
    return this.paymentsService.getPaymentPage(token);
  }

  @Post(':token/mark-paid')
  markPaid(
    @Param('token') token: string,
  ) {
    return this.paymentsService.markPaid(token);
  }
}