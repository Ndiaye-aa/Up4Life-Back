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

  const mockPrismaService = {
    personal: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    aluno: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerPersonal', () => {
    const dto = {
      nome: 'Test Personal',
      telefone: '11999999999',
      senha: 'password123',
    };

    it('should register a new personal trainer', async () => {
      mockPrismaService.personal.findUnique.mockResolvedValue(null);
      mockPrismaService.personal.create.mockResolvedValue({
        id: 1,
        ...dto,
        senha: 'hashedPassword',
      });

      const result = await service.registerPersonal(dto);

      expect(result).toHaveProperty('id');
      expect(result).not.toHaveProperty('senha');
      expect(prisma.personal.create).toHaveBeenCalled();
    });

    it('should normalize telefone before persisting', async () => {
      mockPrismaService.personal.findUnique.mockResolvedValue(null);
      mockPrismaService.personal.create.mockResolvedValue({
        id: 1,
        ...dto,
        senha: 'hashedPassword',
      });

      await service.registerPersonal({ ...dto, telefone: '(11) 99999-9999' });

      expect(prisma.personal.findUnique).toHaveBeenCalledWith({
        where: { telefone: '11999999999' },
      });
      expect(prisma.personal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ telefone: '11999999999' }),
      });
    });

    it('should throw ConflictException if telefone already exists', async () => {
      mockPrismaService.personal.findUnique.mockResolvedValue({
        id: 1,
        ...dto,
      });

      await expect(service.registerPersonal(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('loginPersonal', () => {
    const dto = { telefone: '11999999999', senha: 'password123' };
    const personal = {
      id: 1,
      nome: 'Test',
      telefone: dto.telefone,
      senha: 'hashedPassword',
    };

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

      await expect(service.loginPersonal(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should compare against a dummy hash when telefone is unknown (timing)', async () => {
      mockPrismaService.personal.findUnique.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.loginPersonal(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcrypt.compare).toHaveBeenCalled();
    });
  });

  describe('loginAluno', () => {
    const dto = { telefone: '11888888888', senha: 'password123' };
    const aluno = {
      id: 2,
      nome: 'Test',
      telefone: dto.telefone,
      senha: 'hashedPassword',
      ativo: true,
    };

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

      await expect(service.loginAluno(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject login for deactivated aluno', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        ...aluno,
        ativo: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.loginAluno(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    const storedToken = {
      tokenHash: 'hash-atual',
      personalId: 1,
      alunoId: null,
      role: 'PERSONAL',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
    };

    it('should throw when no refresh token is provided', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when the refresh token is unknown', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when the refresh token is expired', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should rotate the token and return new tokens when valid', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        storedToken,
      );
      mockPrismaService.personal.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.refreshToken.update.mockResolvedValue({});

      const result = await service.refresh('raw-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled();
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: expect.any(String) },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('should revoke all sessions of the user on refresh token reuse', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        revokedAt: new Date(),
      });
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({});

      await expect(service.refresh('raw-token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            revokedAt: null,
            personalId: storedToken.personalId,
          }),
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('should mark the matching token as revoked', async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({});

      await service.revokeRefreshToken('raw-token');

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should do nothing when no token is provided', async () => {
      await service.revokeRefreshToken(undefined);

      expect(mockPrismaService.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});
