import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Roadmap } from '../database/entities/roadmap.entity';
import { RoadmapStep } from '../database/entities/roadmap-step.entity';
import { RoadmapResource } from '../database/entities/roadmap-resource.entity';
import { AnalysisResult } from '../database/entities/analysis-result.entity';

@Injectable()
export class RoadmapService {
    private readonly aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';

    constructor(
        @InjectRepository(Roadmap) private roadmapRepo: Repository<Roadmap>,
        @InjectRepository(RoadmapStep) private roadmapStepRepo: Repository<RoadmapStep>,
        @InjectRepository(RoadmapResource) private roadmapResourceRepo: Repository<RoadmapResource>,
        @InjectRepository(AnalysisResult) private analysisRepo: Repository<AnalysisResult>,
    ) { }

    // YÊU CẦU 2: LOAD ROADMAP TỪ DB THAY VÌ GỌI AI
    async getRoadmap(analysisId: string, candidateId: string) {
        const roadmap = await this.roadmapRepo.findOne({
            where: { analysisResultId: analysisId, analysisResult: { cv: { candidateId } } },
            relations: ['steps', 'steps.resources'],
            order: { steps: { orderIndex: 'ASC' } } // Đảm bảo Phase load đúng thứ tự
        });

        if (!roadmap) return null;

        // Map sang format Frontend cần
        return {
            target_job_title: roadmap.targetJobTitle,
            summary: roadmap.summary,
            difficulty: roadmap.difficulty,
            estimated_total_time: roadmap.estimatedTotalTime,
            steps: roadmap.steps.map(step => ({
                id: step.id,
                order: step.orderIndex,
                title: step.title,
                description: step.description,
                estimated_duration: step.estimatedDuration,
                key_topics: step.keyTopics || [],
                linked_skill_gaps: step.linkedSkillGaps || [],
                focus_skills: step.focusSkills || [],
                is_completed: step.isCompleted,
                resources: step.resources.map(res => ({
                    title: res.title,
                    url: res.url,
                    resource_type: res.resourceType,
                    description: res.description,
                })),
            })),
        };
    }

    // CẬP NHẬT TRẠNG THÁI STATUS
    async updateStepStatus(stepId: string, isCompleted: boolean) {
        await this.roadmapStepRepo.update(stepId, { isCompleted });
        return { success: true, isCompleted };
    }

    // BÊ NGUYÊN HÀM generateRoadmap TỪ cv.service.ts SANG ĐÂY
    async generateRoadmap(analysisId: string, candidateId: string) {
        const analysis = await this.analysisRepo.findOne({ where: { id: analysisId, cv: { candidateId } } });
        if (!analysis) throw new NotFoundException('Analysis không tồn tại');
        const compareResult = (analysis.parsedData as any)?.extractedData;

        try {
            const response = await axios.post(`${this.aiServerUrl}/ai/generate-roadmap`, compareResult);
            const roadmapResult = response.data;

            await this.roadmapRepo.delete({ analysisResultId: analysisId });
            const roadmap = await this.roadmapRepo.save(this.roadmapRepo.create({
                analysisResultId: analysisId,
                targetJobTitle: roadmapResult.target_job_title,
                summary: roadmapResult.summary,
                estimatedTotalTime: roadmapResult.estimated_total_time,
            }));

            // Lưu steps
            const savedSteps = await Promise.all((roadmapResult.steps || []).map(async (step: any) => {
                const savedStep = await this.roadmapStepRepo.save(this.roadmapStepRepo.create({
                    roadmapId: roadmap.id,
                    orderIndex: step.order,
                    title: step.title,
                    description: step.description,
                    estimatedDuration: step.estimated_duration,
                    keyTopics: step.key_topics || [],
                    linkedSkillGaps: step.linked_skill_gaps || [],
                    focusSkills: step.focus_skills || [],
                    isCompleted: false,
                }));
                if (step.resources?.length) {
                    await Promise.all(step.resources.map((res: any) =>
                        this.roadmapResourceRepo.save(this.roadmapResourceRepo.create({
                            roadmapStepId: savedStep.id,
                            title: res.title,
                            url: String(res.url),
                            resourceType: res.resource_type || 'Documentation',
                            description: res.description,
                        }))
                    ));
                }
                return savedStep;
            }));

            // Trả về luôn data đã format sau khi gen
            return this.getRoadmap(analysisId, candidateId);
        } catch (error) {
            throw new InternalServerErrorException('Lỗi khi gọi AI gen roadmap');
        }
    }
}