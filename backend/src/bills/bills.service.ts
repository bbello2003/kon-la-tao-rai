import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AddParticipantDto } from './dto/add-participant.dto';
import { CreateBillDto } from './dto/create-bill.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Decimal } from 'decimal.js';

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

  // Create Expense
  async createExpense(userId: string, billId: string, dto: CreateExpenseDto) {
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
    if (dto.participantIds.length === 0) {
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

    // 8. Create the Expense
    return this.prisma.expense.create({
      data: {
        billId,
        paidByParticipantId: dto.paidByParticipantId,
        description: dto.description,
        amountSatang: dto.amountSatang,
        category: dto.category,
        spentAt: new Date(),

        participants: {
          create: uniqueParticipantIds.map((participantId) => ({
            participantId,
          })),
        },
      },

      include: {
        paidBy: true,

        participants: {
          include: {
            participant: true,
          },
        },
      },
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

    // ----------------------------------------
    // 1. Create balance for every participant
    // ----------------------------------------

    const balances = new Map<string, Decimal>();

    for (const participant of bill.participants) {
      balances.set(participant.id, new Decimal(0));
    }

    // ----------------------------------------
    // 2. Calculate net balance from every expense
    //
    // Positive = should receive money
    // Negative = owes money
    // ----------------------------------------

    for (const expense of bill.expenses) {
      const participantCount = expense.participants.length;

      if (participantCount === 0) {
        continue;
      }

      const share = new Decimal(expense.amountSatang).div(participantCount);

      // Person who paid gets credit
      const payerBalance =
        balances.get(expense.paidByParticipantId) ?? new Decimal(0);

      balances.set(
        expense.paidByParticipantId,
        payerBalance.plus(expense.amountSatang),
      );

      // Every participant gets a debit
      for (const expenseParticipant of expense.participants) {
        const participantBalance =
          balances.get(expenseParticipant.participantId) ?? new Decimal(0);

        balances.set(
          expenseParticipant.participantId,
          participantBalance.minus(share),
        );
      }
    }

    // ----------------------------------------
    // 3. Round each final balance to 1 satang
    // ----------------------------------------

    const roundedBalances = [...balances.entries()].map(
      ([participantId, balance]) => ({
        participantId,
        balance: balance.toDecimalPlaces(0),
      }),
    );

    // ----------------------------------------
    // 4. Split people into debtors and creditors
    // ----------------------------------------

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

    // ----------------------------------------
    // 5. Fix rounding difference
    // ----------------------------------------

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

    // ----------------------------------------
    // 6. Simplify transactions
    // ----------------------------------------

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

    // ----------------------------------------
    // 7. Add participant names
    // ----------------------------------------

    const participantMap = new Map(
      bill.participants.map((participant) => [
        participant.id,
        participant.name,
      ]),
    );

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
}
