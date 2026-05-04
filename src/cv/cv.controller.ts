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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CvService } from './cv.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import 'multer';

// Khai báo kiểu dữ liệu cho Request sau khi đi qua JwtAuthGuard (Fix lỗi ESLint)
interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    mezonId: string;
  };
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
  async processCV(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      jd_file?: Express.Multer.File[];
    },
    @Body('jd_text') jdText: string,
    @Req() req: RequestWithUser,
  ) {
    const cvFile = files?.file?.[0];
    const jdFile = files?.jd_file?.[0];

    if (!cvFile) throw new BadRequestException('Bắt buộc phải tải lên file CV');

    const candidateId: string = req.user.sub;

    return this.cvService.processCVFile(cvFile, candidateId, jdFile, jdText);
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard)
  async getReports(@Req() req: RequestWithUser) {
    const candidateId: string = req.user.sub;
    return this.cvService.getReports(candidateId);
  }

  @Get('analysis/:id')
  @UseGuards(JwtAuthGuard)
  async getAnalysisById(@Param('id') id: string, @Req() req: RequestWithUser) {
    const candidateId: string = req.user.sub;
    return this.cvService.getAnalysisById(id, candidateId);
  }

  @Post('roadmap/:analysisId')
  @UseGuards(JwtAuthGuard) 
  async generateRoadmap(
    @Param('analysisId') analysisId: string,
    @Req() req: any,
  ) {
    const candidateId = req.user?.id || req.user?.sub;
    return this.cvService.generateRoadmap(analysisId, candidateId);
  }
}
