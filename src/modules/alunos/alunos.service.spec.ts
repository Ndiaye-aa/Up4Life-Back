import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AlunosService } from './alunos.service';
import { PrismaService } from '../../common/prisma/prisma.service';

jest.mock('bcrypt');

describe('AlunosService', () => {
  let service: AlunosService;

  const mockPrismaService = {
    aluno: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const alunoDoPersonal1 = {
    id: 10,
    nome: 'Aluno',
    telefone: '11988887777',
    senha: 'hashedPassword',
    personalId: 1,
    ativo: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlunosService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AlunosService>(AlunosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should normalize telefone before persisting', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(null);
      mockPrismaService.aluno.create.mockResolvedValue({ ...alunoDoPersonal1 });

      await service.create(
        { nome: 'Aluno', telefone: '(11) 98888-7777', senha: 'secret123' },
        1,
      );

      expect(mockPrismaService.aluno.findUnique).toHaveBeenCalledWith({
        where: { telefone: '11988887777' },
      });
      expect(mockPrismaService.aluno.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ telefone: '11988887777' }),
      });
    });

    it('should return senhaInicial only when the server generated the password', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(null);
      mockPrismaService.aluno.create.mockResolvedValue({ ...alunoDoPersonal1 });

      const semSenha = await service.create(
        { nome: 'Aluno', telefone: '11988887777' },
        1,
      );
      expect(semSenha).toHaveProperty('senhaInicial');

      const comSenha = await service.create(
        { nome: 'Aluno', telefone: '11988887777', senha: 'secret123' },
        1,
      );
      expect(comSenha).not.toHaveProperty('senhaInicial');
    });
  });

  describe('findOne', () => {
    it('should deny access to aluno of another personal', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(alunoDoPersonal1);

      await expect(service.findOne(10, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return aluno without senha for the owning personal', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(alunoDoPersonal1);

      const result = await service.findOne(10, 1);

      expect(result).not.toHaveProperty('senha');
      expect(result.id).toBe(10);
    });
  });

  describe('updateSelf', () => {
    it('should require senhaAtual to change senha', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(alunoDoPersonal1);

      await expect(
        service.updateSelf(10, { senha: 'novaSenha123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require senhaAtual to change telefone', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(alunoDoPersonal1);

      await expect(
        service.updateSelf(10, { telefone: '11977776666' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject wrong senhaAtual', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(alunoDoPersonal1);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateSelf(10, { senha: 'novaSenha123', senhaAtual: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should never let aluno change own ativo status', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(alunoDoPersonal1);
      mockPrismaService.aluno.update.mockResolvedValue({ ...alunoDoPersonal1 });

      await service.updateSelf(10, { nome: 'Novo Nome', ativo: false });

      expect(mockPrismaService.aluno.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ativo: undefined }),
        }),
      );
    });
  });
});
