import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';

// Import các Entity liên quan
import { AnalysisResult } from '../database/entities/analysis-result.entity';
import { CurriculumVitae } from '../database/entities/curriculum-vitae.entity';
import { JobDescription } from '../database/entities/job-description.entity';

// Import { Candidate } from '../database/entities/candidate.entity'; // Mở ra nếu cần

@Module({
  imports: [
    // Đăng ký các Entity với TypeORM trong module này
    TypeOrmModule.forFeature([AnalysisResult, CurriculumVitae, JobDescription,])
  ],
  controllers: [CvController],
  providers: [CvService],
})
export class CvModule { }
