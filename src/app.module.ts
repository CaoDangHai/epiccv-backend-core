import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CvModule } from './cv/cv.module';

// Import tất cả Entity để đăng ký
import { Candidate } from './database/entities/candidate.entity';
import { CurriculumVitae } from './database/entities/curriculum-vitae.entity';
import { AnalysisResult } from './database/entities/analysis-result.entity';
import { Roadmap } from './database/entities/roadmap.entity';
import { RoadmapStep } from './database/entities/roadmap-step.entity';
import { RoadmapResource } from './database/entities/roadmap-resource.entity';
import { JdModule } from './jd/jd.module';
import { RoadmapModule } from './roadmap/roadmap.module';

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
        synchronize: true, //process.env.NODE_ENV !== 'production', // Tự động tạo bảng trên DB (Chỉ dùng lúc code)
        ssl: { rejectUnauthorized: false },
      }),
    }),
    // Đăng ký toàn bộ Entity vào hệ thống tại đây
    TypeOrmModule.forFeature([
      Candidate,
      CurriculumVitae,
      AnalysisResult,
      Roadmap,
      RoadmapStep,
      RoadmapResource,
    ]),
    AuthModule,
    CvModule,
    JdModule,
    RoadmapModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
