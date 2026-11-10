import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from 'decimal.js';
import { randomBytes } from 'crypto';

import { AddParticipantDto } from './dto/add-participant.dto';
import { CreateBillDto } from './dto/create-bill.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreatePaymentInfoDto } from './dto/create-payment-info.dto';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  // Create Bill
  async create(userId: string, dto: CreateBillDto) {
    const owner = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!owner) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.bill.create({
      data: {
        name: dto.name,
        ownerId: userId,

        // Bill owner is automatically a participant
        participants: {
          create: {
            name: owner.name,
          },
        },
      },

      include: {
        participants: true,
      },
    });
  }

  // Get Bills owned by current user
  async findAll(userId: string) {
    return this.prisma.bill.findMany({
      where: {
        ownerId: userId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Get one Bill
  async findOne(userId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return bill;
  }

  // Add Participant
  async addParticipant(userId: string, billId: string, dto: AddParticipantDto) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return this.prisma.billParticipant.create({
      data: {
        billId,
        name: dto.name,
      },
    });
  }

  // Get Participants
  async findParticipants(userId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return this.prisma.billParticipant.findMany({
      where: {
        billId,
      },

      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async updateParticipant(
    userId: string,
    billId: string,
    participantId: string,
    dto: { name: string },
  ) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const participant = await this.prisma.billParticipant.findFirst({
      where: {
        id: participantId,
        billId,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const trimmedName = dto.name?.trim();

    if (!trimmedName) {
      throw new BadRequestException('Participant name is required');
    }

    return this.prisma.billParticipant.update({
      where: {
        id: participantId,
      },
      data: {
        name: trimmedName,
      },
    });
  }

  async removeParticipant(userId: string, billId: string, participantId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
      include: {
        participants: true,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const participant = bill.participants.find((item) => item.id === participantId);

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const relatedExpenses = await this.prisma.expense.findMany({
      where: {
        billId,
        OR: [
          { paidByParticipantId: participantId },
          { participants: { some: { participantId } } },
        ],
      },
      include: {
        participants: true,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentInfo.deleteMany({
        where: {
          participantId,
        },
      });

      await tx.settlement.deleteMany({
        where: {
          billId,
          status: 'PENDING',
        },
      });

      for (const expense of relatedExpenses) {
        const remainingShares = expense.participants.filter(
          (share) => share.participantId !== participantId,
        );
        const hasShare = remainingShares.length !== expense.participants.length;

        if (
          expense.paidByParticipantId === participantId ||
          remainingShares.length === 0
        ) {
          await tx.expense.delete({
            where: { id: expense.id },
          });
          continue;
        }

        if (!hasShare) {
          continue;
        }

        await tx.expenseParticipant.deleteMany({
          where: {
            expenseId: expense.id,
            participantId,
          },
        });

        const redistributedShares = this.redistributeExpenseAmount(
          expense.amountSatang,
          remainingShares,
          expense.splitMode,
        );

        for (const share of redistributedShares) {
          await tx.expenseParticipant.update({
            where: { id: share.id },
            data: { amountSatang: share.amountSatang },
          });
        }
      }

      await tx.billParticipant.delete({
        where: {
          id: participantId,
        },
      });
    });

    return { success: true };
  }

  private redistributeExpenseAmount(
    totalAmount: number,
    shares: {
      id: string;
      participantId: string;
      amountSatang: number;
    }[],
    splitMode: 'EQUAL' | 'CUSTOM',
  ) {
    if (splitMode === 'EQUAL') {
      const baseAmount = Math.floor(totalAmount / shares.length);
      let remainder = totalAmount - baseAmount * shares.length;

      return shares.map((share) => {
        const amountSatang = baseAmount + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
        return { id: share.id, amountSatang };
      });
    }

    const totalWeight = shares.reduce(
      (sum, share) => sum + Math.max(0, share.amountSatang),
      0,
    );

    if (totalWeight === 0) {
      return this.redistributeExpenseAmount(totalAmount, shares, 'EQUAL');
    }

    const allocations = shares.map((share) => {
      const exactAmount = new Decimal(totalAmount)
        .mul(Math.max(0, share.amountSatang))
        .div(totalWeight);
      const amountSatang = exactAmount
        .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
        .toNumber();

      return {
        id: share.id,
        amountSatang,
        fractionalRemainder: exactAmount.minus(amountSatang),
      };
    });

    let remainder =
      totalAmount -
      allocations.reduce((sum, share) => sum + share.amountSatang, 0);

    allocations
      .slice()
      .sort((left, right) =>
        right.fractionalRemainder.comparedTo(left.fractionalRemainder),
      )
      .forEach((share) => {
        if (remainder > 0) {
          const allocation = allocations.find((item) => item.id === share.id);
          if (allocation) {
            allocation.amountSatang += 1;
            remainder -= 1;
          }
        }
      });

    return allocations.map(({ id, amountSatang }) => ({ id, amountSatang }));
  }

  // Create Expense
  async createExpense(userId: string, billId: string, dto: CreateExpenseDto) {
    return this.saveExpense(userId, billId, dto);
  }

  async updateExpense(
    userId: string,
    billId: string,
    expenseId: string,
    dto: CreateExpenseDto,
  ) {
    return this.saveExpense(userId, billId, dto, expenseId);
  }

  private async saveExpense(
    userId: string,
    billId: string,
    dto: CreateExpenseDto,
    expenseId?: string,
  ) {
    // 1. Check that the current user owns this Bill
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
      include: {
        participants: true,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (expenseId) {
      const existingExpense = await this.prisma.expense.findFirst({
        where: {
          id: expenseId,
          billId,
        },
        select: {
          id: true,
        },
      });

      if (!existingExpense) {
        throw new NotFoundException('Expense not found');
      }
    }

    // 2. Bill must have at least one participant
    if (bill.participants.length === 0) {
      throw new BadRequestException('Bill must have at least one participant');
    }

    // 3. Check that the payer belongs to this Bill
    const payer = bill.participants.find(
      (participant) => participant.id === dto.paidByParticipantId,
    );

    if (!payer) {
      throw new BadRequestException('Payer is not a participant of this bill');
    }

    // 4. Check that at least one participant was selected
    if (!dto.participantIds || dto.participantIds.length === 0) {
      throw new BadRequestException('At least one participant is required');
    }

    // 5. Remove duplicate participant IDs
    const uniqueParticipantIds = [...new Set(dto.participantIds)];

    // 6. Find selected participants from this Bill only
    const selectedParticipants = bill.participants.filter((participant) =>
      uniqueParticipantIds.includes(participant.id),
    );

    // 7. Make sure every participant ID belongs to this Bill
    if (selectedParticipants.length !== uniqueParticipantIds.length) {
      throw new BadRequestException(
        'One or more participants do not belong to this bill',
      );
    }

    // 8. Normalize split mode
    const splitMode = dto.splitMode ?? 'EQUAL';

    // 9. Calculate base amount for each participant
    const participantAmounts = new Map<string, number>();

    if (splitMode === 'EQUAL') {
      // Divide equally and distribute any remaining satang
      // to the first participants.
      const baseShare = Math.floor(
        dto.amountSatang / selectedParticipants.length,
      );

      let remainder =
        dto.amountSatang - baseShare * selectedParticipants.length;

      for (const participant of selectedParticipants) {
        const extra = remainder > 0 ? 1 : 0;

        participantAmounts.set(participant.id, baseShare + extra);

        if (remainder > 0) {
          remainder--;
        }
      }
    } else {
      // CUSTOM
      const customAmounts = dto.participantAmounts ?? {};

      let assignedAmount = 0;
      const unspecifiedParticipantIds: string[] = [];

      for (const participant of selectedParticipants) {
        const value = customAmounts[participant.id];

        // null / undefined = calculate later from remaining amount
        if (value === null || value === undefined) {
          unspecifiedParticipantIds.push(participant.id);
          continue;
        }

        // Custom amount must be an integer
        if (!Number.isInteger(value)) {
          throw new BadRequestException(
            `Amount for ${participant.name} must be an integer number of satang`,
          );
        }

        if (value < 0) {
          throw new BadRequestException(
            `Amount for ${participant.name} cannot be negative`,
          );
        }

        assignedAmount += value;

        if (assignedAmount > dto.amountSatang) {
          throw new BadRequestException(
            'Custom participant amounts exceed the total expense amount',
          );
        }

        participantAmounts.set(participant.id, value);
      }

      const remainingAmount = dto.amountSatang - assignedAmount;

      // Everyone has a custom amount.
      if (unspecifiedParticipantIds.length === 0) {
        if (remainingAmount !== 0) {
          throw new BadRequestException(
            'Custom participant amounts must equal the total expense amount',
          );
        }
      } else {
        // Divide the remaining amount equally among
        // participants without a custom amount.
        const baseShare = Math.floor(
          remainingAmount / unspecifiedParticipantIds.length,
        );

        let remainder =
          remainingAmount - baseShare * unspecifiedParticipantIds.length;

        for (const participantId of unspecifiedParticipantIds) {
          const extra = remainder > 0 ? 1 : 0;

          participantAmounts.set(participantId, baseShare + extra);

          if (remainder > 0) {
            remainder--;
          }
        }
      }
    }

    // 10. Make sure every selected participant received an amount
    const totalAssigned = selectedParticipants.reduce(
      (sum, participant) => sum + (participantAmounts.get(participant.id) ?? 0),
      0,
    );

    if (totalAssigned !== dto.amountSatang) {
      throw new BadRequestException(
        'Participant amounts do not match the total expense amount',
      );
    }

    // 11. Normalize fee settings
    const serviceChargePercent = dto.serviceChargePercent ?? 0;
    const serviceChargeMode = dto.serviceChargeMode ?? 'EQUAL';

    const vatPercent = dto.vatPercent ?? 0;
    const vatMode = dto.vatMode ?? 'EQUAL';

    const data = {
      billId,
      paidByParticipantId: dto.paidByParticipantId,
      description: dto.description,
      amountSatang: dto.amountSatang,
      category: dto.category ?? '',
      spentAt: new Date(),
      splitMode,
      serviceChargePercent,
      serviceChargeMode,
      vatPercent,
      vatMode,
      participants: {
        create: selectedParticipants.map((participant) => ({
          participantId: participant.id,
          amountSatang: participantAmounts.get(participant.id) ?? 0,
        })),
      },
    } satisfies Prisma.ExpenseUncheckedCreateInput;

    const include = {
      paidBy: true,
      participants: {
        include: {
          participant: true,
        },
      },
    } as const;

    if (!expenseId) {
      return this.prisma.expense.create({ data, include });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.settlement.deleteMany({
        where: {
          billId,
          status: 'PENDING',
        },
      });

      const updateData = {
        ...data,
        participants: {
          deleteMany: {},
          create: data.participants.create,
        },
      } satisfies Prisma.ExpenseUncheckedUpdateInput;

      return tx.expense.update({
        where: {
          id: expenseId,
        },
        data: updateData,
        include,
      });
    });
  }

  // Get Expenses
  async findExpenses(userId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return this.prisma.expense.findMany({
      where: {
        billId,
      },

      include: {
        paidBy: true,

        participants: {
          include: {
            participant: true,
          },
        },
      },

      orderBy: {
        spentAt: 'desc',
      },
    });
  }

  async deleteExpense(userId: string, billId: string, expenseId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const expense = await this.prisma.expense.findFirst({
      where: {
        id: expenseId,
        billId,
      },
      select: {
        id: true,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.settlement.deleteMany({
        where: {
          billId,
          status: 'PENDING',
        },
      });

      await tx.expense.delete({
        where: {
          id: expenseId,
        },
      });
    });

    return { success: true };
  }

  async getSummary(userId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
      include: {
        participants: true,
        expenses: {
          include: {
            paidBy: true,
            participants: {
              include: {
                participant: true,
              },
            },
          },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    // --------------------------------------------------
    // 1. Create balance for every participant
    // Positive = should receive money
    // Negative = owes money
    // --------------------------------------------------

    const balances = new Map<string, Decimal>();

    for (const participant of bill.participants) {
      balances.set(participant.id, new Decimal(0));
    }

    // --------------------------------------------------
    // Helper:
    // Distribute an amount among participants
    // --------------------------------------------------

    function distributeEqual(
      amountSatang: number,
      participantIds: string[],
    ): Map<string, number> {
      const result = new Map<string, number>();

      if (participantIds.length === 0 || amountSatang <= 0) {
        return result;
      }

      const baseShare = Math.floor(amountSatang / participantIds.length);

      let remainder = amountSatang - baseShare * participantIds.length;

      for (const participantId of participantIds) {
        const extra = remainder > 0 ? 1 : 0;

        result.set(participantId, baseShare + extra);

        if (remainder > 0) {
          remainder--;
        }
      }

      return result;
    }

    // --------------------------------------------------
    // 2. Calculate each expense
    // --------------------------------------------------

    for (const expense of bill.expenses) {
      const expenseParticipants = expense.participants;

      if (expenseParticipants.length === 0) {
        continue;
      }

      const participantIds = expenseParticipants.map(
        (item) => item.participantId,
      );

      // ----------------------------------------------
      // Base expense amount for each participant
      // ----------------------------------------------

      const baseAmounts = new Map<string, number>();

      for (const expenseParticipant of expenseParticipants) {
        baseAmounts.set(
          expenseParticipant.participantId,
          expenseParticipant.amountSatang,
        );
      }

      // Make sure base amounts add up to the expense amount.
      const baseAmountTotal = [...baseAmounts.values()].reduce(
        (sum, amount) => sum + amount,
        0,
      );

      if (baseAmountTotal !== expense.amountSatang) {
        throw new BadRequestException(
          `Expense ${expense.id} has invalid participant amounts`,
        );
      }

      // ----------------------------------------------
      // Service Charge
      // ----------------------------------------------

      let serviceChargeTotal = 0;

      if (expense.serviceChargePercent && expense.serviceChargePercent.gt(0)) {
        serviceChargeTotal = new Decimal(expense.amountSatang)
          .mul(expense.serviceChargePercent)
          .div(100)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toNumber();
      }

      let serviceChargeAmounts = new Map<string, number>();

      if (serviceChargeTotal > 0) {
        if (expense.serviceChargeMode === 'EQUAL') {
          serviceChargeAmounts = distributeEqual(
            serviceChargeTotal,
            participantIds,
          );
        } else {
          // PROPORTIONAL
          const totalBase = expense.amountSatang;

          let distributed = 0;

          participantIds.forEach((participantId, index) => {
            const baseAmount = baseAmounts.get(participantId) ?? 0;

            if (index === participantIds.length - 1) {
              const remaining = serviceChargeTotal - distributed;

              serviceChargeAmounts.set(participantId, remaining);

              return;
            }

            const amount = new Decimal(serviceChargeTotal)
              .mul(baseAmount)
              .div(totalBase)
              .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
              .toNumber();

            serviceChargeAmounts.set(participantId, amount);

            distributed += amount;
          });
        }
      }

      // ----------------------------------------------
      // VAT
      //
      // VAT is calculated from:
      // Base Expense + Service Charge
      // ----------------------------------------------

      const vatBase = expense.amountSatang + serviceChargeTotal;

      let vatTotal = 0;

      if (expense.vatPercent && expense.vatPercent.gt(0)) {
        vatTotal = new Decimal(vatBase)
          .mul(expense.vatPercent)
          .div(100)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toNumber();
      }

      let vatAmounts = new Map<string, number>();

      if (vatTotal > 0) {
        if (expense.vatMode === 'EQUAL') {
          vatAmounts = distributeEqual(vatTotal, participantIds);
        } else {
          // PROPORTIONAL
          //
          // Proportion is based on the participant's
          // base expense amount.

          const totalBase = expense.amountSatang;

          let distributed = 0;

          participantIds.forEach((participantId, index) => {
            const baseAmount = baseAmounts.get(participantId) ?? 0;

            if (index === participantIds.length - 1) {
              const remaining = vatTotal - distributed;

              vatAmounts.set(participantId, remaining);

              return;
            }

            const amount = new Decimal(vatTotal)
              .mul(baseAmount)
              .div(totalBase)
              .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
              .toNumber();

            vatAmounts.set(participantId, amount);

            distributed += amount;
          });
        }
      }

      // ----------------------------------------------
      // Calculate final amount per participant
      // ----------------------------------------------

      for (const participantId of participantIds) {
        const baseAmount = baseAmounts.get(participantId) ?? 0;

        const serviceCharge = serviceChargeAmounts.get(participantId) ?? 0;

        const vat = vatAmounts.get(participantId) ?? 0;

        const finalAmount = baseAmount + serviceCharge + vat;

        // Person who paid gets credit for the amount paid.
        if (participantId === expense.paidByParticipantId) {
          const currentBalance = balances.get(participantId) ?? new Decimal(0);

          balances.set(
            participantId,
            currentBalance.plus(
              expense.amountSatang + serviceChargeTotal + vatTotal,
            ),
          );
        }

        // Person responsible for the expense gets debit.
        const currentBalance = balances.get(participantId) ?? new Decimal(0);

        balances.set(participantId, currentBalance.minus(finalAmount));
      }
    }

    // --------------------------------------------------
    // 3. Round balances to satang
    // --------------------------------------------------

    const roundedBalances = [...balances.entries()].map(
      ([participantId, balance]) => ({
        participantId,
        balance: balance.toDecimalPlaces(0),
      }),
    );

    // --------------------------------------------------
    // 4. Debtors / Creditors
    // --------------------------------------------------

    const debtors = roundedBalances
      .filter(({ balance }) => balance.isNegative())
      .map(({ participantId, balance }) => ({
        participantId,
        amountSatang: balance.abs().toNumber(),
      }))
      .sort((a, b) => b.amountSatang - a.amountSatang);

    const creditors = roundedBalances
      .filter(({ balance }) => balance.isPositive())
      .map(({ participantId, balance }) => ({
        participantId,
        amountSatang: balance.toNumber(),
      }))
      .sort((a, b) => b.amountSatang - a.amountSatang);

    // --------------------------------------------------
    // 5. Fix rounding difference
    // --------------------------------------------------

    const totalDebt = debtors.reduce(
      (sum, debtor) => sum + debtor.amountSatang,
      0,
    );

    const totalCredit = creditors.reduce(
      (sum, creditor) => sum + creditor.amountSatang,
      0,
    );

    const roundingDifference = totalCredit - totalDebt;

    if (roundingDifference !== 0 && creditors.length > 0) {
      creditors[0].amountSatang -= roundingDifference;
    }

    // --------------------------------------------------
    // 6. Simplify transactions
    // --------------------------------------------------

    const transactions: {
      fromParticipantId: string;
      toParticipantId: string;
      amountSatang: number;
    }[] = [];

    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];

      const amount = Math.min(debtor.amountSatang, creditor.amountSatang);

      if (amount > 0) {
        transactions.push({
          fromParticipantId: debtor.participantId,
          toParticipantId: creditor.participantId,
          amountSatang: amount,
        });
      }

      debtor.amountSatang -= amount;
      creditor.amountSatang -= amount;

      if (debtor.amountSatang === 0) {
        debtorIndex++;
      }

      if (creditor.amountSatang === 0) {
        creditorIndex++;
      }
    }

    // --------------------------------------------------
    // 7. Participant name map
    // --------------------------------------------------

    const participantMap = new Map(
      bill.participants.map((participant) => [
        participant.id,
        participant.name,
      ]),
    );

    // --------------------------------------------------
    // 8. Return summary
    // --------------------------------------------------

    return {
      bill: {
        id: bill.id,
        name: bill.name,
      },

      balances: roundedBalances.map(({ participantId, balance }) => ({
        participantId,
        name: participantMap.get(participantId),
        amountSatang: balance.toNumber(),
        amountBaht: balance.div(100).toFixed(2),
      })),

      transactions: transactions.map((transaction) => ({
        fromParticipantId: transaction.fromParticipantId,

        from: participantMap.get(transaction.fromParticipantId),

        toParticipantId: transaction.toParticipantId,

        to: participantMap.get(transaction.toParticipantId),

        amountSatang: transaction.amountSatang,

        amountBaht: new Decimal(transaction.amountSatang).div(100).toFixed(2),
      })),
    };
  }

  async createPaymentInfo(
    userId: string,
    billId: string,
    dto: CreatePaymentInfoDto,
  ) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const participant = await this.prisma.billParticipant.findFirst({
      where: {
        id: dto.participantId,
        billId,
      },
    });

    if (!participant) {
      throw new BadRequestException('Participant does not belong to this bill');
    }

    if (dto.method === 'PROMPTPAY') {
      if (!dto.promptPayId) {
        throw new BadRequestException('PromptPay ID is required');
      }

      return this.prisma.paymentInfo.upsert({
        where: {
          participantId: participant.id,
        },
        create: {
          participantId: participant.id,
          method: 'PROMPTPAY',
          promptPayId: dto.promptPayId,
        },
        update: {
          method: 'PROMPTPAY',
          promptPayId: dto.promptPayId,
          bankName: null,
          accountName: null,
          accountNumber: null,
        },
      });
    }

    if (!dto.bankName || !dto.accountName || !dto.accountNumber) {
      throw new BadRequestException(
        'Bank name, account name and account number are required',
      );
    }

    return this.prisma.paymentInfo.upsert({
      where: {
        participantId: participant.id,
      },
      create: {
        participantId: participant.id,
        method: 'BANK_ACCOUNT',
        bankName: dto.bankName,
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
      },
      update: {
        method: 'BANK_ACCOUNT',
        promptPayId: null,
        bankName: dto.bankName,
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
      },
    });
  }

  async getPaymentInfo(userId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return this.prisma.paymentInfo.findMany({
      where: {
        participant: {
          billId,
        },
      },
      include: {
        participant: true,
      },
    });
  }

  async createShareLinks(userId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        ownerId: userId,
      },
      include: {
        participants: {
          include: {
            paymentInfo: true,
          },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const summary = await this.getSummary(userId, billId);

    if (summary.transactions.length === 0) {
      throw new BadRequestException('There are no transactions to pay');
    }

    // Every recipient needs payment information.
    for (const transaction of summary.transactions) {
      const paymentInfo = bill.participants.find(
        (participant) => participant.id === transaction.toParticipantId,
      )?.paymentInfo;

      if (!paymentInfo) {
        throw new BadRequestException(
          `Payment information is missing for ${transaction.to}`,
        );
      }
    }

    // Remove old pending links.
    // Paid settlements are kept.
    await this.prisma.settlement.deleteMany({
      where: {
        billId,
        status: 'PENDING',
      },
    });

    const settlements: Array<{
      id: string;
      fromParticipantId: string;
      toParticipantId: string;
      amountSatang: number;
      shareToken: string;
    }> = [];

    for (const transaction of summary.transactions) {
      const shareToken = randomBytes(32).toString('hex');

      const settlement = await this.prisma.settlement.create({
        data: {
          billId,
          fromParticipantId: transaction.fromParticipantId,
          toParticipantId: transaction.toParticipantId,
          amountSatang: transaction.amountSatang,
          shareToken,
          status: 'PENDING',
        },
      });

      settlements.push(settlement);
    }

    return settlements.map((settlement) => ({
      settlementId: settlement.id,
      fromParticipantId: settlement.fromParticipantId,
      toParticipantId: settlement.toParticipantId,
      amountSatang: settlement.amountSatang,
      amountBaht: (settlement.amountSatang / 100).toFixed(2),
      shareToken: settlement.shareToken,
      sharePath: `/pay/${settlement.shareToken}`,
    }));
  }
}
