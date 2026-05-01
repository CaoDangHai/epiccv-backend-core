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

  // ==========================================
  // 1. XỬ LÝ ĐĂNG KÝ LOCAL
  // ==========================================
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
      fullName: data.fullName || 'Người dùng EpicCV',
      passwordHash: hashedPassword,
      provider: 'local',
      isVerified: false,
    });

    const savedCandidate = await this.candidateRepository.save(candidate);

    // ✅ Tạo token
    const payload = {
      sub: savedCandidate.id,
      email: savedCandidate.email,
      mezonId: savedCandidate.mezonId,
    };
    const accessToken = this.jwtService.sign(payload);

    // ✅ Gửi về user info + token
    return {
      accessToken: accessToken,
      user: {
        id: savedCandidate.id,
        email: savedCandidate.email,
        fullName: savedCandidate.fullName,
        avatarUrl: savedCandidate.avatarUrl || null,
        provider: savedCandidate.provider,
        isVerified: savedCandidate.isVerified,
      },
    };
  }

  // ==========================================
  // 1.5 XỬ LÝ ĐĂNG NHẬP LOCAL
  // ==========================================
  async loginLocal(data: LoginDto): Promise<AuthResponseDto> {
    const candidate = await this.candidateRepository
      .createQueryBuilder('candidate')
      .where('candidate.email = :email', { email: data.email })
      .addSelect('candidate.passwordHash')
      .getOne();

    if (!candidate || !candidate.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordMatching = await bcrypt.compare(
      data.password,
      candidate.passwordHash,
    );
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const payload = {
      sub: candidate.id,
      email: candidate.email,
      mezonId: candidate.mezonId,
    };
    const accessToken = this.jwtService.sign(payload);

    // ✅ Gửi về user info + token
    return {
      accessToken: accessToken,
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

  // ==========================================
  // 2. XỬ LÝ OAUTH2 MEZON
  // ==========================================
  async loginWithMezon(code: string, state: string): Promise<AuthResponseDto> {
    const mezonToken = await this.exchangeCodeForToken(code, state);
    const userInfo = await this.getMezonUserInfo(mezonToken);
    const candidate = await this.validateAndSaveUser(userInfo);

    const payload = {
      sub: candidate.id,
      email: candidate.email,
      mezonId: candidate.mezonId,
    };
    const accessToken = this.jwtService.sign(payload);

    // ✅ Gửi về user info + token
    return {
      accessToken: accessToken,
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
        'Mã xác thực từ Mezon không hợp lệ hoặc đã hết hạn',
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
        'Không thể lấy thông tin người dùng từ Mezon',
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
        'Người dùng Mezon',
    );
    const avatarUrl: string = String(userInfo.avatar || userInfo.picture || '');

    let candidate: Candidate | null = await this.candidateRepository.findOne({
      where: { mezonId },
    });

    // TRƯỜNG HỢP 1: CHƯA CÓ MEZON ID NÀY TRONG HỆ THỐNG
    if (!candidate) {
      if (email) {
        const emailExist: Candidate | null =
          await this.candidateRepository.findOne({ where: { email } });
        if (emailExist) {
          // Đã có account Local dùng email này -> Link MezonId vào account Local
          emailExist.mezonId = mezonId;
          emailExist.avatarUrl = avatarUrl;
          return await this.candidateRepository.save(emailExist);
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
      return await this.candidateRepository.save(candidate);
    } else {
      // TRƯỜNG HỢP 2: ĐÃ CÓ ACCOUNT MEZON NÀY
      // KHÔI PHỤC BẢN FIX: Chỉ cập nhật email NẾU email đó CHƯA BỊ AI KHÁC CHIẾM DỤNG
      if (email && email !== candidate.email) {
        const emailExist = await this.candidateRepository.findOne({
          where: { email },
        });
        if (!emailExist) {
          candidate.email = email; // An toàn thì mới gán
        }
        // Nếu emailExist đã có -> Bỏ qua, giữ nguyên email cũ để tránh lỗi Unique Constraint 500
      }

      candidate.fullName = fullName || candidate.fullName;
      candidate.avatarUrl = avatarUrl || candidate.avatarUrl;
      return await this.candidateRepository.save(candidate);
    }
  }
}
