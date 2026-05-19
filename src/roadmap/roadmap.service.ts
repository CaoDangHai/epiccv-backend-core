import { Injectable, NotFoundException, InternalServerErrorException, MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'rxjs';
import * as crypto from 'crypto';
import axios from 'axios';
import { Roadmap } from '../database/entities/roadmap.entity';
import { RoadmapStep } from '../database/entities/roadmap-step.entity';
import { RoadmapResource } from '../database/entities/roadmap-resource.entity';
import { AnalysisResult } from '../database/entities/analysis-result.entity';

@Injectable()
export class RoadmapService {
    private readonly aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';
    private jobStreams = new Map<string, Subject<MessageEvent>>();

    constructor(
        @InjectRepository(Roadmap) private roadmapRepo: Repository<Roadmap>,
        @InjectRepository(RoadmapStep) private roadmapStepRepo: Repository<RoadmapStep>,
        @InjectRepository(RoadmapResource) private roadmapResourceRepo: Repository<RoadmapResource>,
        @InjectRepository(AnalysisResult) private analysisRepo: Repository<AnalysisResult>,
    ) { }

    async getRoadmap(analysisId: string, candidateId: string) {
        const roadmap = await this.roadmapRepo.findOne({
            where: { analysisResultId: analysisId, analysisResult: { cv: { candidateId } } },
            relations: ['steps', 'steps.resources'],
            order: { steps: { orderIndex: 'ASC' } }
        });
        if (!roadmap) return null;
        return {
            target_job_title: roadmap.targetJobTitle, summary: roadmap.summary, difficulty: roadmap.difficulty, estimated_total_time: roadmap.estimatedTotalTime,
            steps: roadmap.steps.map(step => ({
                id: step.id, order: step.orderIndex, title: step.title, description: step.description, estimated_duration: step.estimatedDuration,
                key_topics: step.keyTopics || [], linked_skill_gaps: step.linkedSkillGaps || [], focus_skills: step.focusSkills || [], is_completed: step.isCompleted,
                resources: step.resources.map(res => ({ title: res.title, url: res.url, resource_type: res.resourceType, description: res.description, })),
            })),
        };
    }

    async updateStepStatus(stepId: string, isCompleted: boolean) {
        await this.roadmapStepRepo.update(stepId, { isCompleted });
        return { success: true, isCompleted };
    }

    async startGenerateRoadmap(analysisId: string, candidateId: string) {
        const jobId = crypto.randomUUID();
        const subject = new Subject<MessageEvent>();
        this.jobStreams.set(jobId, subject);

        this.generateRoadmapBackground(jobId, subject, analysisId, candidateId).catch(err => {
            subject.next({ data: { error: err.message } });
            subject.complete();
            this.jobStreams.delete(jobId);
        });

        return { jobId };
    }

    getProgressStream(jobId: string) {
        const subject = this.jobStreams.get(jobId);
        if (!subject) throw new NotFoundException('Job không tồn tại');
        return subject.asObservable();
    }

    private async generateRoadmapBackground(jobId: string, subject: Subject<MessageEvent>, analysisId: string, candidateId: string) {
        try {
            subject.next({ data: { progress: 20, message: 'Đang tải kết quả phân tích CV...' } });
            const analysis = await this.analysisRepo.findOne({ where: { id: analysisId, cv: { candidateId } } });
            if (!analysis) throw new NotFoundException('Analysis không tồn tại');
            const compareResult = (analysis.parsedData as any)?.extractedData;

            subject.next({ data: { progress: 50, message: 'AI đang xây dựng Roadmap chi tiết...' } });
            const response = await axios.post(`${this.aiServerUrl}/ai/generate-roadmap`, compareResult);
            const roadmapResult = response.data;

            subject.next({ data: { progress: 85, message: 'Đang lưu trữ dữ liệu...' } });
            await this.roadmapRepo.delete({ analysisResultId: analysisId });
            const roadmap = await this.roadmapRepo.save(this.roadmapRepo.create({
                analysisResultId: analysisId, targetJobTitle: roadmapResult.target_job_title,
                summary: roadmapResult.summary, estimatedTotalTime: roadmapResult.estimated_total_time,
            }));

            await Promise.all((roadmapResult.steps || []).map(async (step: any) => {
                const savedStep = await this.roadmapStepRepo.save(this.roadmapStepRepo.create({
                    roadmapId: roadmap.id, orderIndex: step.order, title: step.title, description: step.description,
                    estimatedDuration: step.estimated_duration, keyTopics: step.key_topics || [], linkedSkillGaps: step.linked_skill_gaps || [],
                    focusSkills: step.focus_skills || [], isCompleted: false,
                }));
                if (step.resources?.length) {
                    await Promise.all(step.resources.map((res: any) =>
                        this.roadmapResourceRepo.save(this.roadmapResourceRepo.create({
                            roadmapStepId: savedStep.id, title: res.title, url: String(res.url),
                            resourceType: res.resource_type || 'Documentation', description: res.description,
                        }))
                    ));
                }
            }));

            subject.next({ data: { progress: 100, message: 'Hoàn tất!' } });
            subject.complete();
            this.jobStreams.delete(jobId);
        } catch (error) {
            subject.next({ data: { error: error instanceof Error ? error.message : 'Có lỗi xảy ra' } });
            subject.complete();
            this.jobStreams.delete(jobId);
        }
    }
}