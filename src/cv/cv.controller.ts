import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CvService } from './cv.service';

@Controller('cv')
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post('process')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'jd_file', maxCount: 1 },
    ]),
  )
  async processCV(
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; jd_file?: Express.Multer.File[] },
    @Body('jd_text') jdText: string,
  ) {
    const cvFile = files?.file?.[0];
    const jdFile = files?.jd_file?.[0];

    if (!cvFile) {
      throw new BadRequestException('Bắt buộc phải tải lên file CV');
    }

    return this.cvService.processAndSaveReport(cvFile, jdFile, jdText);
  }

  @Get('history')
  async getAnalysisHistory() {
    return this.cvService.getHistory(); // Gọi hàm thật
  }

  @Get('analysis/:id')
  async getAnalysisById(@Param('id') id: string) {
    return this.cvService.getAnalysisById(id); // Gọi hàm thật
  }
}
