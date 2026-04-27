import { Body, Controller, Get, Post, Redirect, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto, SignUpDto } from './dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  signup(@Body() dto: SignUpDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  signin(@Body() dto: SignInDto) {
    return this.authService.signin(dto);
  }

  @Post('mezon')
  async mezonExchange(
    @Body() body: { code: string; state: string },
  ) {
    return this.authService.loginWithMezon(body.code, body.state);
  }
}