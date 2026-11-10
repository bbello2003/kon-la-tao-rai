import { Test, TestingModule } from '@nestjs/testing';
import { BillsService } from './bills.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BillsService', () => {
  let service: BillsService;
  let mockTx: {
    paymentInfo: { deleteMany: jest.Mock };
    settlement: { deleteMany: jest.Mock };
    expenseParticipant: {
      deleteMany: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    expense: { delete: jest.Mock; update: jest.Mock };
    billParticipant: { delete: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    bill: { findFirst: jest.Mock };
    billParticipant: { findFirst: jest.Mock; delete: jest.Mock };
    settlement: { deleteMany: jest.Mock };
    expense: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
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
        update: jest.fn().mockResolvedValue({}),
      },
      expense: {
        delete: jest.fn().mockResolvedValue({ id: 'exp-2' }),
        update: jest.fn().mockResolvedValue({ id: 'expense-1' }),
      },
      billParticipant: { delete: jest.fn().mockResolvedValue({ id: 'member-1' }) },
    };

    prisma = {
      $transaction: jest.fn(async (callback) => callback(mockTx)),
      bill: { findFirst: jest.fn() },
      billParticipant: { findFirst: jest.fn(), delete: jest.fn() },
      settlement: { deleteMany: jest.fn() },
      expense: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
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
        splitMode: 'EQUAL',
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
        splitMode: 'EQUAL',
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
    expect(mockTx.settlement.deleteMany).toHaveBeenCalledWith({
      where: { billId: 'bill-1', status: 'PENDING' },
    });
    expect(mockTx.expenseParticipant.update).toHaveBeenCalledWith({
      where: { id: 'share-2' },
      data: { amountSatang: 1000 },
    });
    expect(mockTx.expense.delete).toHaveBeenCalledWith({
      where: { id: 'exp-2' },
    });
    expect(mockTx.billParticipant.delete).toHaveBeenCalledWith({
      where: { id: 'member-1' },
    });
  });

  it('should preserve custom split proportions when removing a participant', async () => {
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
        splitMode: 'CUSTOM',
        paidByParticipantId: 'member-3',
        participants: [
          { id: 'share-1', participantId: 'member-1', amountSatang: 200 },
          { id: 'share-2', participantId: 'member-2', amountSatang: 300 },
          { id: 'share-3', participantId: 'member-3', amountSatang: 500 },
        ],
      },
    ]);

    await service.removeParticipant('user-1', 'bill-1', 'member-1');

    expect(mockTx.expenseParticipant.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'share-2' },
      data: { amountSatang: 375 },
    });
    expect(mockTx.expenseParticipant.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'share-3' },
      data: { amountSatang: 625 },
    });
    expect(mockTx.expense.delete).not.toHaveBeenCalled();
  });

  it('should update an expense and replace its participant shares', async () => {
    prisma.bill.findFirst.mockResolvedValue({
      id: 'bill-1',
      ownerId: 'user-1',
      participants: [
        { id: 'member-1', name: 'A' },
        { id: 'member-2', name: 'B' },
      ],
    });
    prisma.expense.findFirst.mockResolvedValue({ id: 'expense-1' });
    mockTx.expense.update.mockResolvedValue({ id: 'expense-1' });

    await expect(
      service.updateExpense('user-1', 'bill-1', 'expense-1', {
        description: 'Dinner',
        amountSatang: 1000,
        paidByParticipantId: 'member-1',
        participantIds: ['member-1', 'member-2'],
        splitMode: 'EQUAL',
      }),
    ).resolves.toEqual({ id: 'expense-1' });

    expect(mockTx.settlement.deleteMany).toHaveBeenCalledWith({
      where: { billId: 'bill-1', status: 'PENDING' },
    });
    expect(mockTx.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'expense-1' },
        data: expect.objectContaining({
          description: 'Dinner',
          amountSatang: 1000,
          participants: expect.objectContaining({
            deleteMany: {},
            create: [
              { participantId: 'member-1', amountSatang: 500 },
              { participantId: 'member-2', amountSatang: 500 },
            ],
          }),
        }),
      }),
    );
  });

  it('should delete an expense and invalidate pending settlement links', async () => {
    prisma.bill.findFirst.mockResolvedValue({ id: 'bill-1' });
    prisma.expense.findFirst.mockResolvedValue({ id: 'expense-1' });

    await expect(
      service.deleteExpense('user-1', 'bill-1', 'expense-1'),
    ).resolves.toEqual({ success: true });

    expect(prisma.expense.findFirst).toHaveBeenCalledWith({
      where: { id: 'expense-1', billId: 'bill-1' },
      select: { id: true },
    });
    expect(mockTx.settlement.deleteMany).toHaveBeenCalledWith({
      where: { billId: 'bill-1', status: 'PENDING' },
    });
    expect(mockTx.expense.delete).toHaveBeenCalledWith({
      where: { id: 'expense-1' },
    });
  });

  it('should not delete an expense when the bill is not owned by the user', async () => {
    prisma.bill.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteExpense('user-1', 'bill-1', 'expense-1'),
    ).rejects.toThrow('Bill not found');

    expect(prisma.expense.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
