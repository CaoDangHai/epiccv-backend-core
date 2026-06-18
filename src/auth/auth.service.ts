import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Candidate } from '@entities/candidate.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AxiosError } from 'axios';

import {
  LoginDto,
  AuthResponseDto,
  MezonUserInfoDto,
  RegisterDto,
  MezonLoginDto,
} from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRepository(Candidate)
    private readonly candidateRepository: Repository<Candidate>,
  ) { }

  generateMezonState(): { state: string } {
    const nonce = crypto.randomBytes(16).toString('hex');
    const stateToken = this.jwtService.sign({ nonce }, { expiresIn: '15m' });
    return { state: stateToken };
  }

  async registerLocal(data: RegisterDto): Promise<AuthResponseDto> {
    // 1. Xác thực Cloudflare Turnstile qua HTTP API
    const formData = new URLSearchParams();
    formData.append('secret', this.configService.get<string>('TURNSTILE_SECRET_KEY') || '');
    formData.append('response', data.turnstileToken);

    let isTurnstileSuccess = false;
    try {
      const turnstileRes = await firstValueFrom(
        this.httpService.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formData.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
      isTurnstileSuccess = turnstileRes.data.success;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;

      const errorData = (axiosError.response?.data as any);
      const errorMessage = errorData?.message || axiosError.message;

      console.error("=== LỖI TURNSTILE CHÍNH XÁC ===", errorMessage);
      throw new BadRequestException('Lỗi kết nối đến máy chủ Cloudflare.');
    }

    if (!isTurnstileSuccess) {
      throw new BadRequestException('Xác thực Bot (Turnstile) thất bại. Vui lòng tick lại vào ô xác minh.');
    }

    // 2. Kiểm tra Account Enumeration
    const existingUser = await this.candidateRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      // Làm mờ lỗi thay vì báo thẳng "EMAIL_ALREADY_EXISTS"
      throw new BadRequestException('Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const candidate = this.candidateRepository.create({
      email: data.email,
      fullName: data.fullName || 'EpicCV User',
      passwordHash: hashedPassword,
      provider: 'local',
      isVerified: true,
    });

    const savedCandidate = await this.candidateRepository.save(candidate);
    return this.createAuthResponse(savedCandidate);
  }

  async loginLocal(data: LoginDto): Promise<AuthResponseDto> {
    const candidate = await this.candidateRepository
      .createQueryBuilder('candidate')
      .where('candidate.email = :email', { email: data.email })
      .addSelect('candidate.passwordHash')
      .getOne();

    if (!candidate || !candidate.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    const isPasswordMatching = await bcrypt.compare(
      data.password,
      candidate.passwordHash,
    );
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    // TỪ CHỐI CẤP TOKEN NẾU TÀI KHOẢN CHƯA XÁC MINH
    if (candidate.isVerified === false) {
      throw new UnauthorizedException('Tài khoản chưa được xác minh. Vui lòng kiểm tra email để kích hoạt.');
    }

    return this.createAuthResponse(candidate);
  }

  async loginWithMezon(dto: MezonLoginDto): Promise<AuthResponseDto> {
    try {
      this.jwtService.verify(dto.state);
    } catch {
      throw new UnauthorizedException(
        'State OAuth không hợp lệ hoặc đã hết hạn (Phát hiện nghi ngờ CSRF).',
      );
    }

    const mezonToken = await this.exchangeCodeForToken(dto.code, dto.state);
    const userInfo = await this.getMezonUserInfo(mezonToken);
    const candidate = await this.validateAndSaveUser(userInfo);

    return this.createAuthResponse(candidate);
  }

  private createAuthResponse(candidate: Candidate): AuthResponseDto {
    const payload = {
      sub: candidate.id,
      email: candidate.email,
      mezonId: candidate.mezonId,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: candidate.id,
        email: candidate.email,
        fullName: candidate.fullName,
        avatarUrl: candidate.avatarUrl || null,
        provider: candidate.provider,
        isVerified: candidate.isVerified,
      },
    };
  }

  private async exchangeCodeForToken(
    code: string,
    state: string,
  ): Promise<string> {
    const clientId = this.configService.get<string>('MEZON_CLIENT_ID')!;
    const clientSecret = this.configService.get<string>('MEZON_CLIENT_SECRET')!;
    const redirectUri = this.configService.get<string>('MEZON_REDIRECT_URI')!;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      state,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ access_token: string }>(
          'https://oauth2.mezon.ai/oauth2/token',
          params.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );
      return response.data.access_token;
    } catch (e: unknown) {
      const axiosError = e as AxiosError;
      console.error(`=== MEZON OAUTH ERROR ===`);
      console.error(`Status: ${axiosError.response?.status}`);
      throw new UnauthorizedException(
        'Mezon authorization code is invalid or expired',
      );
    }
  }

  private async getMezonUserInfo(
    accessToken: string,
  ): Promise<MezonUserInfoDto> {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://oauth2.mezon.ai/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      return response.data as MezonUserInfoDto;
    } catch {
      throw new InternalServerErrorException(
        'Unable to retrieve Mezon user information',
      );
    }
  }

  private async validateAndSaveUser(
    userInfo: MezonUserInfoDto,
  ): Promise<Candidate> {
    const mezonId: string = String(userInfo.mezon_id || userInfo.sub || '');
    const email: string | null = userInfo.email ? String(userInfo.email) : null;
    const fullName: string = String(
      userInfo.display_name ||
      userInfo.username ||
      userInfo.name ||
      'Mezon User',
    );
    const avatarUrl: string = String(userInfo.avatar || userInfo.picture || '');

    let candidate: Candidate | null = await this.candidateRepository.findOne({
      where: { mezonId },
    });

    if (!candidate) {
      if (email) {
        const existingEmailCandidate = await this.candidateRepository.findOne({
          where: { email },
        });

        // NẾU TỒN TẠI EMAIL DO LOCAL TẠO TRƯỚC ĐÓ -> TỊCH THU TÀI KHOẢN
        if (existingEmailCandidate) {
          existingEmailCandidate.mezonId = mezonId;
          existingEmailCandidate.provider = 'mezon'; // Đổi định danh sang Mezon
          // Đổi mật khẩu thành chuỗi ngẫu nhiên để vô hiệu hóa mật khẩu Local cũ
          existingEmailCandidate.passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
          existingEmailCandidate.isVerified = true;

          if (avatarUrl) existingEmailCandidate.avatarUrl = avatarUrl;
          if (fullName) existingEmailCandidate.fullName = fullName;

          return this.candidateRepository.save(existingEmailCandidate);
        }
      }

      candidate = this.candidateRepository.create({
        mezonId,
        email,
        fullName,
        avatarUrl,
        provider: 'mezon',
        isVerified: true,
      });
      return this.candidateRepository.save(candidate);
    }

    if (email && email !== candidate.email) {
      const existingEmailCandidate = await this.candidateRepository.findOne({
        where: { email },
      });
      if (!existingEmailCandidate) {
        candidate.email = email;
      }
    }

    candidate.fullName = fullName || candidate.fullName;
    candidate.avatarUrl = avatarUrl || candidate.avatarUrl;
    return this.candidateRepository.save(candidate);
  }
} 