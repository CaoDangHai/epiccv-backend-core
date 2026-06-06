import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JdService } from './jd.service';
import { TextJdDto } from './dto/text_jd.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import 'multer';

@Controller('jd')
@UseGuards(JwtAuthGuard)
export class JdController {
  constructor(private readonly jdService: JdService) {}

  @Post('process')
  @UseInterceptors(FileInterceptor('file'))
  async processJD(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: TextJdDto,
  ) {
    if (!file && (!body.content || body.content.trim() === '')) {
      throw new BadRequestException(
        'Provide a job description file or text content',
      );
    }
    return this.jdService.processJD(file, body.content);
  }

  @Get('history')
  async getHistory() {
    return this.jdService.getHistory();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.jdService.getById(id);
  }
}
