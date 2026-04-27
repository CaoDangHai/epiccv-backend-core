import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { SignInDto, SignUpDto } from './dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface MezonUserInfo {
  sub?: string;
  email?: string;
  name?: string;
  display_name?: string;
  username?: string;
  mezon_id?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private httpService: HttpService,
  ) {}

  async signup(dto: SignUpDto) {
    const hash = await argon.hash(dto.password);
    try {
      const candidate = await this.prisma.candidate.create({
        data: {
          email: dto.email,
          hash,
          fullName: dto.fullName,
          phoneNumber: dto.phoneNumber,
          address: dto.address,
          age: dto.age,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          address: true,
          age: true,
          createdAt: true,
        },
      });
      return {
        token: await this.signToken(candidate.id, candidate.email),
        candidate,
      };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ForbiddenException('Email is duplicate');
      }
      throw error;
    }
  }

  async signin(dto: SignInDto) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { email: dto.email },
    });

    if (!candidate) throw new ForbiddenException('Credentials incorrect');

    const pwMatches = await argon.verify(candidate.hash, dto.password);
    if (!pwMatches) throw new ForbiddenException('Credentials incorrect');

    return {
      token: await this.signToken(candidate.id, candidate.email),
      candidate: {
        id: candidate.id,
        email: candidate.email,
        fullName: candidate.fullName,
        phoneNumber: candidate.phoneNumber,
        address: candidate.address,
        age: candidate.age,
        createdAt: candidate.createdAt,
      },
    };
  }

  // ==========================================
  // MEZON OAUTH
  // ==========================================
  async loginWithMezon(code: string, state: string): Promise<{ token: string }> {
    const mezonToken = await this.exchangeCodeForToken(code, state);
    const userInfo = await this.getMezonUserInfo(mezonToken);
    const candidate = await this.validateAndSaveUser(userInfo);
    const token = await this.signToken(candidate.id, candidate.email);
    return { token };
  }

  private async exchangeCodeForToken(code: string, state: string): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      state,
      client_id: this.config.getOrThrow<string>('MEZON_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('MEZON_CLIENT_SECRET'),
      redirect_uri: this.config.getOrThrow<string>('MEZON_CALLBACK_URL'),
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ access_token: string }>(
          'https://oauth2.mezon.ai/oauth2/token',
          params.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );
      return response.data.access_token;
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown }; message?: string };
      this.logger.error('Token Exchange Error:', err.response?.data ?? err.message);
      throw new UnauthorizedException('Mã xác thực từ Mezon không hợp lệ');
    }
  }

  private async getMezonUserInfo(accessToken: string): Promise<MezonUserInfo> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<MezonUserInfo>('https://oauth2.mezon.ai/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      return response.data;
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown }; message?: string };
      this.logger.error('Get User Info Error:', err.response?.data ?? err.message);
      throw new InternalServerErrorException('Không thể lấy thông tin người dùng Mezon');
    }
  }

  private async validateAndSaveUser(userInfo: MezonUserInfo) {
    const email = userInfo.email ?? '';
    const fullName = userInfo.display_name ?? userInfo.username ?? userInfo.name ?? 'Mezon User';
    const mezonId = userInfo.mezon_id ?? userInfo.sub ?? '';

    let candidate = await this.prisma.candidate.findUnique({ where: { email } });

    if (!candidate) {
      candidate = await this.prisma.candidate.create({
        data: { email, fullName, mezonId, hash: '', address: '', age: 0, phoneNumber: '' },
      });
    } else if (!candidate.mezonId) {
      candidate = await this.prisma.candidate.update({
        where: { email },
        data: { mezonId },
      });
    }

    return candidate;
  }

  async signToken(candidateId: string, email: string): Promise<string> {
    const payload = { sub: candidateId, email };
    const secret = this.config.get<string>('JWT_SECRET');
    return this.jwt.signAsync(payload, { expiresIn: '15m', secret });
  }
}