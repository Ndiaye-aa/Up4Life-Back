import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
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
    app.use(cookieParser());
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

          const cookies = response.headers['set-cookie'] as unknown as string[];
          expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
          expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
          expect(cookies.some((c) => c.startsWith('csrf_token='))).toBe(true);
          expect(cookies.find((c) => c.startsWith('access_token='))).toMatch(
            /HttpOnly/i,
          );
          expect(cookies.find((c) => c.startsWith('csrf_token='))).not.toMatch(
            /HttpOnly/i,
          );
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

  describe('/auth/refresh, /auth/me, /auth/logout (cookie-based session)', () => {
    let cookieJar: string[];

    const extractCookieValues = (cookies: string[]) =>
      cookies.map((c) => c.split(';')[0]);

    beforeAll(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/personal/login')
        .send({ telefone: '99999999999', senha: 'password123' })
        .expect(201);

      cookieJar = extractCookieValues(
        loginResponse.headers['set-cookie'] as unknown as string[],
      );
    });

    it('should return the current user via /auth/me using the access_token cookie', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookieJar)
        .expect(200)
        .then((response) => {
          expect(response.body.user.telefone).toBe('99999999999');
        });
    });

    it('should reject /auth/me without any cookie', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should rotate tokens on /auth/refresh using the refresh_token cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookieJar)
        .expect(201);

      const newCookies = extractCookieValues(
        response.headers['set-cookie'] as unknown as string[],
      );
      expect(newCookies.some((c) => c.startsWith('access_token='))).toBe(
        true,
      );
      expect(newCookies.some((c) => c.startsWith('refresh_token='))).toBe(
        true,
      );

      // O refresh_token antigo foi rotacionado: reapresentá-lo deve falhar.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookieJar)
        .expect(401);

      cookieJar = newCookies;
    });

    it('should reject /auth/refresh without a refresh_token cookie', () => {
      return request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('should clear cookies and revoke the refresh token on /auth/logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieJar)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookieJar)
        .expect(401);
    });
  });

  // Não existe /auth/aluno/register: cadastro de aluno é feito exclusivamente
  // pelo personal autenticado via POST /alunos (evita vincular um aluno a um
  // personalId arbitrário vindo do body — ver auth.controller.ts).
  describe('POST /alunos (criação de aluno pelo personal autenticado)', () => {
    let personalAccessToken: string;

    beforeAll(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/personal/login')
        .send({ telefone: '99999999999', senha: 'password123' })
        .expect(201);
      personalAccessToken = loginResponse.body.access_token;
    });

    it('should create a new aluno owned by the authenticated personal', () => {
      return request(app.getHttpServer())
        .post('/alunos')
        .set('Authorization', `Bearer ${personalAccessToken}`)
        .send({
          nome: 'E2E Aluno',
          telefone: '99988887777',
          senha: 'password123',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('id');
          expect(response.body).not.toHaveProperty('senha');
        });
    });

    it('should reject creating an aluno without authentication', () => {
      return request(app.getHttpServer())
        .post('/alunos')
        .send({
          nome: 'E2E Aluno Sem Auth',
          telefone: '99977776666',
          senha: 'password123',
        })
        .expect(401);
    });
  });

  describe('/auth/aluno/login (POST)', () => {
    it('should login aluno successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/aluno/login')
        .send({
          telefone: '99988887777',
          senha: 'password123',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('access_token');
        });
    });
  });
});
