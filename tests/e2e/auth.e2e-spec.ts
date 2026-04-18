import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import * as dotenv from 'dotenv';

dotenv.config();

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Limpar dados de teste se necessário
    await prisma.aluno.deleteMany({ where: { telefone: { startsWith: '99' } } });
    await prisma.personal.deleteMany({ where: { telefone: { startsWith: '99' } } });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.aluno.deleteMany({ where: { telefone: { startsWith: '99' } } });
      await prisma.personal.deleteMany({ where: { telefone: { startsWith: '99' } } });
    }
    if (app) {
      await app.close();
    }
  });

  describe('/auth/personal/register (POST)', () => {
    it('should register a new personal', () => {
      return request(app.getHttpServer())
        .post('/auth/personal/register')
        .send({
          nome: 'E2E Personal',
          telefone: '99999999999',
          senha: 'password123',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('id');
          expect(response.body.nome).toBe('E2E Personal');
          expect(response.body).not.toHaveProperty('senha');
        });
    });

    it('should return 409 if telefone already exists', () => {
      return request(app.getHttpServer())
        .post('/auth/personal/register')
        .send({
          nome: 'E2E Personal Duplicate',
          telefone: '99999999999',
          senha: 'password123',
        })
        .expect(409);
    });
  });

  describe('/auth/personal/login (POST)', () => {
    it('should login successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/personal/login')
        .send({
          telefone: '99999999999',
          senha: 'password123',
        })
        .expect(201) // NestJS Post default is 201
        .then((response) => {
          expect(response.body).toHaveProperty('access_token');
          expect(response.body.user.telefone).toBe('99999999999');
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/personal/login')
        .send({
          telefone: '99999999999',
          senha: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('/auth/aluno/register (POST)', () => {
    let personalId: number;

    beforeAll(async () => {
      const personal = await prisma.personal.findUnique({ where: { telefone: '99999999999' } });
      if (!personal) throw new Error('Personal de setup não encontrado.');
      personalId = personal.id;
    });

    it('should register a new aluno', () => {
      return request(app.getHttpServer())
        .post('/auth/aluno/register')
        .send({
          nome: 'E2E Aluno',
          telefone: '99888888888',
          senha: 'password123',
          personalId: personalId,
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('id');
          expect(response.body).not.toHaveProperty('senha');
        });
    });
  });

  describe('/auth/aluno/login (POST)', () => {
    it('should login aluno successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/aluno/login')
        .send({
          telefone: '99888888888',
          senha: 'password123',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('access_token');
        });
    });
  });
});
