import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
  UseGuards,
  Req,
  Sse,
  MessageEvent,
  Delete,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { CvService } from './cv.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import 'multer';

interface RequestWithUser extends Request {
  user: { sub: string; email: string; mezonId: string };
}

@Controller('cv')
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post('process')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'jd_file', maxCount: 1 },
    ]),
  )
  processCV(
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; jd_file?: Express.Multer.File[] },
    @Body('jd_text') jdText: string,
    @Body('saved_cv_id') savedCvId: string,
    @Req() req: RequestWithUser,
  ) {
    const cvFile = files?.file?.[0];
    const jdFile = files?.jd_file?.[0];
    if (!cvFile && !savedCvId) {
      throw new BadRequestException('Provide a CV file or select a saved CV');
    }

    return this.cvService.startProcessCV({
      cvFile,
      savedCvId,
      candidateId: req.user.sub,
      jdFile,
      jdText,
    });
  }

  @Sse('progress/:jobId')
  progress(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return this.cvService.getProgressStream(jobId);
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard)
  async getReports(@Req() req: RequestWithUser) {
    return this.cvService.getReports(req.user.sub);
  }

  @Get('analysis/:id')
  @UseGuards(JwtAuthGuard)
  async getAnalysisById(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.cvService.getAnalysisById(id, req.user.sub);
  }

  @Get('saved')
  @UseGuards(JwtAuthGuard)
  async getSavedCVs(@Req() req: RequestWithUser) {
    return this.cvService.getSavedCVs(req.user.sub);
  }

  @Delete('saved/:id')
  @UseGuards(JwtAuthGuard)
  async deleteCV(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.cvService.deleteCV(id, req.user.sub);
  }

  @Delete('history')
  @UseGuards(JwtAuthGuard)
  async deleteAllHistory(@Req() req: RequestWithUser) {
    return this.cvService.deleteAllHistory(req.user.sub);
  }
}
