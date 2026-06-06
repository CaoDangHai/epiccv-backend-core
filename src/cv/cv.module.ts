import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';
import { AnalysisResult } from '../database/entities/analysis-result.entity';
import { CurriculumVitae } from '../database/entities/curriculum-vitae.entity';
import { JobDescription } from '../database/entities/job-description.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisResult, CurriculumVitae, JobDescription]),
  ],
  controllers: [CvController],
  providers: [CvService],
})
export class CvModule {}
