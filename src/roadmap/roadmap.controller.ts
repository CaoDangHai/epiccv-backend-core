import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { RoadmapService } from './roadmap.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser extends Request { user: { sub: string } }

@Controller('roadmap')
@UseGuards(JwtAuthGuard)
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  // Lấy roadmap từ DB
  @Get(':analysisId')
  async getRoadmap(@Param('analysisId') analysisId: string, @Req() req: RequestWithUser) {
    return this.roadmapService.getRoadmap(analysisId, req.user.sub);
  }

  // Gen roadmap mới bằng AI
  @Post('generate/:analysisId')
  async generateRoadmap(@Param('analysisId') analysisId: string, @Req() req: RequestWithUser) {
    return this.roadmapService.generateRoadmap(analysisId, req.user.sub);
  }

  // Cập nhật trạng thái Phase/Step
  @Patch('step/:stepId/status')
  async updateStepStatus(@Param('stepId') stepId: string, @Body('isCompleted') isCompleted: boolean) {
    return this.roadmapService.updateStepStatus(stepId, isCompleted);
  }
}