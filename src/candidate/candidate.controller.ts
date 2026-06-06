import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CandidateService } from './candidate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto, ChangePasswordDto } from './dto/candidate.dto';

interface RequestWithUser extends Request {
  user: { sub: string };
}

@Controller('candidate')
@UseGuards(JwtAuthGuard)
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Get('profile')
  async getProfile(@Req() req: RequestWithUser) {
    return this.candidateService.getProfile(req.user.sub);
  }

  @Put('profile')
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() data: UpdateProfileDto,
  ) {
    return this.candidateService.updateProfile(req.user.sub, data);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Req() req: RequestWithUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Image file was not found');
    return this.candidateService.uploadAvatar(req.user.sub, file);
  }

  @Put('password')
  async changePassword(
    @Req() req: RequestWithUser,
    @Body() data: ChangePasswordDto,
  ) {
    return this.candidateService.changePassword(req.user.sub, data);
  }
}
