import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddParticipantDto } from './dto/add-participant.dto';
import { CreateBillDto } from './dto/create-bill.dto';

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBillDto) {
    return this.prisma.bill.create({
      data: {
        name: dto.name,
        ownerId: userId,
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
}
