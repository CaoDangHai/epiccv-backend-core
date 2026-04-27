import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import type { Candidate } from '@prisma/client';
import { GetCandidate } from 'src/auth/decorator/';
import { JwtGuard } from 'src/auth/guard';

@UseGuards(JwtGuard)
@Controller('candidates')
export class CandidateController {
  @Get('me')
  getme(@GetCandidate() candidate: Candidate) {
    return candidate;
  }
}
