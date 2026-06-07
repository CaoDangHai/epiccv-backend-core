/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Injectable, NotFoundException, MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'rxjs';
import * as crypto from 'crypto';
import { Roadmap } from '../database/entities/roadmap.entity';
import { RoadmapStep } from '../database/entities/roadmap-step.entity';
import { RoadmapResource } from '../database/entities/roadmap-resource.entity';
import { AnalysisResult } from '../database/entities/analysis-result.entity';
import { normalizeAiServerUrl, postToAi } from '../utils/aiClient';

@Injectable()
export class RoadmapService {
  private readonly aiServerUrl = normalizeAiServerUrl(
    process.env.AI_SERVER_URL || 'http://localhost:8000',
  );
  private readonly jobStreams = new Map<string, Subject<MessageEvent>>();

  constructor(
    @InjectRepository(Roadmap) private roadmapRepo: Repository<Roadmap>,
    @InjectRepository(RoadmapStep)
    private roadmapStepRepo: Repository<RoadmapStep>,
    @InjectRepository(RoadmapResource)
    private roadmapResourceRepo: Repository<RoadmapResource>,
    @InjectRepository(AnalysisResult)
    private analysisRepo: Repository<AnalysisResult>,
  ) {}

  async getRoadmap(analysisId: string, candidateId: string) {
    const roadmap = await this.roadmapRepo.findOne({
      where: {
        analysisResultId: analysisId,
        analysisResult: { cv: { candidateId } },
      },
      relations: ['steps', 'steps.resources'],
      order: { steps: { orderIndex: 'ASC' } },
    });
    if (!roadmap) return null;

    return {
      target_job_title: roadmap.targetJobTitle,
      summary: roadmap.summary,
      difficulty: roadmap.difficulty,
      estimated_total_time: roadmap.estimatedTotalTime,
      steps: roadmap.steps.map((step) => ({
        id: step.id,
        order: step.orderIndex,
        title: step.title,
        description: step.description,
        estimated_duration: step.estimatedDuration,
        key_topics: step.keyTopics || [],
        linked_skill_gaps: step.linkedSkillGaps || [],
        focus_skills: step.focusSkills || [],
        is_completed: step.isCompleted,
        resources: step.resources.map((resource) => ({
          title: resource.title,
          url: resource.url,
          resource_type: resource.resourceType,
          description: resource.description,
        })),
      })),
    };
  }

  async updateStepStatus(stepId: string, isCompleted: boolean) {
    await this.roadmapStepRepo.update(stepId, { isCompleted });
    return { success: true, isCompleted };
  }

  startGenerateRoadmap(analysisId: string, candidateId: string) {
    const jobId = crypto.randomUUID();
    const subject = new Subject<MessageEvent>();
    this.jobStreams.set(jobId, subject);

    this.generateRoadmapBackground(
      jobId,
      subject,
      analysisId,
      candidateId,
    ).catch((error) => {
      subject.next({ data: { error: error.message } });
      subject.complete();
      this.jobStreams.delete(jobId);
    });

    return { jobId };
  }

  getProgressStream(jobId: string) {
    const subject = this.jobStreams.get(jobId);
    if (!subject) throw new NotFoundException('Job does not exist');
    return subject.asObservable();
  }

  private async generateRoadmapBackground(
    jobId: string,
    subject: Subject<MessageEvent>,
    analysisId: string,
    candidateId: string,
  ) {
    try {
      subject.next({
        data: { progress: 20, message: 'Loading CV analysis result...' },
      });
      const analysis = await this.analysisRepo.findOne({
        where: { id: analysisId, cv: { candidateId } },
      });
      if (!analysis) throw new NotFoundException('Analysis was not found');
      const compareResult = (analysis.parsedData as any)?.extractedData;

      subject.next({
        data: {
          progress: 50,
          message: 'AI is building the detailed roadmap...',
        },
      });
      const roadmapResult = await postToAi<any>(
        this.aiServerUrl,
        '/ai/generate-roadmap',
        compareResult,
      );

      subject.next({
        data: { progress: 85, message: 'Saving roadmap data...' },
      });
      await this.roadmapRepo.delete({ analysisResultId: analysisId });
      const roadmap = await this.roadmapRepo.save(
        this.roadmapRepo.create({
          analysisResultId: analysisId,
          targetJobTitle: roadmapResult.target_job_title,
          summary: roadmapResult.summary,
          difficulty: roadmapResult.difficulty,
          estimatedTotalTime: roadmapResult.estimated_total_time,
        }),
      );

      await Promise.all(
        (roadmapResult.steps || []).map(async (step: any) => {
          const savedStep = await this.roadmapStepRepo.save(
            this.roadmapStepRepo.create({
              roadmapId: roadmap.id,
              orderIndex: step.order,
              title: step.title,
              description: step.description,
              estimatedDuration: step.estimated_duration,
              keyTopics: step.key_topics || [],
              linkedSkillGaps: step.linked_skill_gaps || [],
              focusSkills: step.focus_skills || [],
              isCompleted: false,
            }),
          );

          if (step.resources?.length) {
            await Promise.all(
              step.resources.map((resource: any) =>
                this.roadmapResourceRepo.save(
                  this.roadmapResourceRepo.create({
                    roadmapStepId: savedStep.id,
                    title: resource.title,
                    url: String(resource.url),
                    resourceType: resource.resource_type || 'Documentation',
                    description: resource.description,
                  }),
                ),
              ),
            );
          }
        }),
      );

      subject.next({ data: { progress: 100, message: 'Roadmap complete!' } });
      subject.complete();
      this.jobStreams.delete(jobId);
    } catch (error) {
      subject.next({
        data: {
          error:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
        },
      });
      subject.complete();
      this.jobStreams.delete(jobId);
    }
  }
}
