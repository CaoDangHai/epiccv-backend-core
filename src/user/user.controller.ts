import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { GetUser } from 'src/auth/decorator/';
import { JwtGuard } from 'src/auth/guard';

@UseGuards(JwtGuard)
@Controller('users')
export class UserController {
  @Get('me')
  getme(@GetUser() user: User) {
    return user;
  }
}
