import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req, Sse, MessageEvent } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { RoadmapService } from './roadmap.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestWithUser extends Request { user: { sub: string } }

@Controller('roadmap')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) { }

  @Get(':analysisId')
  @UseGuards(JwtAuthGuard)
  async getRoadmap(@Param('analysisId') analysisId: string, @Req() req: RequestWithUser) {
    return this.roadmapService.getRoadmap(analysisId, req.user.sub);
  }

  @Post('generate/:analysisId')
  @UseGuards(JwtAuthGuard)
  async generateRoadmap(@Param('analysisId') analysisId: string, @Req() req: RequestWithUser) {
    return this.roadmapService.startGenerateRoadmap(analysisId, req.user.sub);
  }

  @Sse('progress/:jobId')
  progress(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return this.roadmapService.getProgressStream(jobId);
  }

  @Patch('step/:stepId/status')
  @UseGuards(JwtAuthGuard)
  async updateStepStatus(@Param('stepId') stepId: string, @Body('isCompleted') isCompleted: boolean) {
    return this.roadmapService.updateStepStatus(stepId, isCompleted);
  }
}