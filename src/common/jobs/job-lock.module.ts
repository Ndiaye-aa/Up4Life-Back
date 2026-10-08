import { Module } from '@nestjs/common';
import { JobLockService } from './job-lock.service';

@Module({
  providers: [JobLockService],
  exports: [JobLockService],
})
export class JobLockModule {}
