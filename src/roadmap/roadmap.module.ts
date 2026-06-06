import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { Roadmap } from '../database/entities/roadmap.entity';
import { RoadmapStep } from '../database/entities/roadmap-step.entity';
import { RoadmapResource } from '../database/entities/roadmap-resource.entity';
import { AnalysisResult } from '../database/entities/analysis-result.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Roadmap,
      RoadmapStep,
      RoadmapResource,
      AnalysisResult,
    ]),
  ],
  controllers: [RoadmapController],
  providers: [RoadmapService],
})
export class RoadmapModule {}
