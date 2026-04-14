import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app/app.module';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Security (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Obter um token válido para os testes
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/personal/register')
      .send({
        nome: 'Security Test User',
        telefone: '99000000000',
        senha: 'password123',
      });
      
    const authResponse = await request(app.getHttpServer())
      .post('/auth/personal/login')
      .send({
        telefone: '99000000000',
        senha: 'password123',
      });
    
    accessToken = authResponse.body.access_token;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Protected Routes', () => {
    it('should deny access to /profile without a token', () => {
      return request(app.getHttpServer())
        .get('/profile')
        .expect(401);
    });

    it('should deny access to /profile with an invalid token', () => {
      return request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should allow access to /profile with a valid token', () => {
      return request(app.getHttpServer())
        .get('/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('role', 'PERSONAL');
        });
    });
  });
});
