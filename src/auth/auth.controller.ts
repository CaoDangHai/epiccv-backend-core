// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AuthService,
  OAuthProfile,
} from './auth.service';
import { SignInDto, SignUpDto } from './dto';
import { MezonOAuthGuard } from './guard/mezon-oauth.guard';

interface RequestWithOAuthUser extends Request {
  user: OAuthProfile;
}

interface RedirectResponse {
  url: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('signup')
  signup(@Body() dto: SignUpDto) {
    return this.authService.signup(dto);
  }

  @Post('signin')
  signin(@Body() dto: SignInDto) {
    return this.authService.signin(dto);
  }

  @Get('mezon')
  @UseGuards(MezonOAuthGuard)
  mezonAuth(): void {
    // Guard tự redirect sang Mezon, không cần body
  }

  @Get('mezon/callback')
  @UseGuards(MezonOAuthGuard)
  @Redirect()
  async mezonCallback(
    @Req() req: RequestWithOAuthUser,
  ): Promise<RedirectResponse> {
    try {
      const result =
        await this.authService.handleMezonOAuth(
          req.user,
        );
      return {
        url: `http://localhost:3000/login/success?token=${result.token}`,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error';
      return {
        url: `http://localhost:3000/login/error?message=${encodeURIComponent(message)}`,
      };
    }
  }
}
