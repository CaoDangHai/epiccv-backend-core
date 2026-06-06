import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface RequestWithUser extends Request {
  user: { sub: string; email: string; mezonId: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() data: RegisterDto) {
    return this.authService.registerLocal(data);
  }

  @Post('login')
  async login(@Body() data: LoginDto) {
    return this.authService.loginLocal(data);
  }

  @Post('mezon')
  async loginWithMezon(
    @Body('code') code: string,
    @Body('state') state: string,
  ) {
    return this.authService.loginWithMezon(code, state);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@Req() req: RequestWithUser) {
    return {
      id: req.user.sub,
      email: req.user.email,
      mezonId: req.user.mezonId,
    };
  }
}
