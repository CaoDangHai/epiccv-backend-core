import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CvModule } from './cv/cv.module';
import { Candidate } from './database/entities/candidate.entity';
import { CurriculumVitae } from './database/entities/curriculum-vitae.entity';
import { AnalysisResult } from './database/entities/analysis-result.entity';
import { Roadmap } from './database/entities/roadmap.entity';
import { RoadmapStep } from './database/entities/roadmap-step.entity';
import { RoadmapResource } from './database/entities/roadmap-resource.entity';
import { JdModule } from './jd/jd.module';
import { RoadmapModule } from './roadmap/roadmap.module';
import { CandidateModule } from './candidate/candidate.module';

@Module({
  imports: [
    // Bật Rate Limit (10 request / 60 giây)
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),

    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        JWT_SECRET: Joi.string().required(),
      }),
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
        ssl: { rejectUnauthorized: false },
      }),
    }),
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
    CandidateModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }