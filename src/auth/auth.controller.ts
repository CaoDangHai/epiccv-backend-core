import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() body: { email: string; password?: string; fullName?: string },
  ) {
    // Ép kiểu (type casting) để ESLint không báo Unsafe argument
    return this.authService.registerLocal(body as any);
  }

  @Post('login')
  login(@Body() body: { email: string; password?: string }) {
    return this.authService.loginLocal(body as any);
  }

  @Post('mezon')
  mezonLogin(@Body('code') code: string, @Body('state') state: string) {
    return this.authService.loginWithMezon(code, state);
  }
}
