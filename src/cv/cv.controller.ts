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
  MessageEvent
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import { CvService } from './cv.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import 'multer';

interface RequestWithUser extends Request {
  user: { sub: string; email: string; mezonId: string; };
}

@Controller('cv') // Bỏ Guard chung ở Class
export class CvController {
  constructor(private readonly cvService: CvService) { }

  @Post('process')
  @UseGuards(JwtAuthGuard) // Chỉ cài Guard ở endpoint cần gửi file
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'jd_file', maxCount: 1 },
    ]),
  )
  async processCV(
    @UploadedFiles() files: { file?: Express.Multer.File[]; jd_file?: Express.Multer.File[]; },
    @Body('jd_text') jdText: string,
    @Req() req: RequestWithUser,
  ) {
    const cvFile = files?.file?.[0];
    const jdFile = files?.jd_file?.[0];
    if (!cvFile) throw new BadRequestException('Bắt buộc phải tải lên file CV');

    // Gọi và trả về jobId lập tức
    return this.cvService.startProcessCV(cvFile, req.user.sub, jdFile, jdText);
  }

  // Luồng SSE Public cho phép Frontend kết nối lấy tiến độ thật
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
}