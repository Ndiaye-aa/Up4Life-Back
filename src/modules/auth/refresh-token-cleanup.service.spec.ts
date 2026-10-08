import { Test } from '@nestjs/testing';
import { JobLockService } from '../../common/jobs/job-lock.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';

describe('RefreshTokenCleanupService', () => {
  let service: RefreshTokenCleanupService;
  const prisma = { refreshToken: { deleteMany: jest.fn() } };
  const lock = { adquirir: jest.fn(), liberar: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RefreshTokenCleanupService,
        { provide: PrismaService, useValue: prisma },
        { provide: JobLockService, useValue: lock },
      ],
    }).compile();
    service = module.get(RefreshTokenCleanupService);
    lock.adquirir.mockResolvedValue(true);
  });

  afterEach(() => jest.resetAllMocks());

  it('remove expirados e revogados há mais de 7 dias e registra o resultado', async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
    const agora = new Date('2026-10-08T07:00:00Z');

    await expect(service.limpar(agora)).resolves.toBe(3);

    const corte = new Date('2026-10-01T07:00:00Z');
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ expiresAt: { lt: corte } }, { revokedAt: { lt: corte } }],
      },
    });
    expect(lock.liberar).toHaveBeenCalledWith('limpeza-refresh-tokens', {
      removidos: 3,
    });
  });

  it('não faz nada quando outra instância detém o lock', async () => {
    lock.adquirir.mockResolvedValue(false);
    await expect(service.limpar()).resolves.toBe(0);
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    expect(lock.liberar).not.toHaveBeenCalled();
  });

  it('libera o lock mesmo se a remoção falhar', async () => {
    prisma.refreshToken.deleteMany.mockRejectedValue(new Error('db'));
    await expect(service.limpar()).rejects.toThrow('db');
    expect(lock.liberar).toHaveBeenCalled();
  });
});
