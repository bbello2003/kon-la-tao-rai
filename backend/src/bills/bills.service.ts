import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddParticipantDto } from './dto/add-participant.dto';
import { CreateBillDto } from './dto/create-bill.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createExpense(userId: string, billId: string, dto: CreateExpenseDto) {
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

    if (bill.participants.length === 0) {
      throw new BadRequestException('Bill must have at least one participant');
    }

    const payer = bill.participants.find(
      (participant) => participant.id === dto.paidByParticipantId,
    );

    if (!payer) {
      throw new BadRequestException('Payer is not a participant of this bill');
    }

    return this.prisma.expense.create({
      data: {
        billId,
        paidByParticipantId: dto.paidByParticipantId,
        description: dto.description,
        amountSatang: dto.amountSatang,
        category: dto.category,
        spentAt: new Date(),

        participants: {
          create: bill.participants.map((participant) => ({
            participantId: participant.id,
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
