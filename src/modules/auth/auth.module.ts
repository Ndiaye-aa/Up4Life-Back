import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type ms from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';
import { JobLockModule } from '../../common/jobs/job-lock.module';
import { getJwtSecret } from '../../common/config/env';

@Global()
@Module({
  imports: [
    JobLockModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as ms.StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshTokenCleanupService],
  exports: [AuthService],
})
export class AuthModule {}
