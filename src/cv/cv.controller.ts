import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CvService } from './cv.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import 'multer';

@Controller('cv')
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post('process')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async processCV(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Bắt buộc phải tải lên file CV');
    const candidateId: string = req.user.sub;
    return this.cvService.processCVFile(file, candidateId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Req() req: any) {
    const candidateId: string = req.user.sub;
    return this.cvService.getHistory(candidateId);
  }

  @Get('analysis/:id')
  @UseGuards(JwtAuthGuard)
  async getAnalysisById(@Param('id') id: string) {
    return this.cvService.getAnalysisById(id);
  }
}