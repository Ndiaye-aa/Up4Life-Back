import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await prisma.personal.deleteMany({ where: { telefone: '99000000000' } });

    // Obter um token válido para os testes
    await request(app.getHttpServer())
      .post('/auth/personal/register')
      .send({
        nome: 'Security Test User',
        telefone: '99000000000',
        senha: 'password123',
      })
      .expect(201);

    const authResponse = await request(app.getHttpServer())
      .post('/auth/personal/login')
      .send({
        telefone: '99000000000',
        senha: 'password123',
      })
      .expect(201);

    accessToken = authResponse.body.access_token;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.personal.deleteMany({ where: { telefone: '99000000000' } });
    }
    if (app) {
      await app.close();
    }
  });

  describe('Protected Routes', () => {
    // Não existe /profile na API; a rota equivalente ("quem é o usuário
    // autenticado") é /auth/me, adicionada junto com a migração para cookies.
    it('should deny access to /auth/me without a token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('should deny access to /auth/me with an invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should allow access to /auth/me with a valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body.user).toHaveProperty('id');
          expect(response.body.user).toHaveProperty('role', 'PERSONAL');
        });
    });
  });

  describe('CSRF protection (cookie-based session, enforcing mode)', () => {
    let cookieJar: string[];
    const originalEnforce = process.env.CSRF_ENFORCE;

    beforeAll(async () => {
      process.env.CSRF_ENFORCE = 'true';

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/personal/login')
        .send({ telefone: '99000000000', senha: 'password123' })
        .expect(201);

      cookieJar = (
        loginResponse.headers['set-cookie'] as unknown as string[]
      ).map((c) => c.split(';')[0]);
    });

    afterAll(() => {
      process.env.CSRF_ENFORCE = originalEnforce;
    });

    const csrfCookieValue = (jar: string[]) =>
      jar
        .find((c) => c.startsWith('csrf_token='))
        ?.substring('csrf_token='.length);

    it('should block a mutating request authenticated only by cookie, without a CSRF header', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieJar)
        .expect(403);
    });

    it('should block a mutating request when the CSRF header does not match the cookie', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieJar)
        .set('X-CSRF-Token', 'token-errado')
        .expect(403);
    });

    it('should allow a mutating request when the CSRF header matches the cookie', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieJar)
        .set('X-CSRF-Token', csrfCookieValue(cookieJar) ?? '')
        .expect(201);
    });
  });
});
