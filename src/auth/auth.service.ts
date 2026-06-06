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
import { AxiosError } from 'axios';

import {
  LoginDto,
  AuthResponseDto,
  MezonUserInfoDto,
  RegisterDto,
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

  async loginWithMezon(code: string, state: string): Promise<AuthResponseDto> {
    const mezonToken = await this.exchangeCodeForToken(code, state);
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
      console.error('=== MEZON ERROR ===');
      console.error('Status:', axiosError.response?.status);
      console.error('Data:', JSON.stringify(axiosError.response?.data));
      console.error('redirect_uri:', redirectUri);
      console.error('code:', code);
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
        if (existingEmailCandidate) {
          existingEmailCandidate.mezonId = mezonId;
          existingEmailCandidate.avatarUrl = avatarUrl;
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
