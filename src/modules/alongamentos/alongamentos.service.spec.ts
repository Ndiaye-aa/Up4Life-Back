import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AlongamentosService } from './alongamentos.service';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('erro', {
    code,
    clientVersion: 'test',
  });

describe('AlongamentosService', () => {
  const tx = {
    alongamento: { findUnique: jest.fn(), update: jest.fn() },
    itemTreino: { updateMany: jest.fn() },
  };
  const prisma = {
    alongamento: { create: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const service = new AlongamentosService(prisma as never);

  afterEach(() => jest.clearAllMocks());

  it('create: nome duplicado vira 409', async () => {
    prisma.alongamento.create.mockRejectedValue(prismaError('P2002'));
    await expect(
      service.create({ nome: 'A', grupoMuscular: 'Quadríceps' }),
    ).rejects.toThrow(ConflictException);
  });

  it('update: renomear acompanha os itens das rotinas de alongamento', async () => {
    tx.alongamento.findUnique.mockResolvedValue({ id: 1, nome: 'Velho' });
    tx.alongamento.update.mockResolvedValue({ id: 1, nome: 'Novo' });

    await service.update(1, { nome: 'Novo' });

    expect(tx.itemTreino.updateMany).toHaveBeenCalledWith({
      where: { exercicio: 'Velho', treino: { tipo: 'ALONGAMENTO' } },
      data: { exercicio: 'Novo' },
    });
  });

  it('update: inexistente vira 404', async () => {
    tx.alongamento.findUnique.mockResolvedValue(null);
    await expect(service.update(9, { descricao: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove: inexistente vira 404', async () => {
    prisma.alongamento.delete.mockRejectedValue(prismaError('P2025'));
    await expect(service.remove(9)).rejects.toThrow(NotFoundException);
  });
});
