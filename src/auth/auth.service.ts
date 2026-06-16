import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  ConflictException,
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
  ) {}

  // Sinh JWT State
  generateMezonState(): { state: string } {
    const nonce = crypto.randomBytes(16).toString('hex');
    const stateToken = this.jwtService.sign({ nonce }, { expiresIn: '5m' });
    return { state: stateToken };
  }
  async registerLocal(data: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.candidateRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const candidate = this.candidateRepository.create({
      email: data.email,
      fullName: data.fullName || 'EpicCV User',
      passwordHash: hashedPassword,
      provider: 'local',
      isVerified: false,
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
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordMatching = await bcrypt.compare(
      data.password,
      candidate.passwordHash,
    );
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Invalid email or password');
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
      const safeErrorMessage =
        axiosError.response?.data || axiosError.message || 'Unknown Error';

      console.error(`=== MEZON OAUTH ERROR ===`);
      console.error(`Status: ${axiosError.response?.status}`);
      console.error(`Error Details: ${JSON.stringify(safeErrorMessage)}`);
      // Đã loại bỏ hoàn toàn việc log code và redirect_uri

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

        // NẾU TỒN TẠI EMAIL NHƯNG CHƯA LINK MEZON ID -> CHẶN ĐĂNG NHẬP
        if (existingEmailCandidate) {
          throw new ConflictException(
            'Email này đã được đăng ký bằng tài khoản hệ thống. Vui lòng đăng nhập bằng mật khẩu và liên kết với Mezon trong Cài đặt.',
          );
        }
      }

      // NẾU EMAIL HOÀN TOÀN MỚI -> TẠO TÀI KHOẢN MỚI
      candidate = this.candidateRepository.create({
        mezonId,
        email,
        fullName,
        avatarUrl,
        provider: 'mezon',
        isVerified: true, // Mezon đã xác thực email giúp chúng ta, nên tạm thời set isVerified = true cho các tài khoản đăng nhập qua Mezon. Nếu sau này có yêu cầu xác thực email riêng, chúng ta có thể thêm bước xác thực email sau khi đăng nhập qua Mezon.
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
