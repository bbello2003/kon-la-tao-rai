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
}
