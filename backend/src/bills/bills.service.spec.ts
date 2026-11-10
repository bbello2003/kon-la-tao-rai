import { Test, TestingModule } from '@nestjs/testing';
import { BillsService } from './bills.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BillsService', () => {
  let service: BillsService;
  let mockTx: {
    paymentInfo: { deleteMany: jest.Mock };
    settlement: { deleteMany: jest.Mock };
    expenseParticipant: { deleteMany: jest.Mock; findMany: jest.Mock };
    expense: { delete: jest.Mock };
    billParticipant: { delete: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    bill: { findFirst: jest.Mock };
    billParticipant: { findFirst: jest.Mock; delete: jest.Mock };
    settlement: { deleteMany: jest.Mock };
    expense: { findMany: jest.Mock; delete: jest.Mock };
    expenseParticipant: { deleteMany: jest.Mock; delete: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    paymentInfo: { deleteMany: jest.Mock };
  };

  beforeEach(async () => {
    mockTx = {
      paymentInfo: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      settlement: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      expenseParticipant: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      expense: { delete: jest.fn().mockResolvedValue({ id: 'exp-2' }) },
      billParticipant: { delete: jest.fn().mockResolvedValue({ id: 'member-1' }) },
    };

    prisma = {
      $transaction: jest.fn(async (callback) => callback(mockTx)),
      bill: { findFirst: jest.fn() },
      billParticipant: { findFirst: jest.fn(), delete: jest.fn() },
      settlement: { deleteMany: jest.fn() },
      expense: { findMany: jest.fn(), delete: jest.fn() },
      expenseParticipant: {
        deleteMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      paymentInfo: { deleteMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<BillsService>(BillsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should remove a participant from linked expenses and delete the participant', async () => {
    prisma.bill.findFirst.mockResolvedValue({
      id: 'bill-1',
      ownerId: 'user-1',
      participants: [{ id: 'member-1', name: 'A' }],
    });

    prisma.expense.findMany.mockResolvedValue([
      {
        id: 'exp-1',
        billId: 'bill-1',
        amountSatang: 1000,
        paidByParticipantId: 'member-2',
        participants: [
          { id: 'share-1', participantId: 'member-1', amountSatang: 400 },
          { id: 'share-2', participantId: 'member-2', amountSatang: 600 },
        ],
      },
      {
        id: 'exp-2',
        billId: 'bill-1',
        amountSatang: 500,
        paidByParticipantId: 'member-1',
        participants: [
          { id: 'share-3', participantId: 'member-1', amountSatang: 500 },
        ],
      },
    ]);

    await service.removeParticipant('user-1', 'bill-1', 'member-1');

    expect(mockTx.paymentInfo.deleteMany).toHaveBeenCalledWith({
      where: { participantId: 'member-1' },
    });
    expect(mockTx.settlement.deleteMany).toHaveBeenCalled();
    expect(mockTx.expense.delete).toHaveBeenCalledWith({
      where: { id: 'exp-2' },
    });
    expect(mockTx.billParticipant.delete).toHaveBeenCalledWith({
      where: { id: 'member-1' },
    });
  });
});
