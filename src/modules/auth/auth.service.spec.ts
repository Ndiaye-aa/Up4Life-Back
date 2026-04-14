import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockPrismaService = {
    personal: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    aluno: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerPersonal', () => {
    const dto = { nome: 'Test Personal', telefone: '11999999999', senha: 'password123' };

    it('should register a new personal trainer', async () => {
      mockPrismaService.personal.findUnique.mockResolvedValue(null);
      mockPrismaService.personal.create.mockResolvedValue({ id: 1, ...dto, senha: 'hashedPassword' });

      const result = await service.registerPersonal(dto);

      expect(result).toHaveProperty('id');
      expect(result).not.toHaveProperty('senha');
      expect(prisma.personal.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if telefone already exists', async () => {
      mockPrismaService.personal.findUnique.mockResolvedValue({ id: 1, ...dto });

      await expect(service.registerPersonal(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('loginPersonal', () => {
    const dto = { telefone: '11999999999', senha: 'password123' };
    const personal = { id: 1, nome: 'Test', telefone: dto.telefone, senha: 'hashedPassword' };

    it('should return access token on successful login', async () => {
      mockPrismaService.personal.findUnique.mockResolvedValue(personal);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.loginPersonal(dto);

      expect(result).toHaveProperty('access_token');
      expect(result.user).not.toHaveProperty('senha');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrismaService.personal.findUnique.mockResolvedValue(personal);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.loginPersonal(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('registerAluno', () => {
    const dto = { nome: 'Test Aluno', telefone: '11888888888', senha: 'password123', personalId: 1 };

    it('should register a new aluno', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(null);
      mockPrismaService.aluno.create.mockResolvedValue({ id: 2, ...dto, senha: 'hashedPassword' });

      const result = await service.registerAluno(dto);

      expect(result).toHaveProperty('id');
      expect(result).not.toHaveProperty('senha');
      expect(prisma.aluno.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if telefone already exists as aluno', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({ id: 2, ...dto });

      await expect(service.registerAluno(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('loginAluno', () => {
    const dto = { telefone: '11888888888', senha: 'password123' };
    const aluno = { id: 2, nome: 'Test', telefone: dto.telefone, senha: 'hashedPassword' };

    it('should return access token on successful login', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(aluno);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.loginAluno(dto);

      expect(result).toHaveProperty('access_token');
      expect(result.user).not.toHaveProperty('senha');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(aluno);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.loginAluno(dto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
