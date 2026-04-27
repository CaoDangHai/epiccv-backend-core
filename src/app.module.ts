import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CvModule } from './cv/cv.module';

// Import tất cả Entity để đăng ký
import { Candidate } from './database/entities/candidate.entity';
import { Skill } from './database/entities/skill.entity';
import { CurriculumVitae } from './database/entities/curriculum-vitae.entity';
import { CvSkill } from './database/entities/cv-skill.entity';
import { JobDescription } from './database/entities/job-description.entity';
import { JdSkill } from './database/entities/jd-skill.entity';
import { AnalysisResult } from './database/entities/analysis-result.entity';
import { Roadmap } from './database/entities/roadmap.entity';
import { RoadmapStep } from './database/entities/roadmap-step.entity';
import { RoadmapResource } from './database/entities/roadmap-resource.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true, // Tự động load entities từ forFeature
        synchronize: process.env.NODE_ENV !== 'production', // Tự động tạo bảng trên DB (Chỉ dùng lúc code)
        ssl: { rejectUnauthorized: false },
      }),
    }),
    // Đăng ký toàn bộ Entity vào hệ thống tại đây
    TypeOrmModule.forFeature([
      Candidate,
      Skill,
      CurriculumVitae,
      CvSkill,
      JobDescription,
      JdSkill,
      AnalysisResult,
      Roadmap,
      RoadmapStep,
      RoadmapResource,
    ]),
    AuthModule,
    CvModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
