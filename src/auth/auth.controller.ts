import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';


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

  // ✅ Endpoint lấy thông tin user hiện tại từ token
  @Get('me')
  async getCurrentUser(@Req() req: any) {
    const user = req.user; // Từ JWT payload
    return {
      id: user.id,
      email: user.email,
      // Hoặc lấy từ DB để đầy đủ thông tin
    };
  }
}