import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JdController } from './jd.controller';
import { JdService } from './jd.service';
import { JobDescription } from '../database/entities/job-description.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JobDescription])],
  controllers: [JdController],
  providers: [JdService],
  exports: [JdService],
})
export class JdModule {}