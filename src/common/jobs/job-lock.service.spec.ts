import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { JobLockService } from './job-lock.service';

describe('JobLockService', () => {
  let service: JobLockService;
  const prisma = { $executeRaw: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [JobLockService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(JobLockService);
  });

  afterEach(() => jest.resetAllMocks());

  it('semeia a linha antes de tentar o lock e adquire quando o UPDATE afeta 1 linha', async () => {
    prisma.$executeRaw.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    await expect(service.adquirir('fechamento-faltas')).resolves.toBe(true);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    const [insert] = prisma.$executeRaw.mock.calls[0] as [TemplateStringsArray];
    expect(insert.join('?')).toMatch(/INSERT INTO job_lock[\s\S]*ON CONFLICT/);
  });

  it('não adquire quando o lock ainda está vigente (0 linhas)', async () => {
    prisma.$executeRaw.mockResolvedValue(0);
    await expect(service.adquirir('fechamento-faltas')).resolves.toBe(false);
  });

  it('libera usando now() do banco e serializa o resultado', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await service.liberar('fechamento-faltas', { criadas: 2 });

    const [sql, ...valores] = prisma.$executeRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(sql.join('?')).toMatch(
      /bloqueado_ate = \(now\(\) AT TIME ZONE 'UTC'\)/,
    );
    expect(valores).toEqual([
      JSON.stringify({ criadas: 2 }),
      'fechamento-faltas',
    ]);
  });
});
