import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy/jwt.strategy';
import { MezonOAuthStrategy } from './strategy/mezon-oauth.strategy'; // ← THÊM
import { MezonOAuthGuard } from './guard/mezon-oauth.guard'; // ← THÊM

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    MezonOAuthGuard,
    MezonOAuthStrategy,
  ],
})
export class AuthModule {}
