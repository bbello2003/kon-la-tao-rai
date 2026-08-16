import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBillDto } from './dto/create-bill.dto';
import { BillsService } from './bills.service';
import { AddParticipantDto } from './dto/add-participant.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Post()
  create(
    @Req() request: Request & { user: AuthUser },
    @Body() dto: CreateBillDto,
  ) {
    return this.billsService.create(request.user.userId, dto);
  }

  @Get()
  findAll(@Req() request: Request & { user: AuthUser }) {
    return this.billsService.findAll(request.user.userId);
  }

  @Get(':id')
  findOne(
    @Req() request: Request & { user: AuthUser },
    @Param('id') billId: string,
  ) {
    return this.billsService.findOne(request.user.userId, billId);
  }

  @Post(':id/participants')
  addParticipant(
    @Req() request: Request & { user: AuthUser },
    @Param('id') billId: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.billsService.addParticipant(request.user.userId, billId, dto);
  }

  @Get(':id/participants')
  findParticipants(
    @Req() request: Request & { user: AuthUser },
    @Param('id') billId: string,
  ) {
    return this.billsService.findParticipants(request.user.userId, billId);
  }

  @Post(':id/expenses')
  createExpense(
    @Req() request: Request & { user: AuthUser },
    @Param('id') billId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.billsService.createExpense(request.user.userId, billId, dto);
  }

  @Get(':id/expenses')
  findExpenses(
    @Req() request: Request & { user: AuthUser },
    @Param('id') billId: string,
  ) {
    return this.billsService.findExpenses(request.user.userId, billId);
  }
}
