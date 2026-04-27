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
import { AxiosError } from 'axios'; // Bổ sung import AxiosError để bắt lỗi an toàn

// ==========================================
// ĐỊNH NGHĨA CÁC KIỂU DỮ LIỆU (INTERFACE) ĐỂ TRÁNH DÙNG 'any'
// ==========================================
interface RegisterDto {
  email: string;
  password: string; // Bắt buộc phải có để bcrypt không báo lỗi
  fullName?: string;
}

interface LoginDto {
  email: string;
  password: string; // Bắt buộc phải có
}

interface MezonUserInfoDto {
  mezon_id?: string;
  sub?: string;
  email?: string;
  display_name?: string;
  username?: string;
  name?: string;
  avatar?: string;
  picture?: string;
}

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
  // 1. XỬ LÝ ĐĂNG KÝ LOCAL (EMAIL & MẬT KHẨU)
  // ==========================================
  async registerLocal(data: RegisterDto): Promise<{ message: string }> {
    // Bước 1: Kiểm tra xem Email đã tồn tại chưa
    const existingUser = await this.candidateRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }

    // Bước 2: Mã hóa mật khẩu (data.password đã được đảm bảo là string)
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Bước 3: Tạo user mới
    const candidate = this.candidateRepository.create({
      email: data.email,
      fullName: data.fullName || 'Người dùng EpicCV',
      passwordHash: hashedPassword,
      provider: 'local',
      isVerified: false,
    });

    await this.candidateRepository.save(candidate);

    return { message: 'Đăng ký thành công' };
  }

  // ==========================================
  // 1.5 XỬ LÝ ĐĂNG NHẬP LOCAL
  // ==========================================
  async loginLocal(data: LoginDto): Promise<{ accessToken: string }> {
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

    return { accessToken };
  }

  // ==========================================
  // 2. XỬ LÝ OAUTH2 MEZON
  // ==========================================
  async loginWithMezon(
    code: string,
    state: string,
  ): Promise<{ accessToken: string }> {
    const mezonToken = await this.exchangeCodeForToken(code, state);
    const userInfo = await this.getMezonUserInfo(mezonToken);
    const candidate = await this.validateAndSaveUser(userInfo);

    const payload = {
      sub: candidate.id,
      email: candidate.email,
      mezonId: candidate.mezonId,
    };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
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
      // SỬA: Ép kiểu an toàn về AxiosError để tránh lỗi Unsafe member access
      const axiosError = e as AxiosError;
      console.error(
        'Mezon Token Exchange Error:',
        axiosError.response?.data || axiosError.message,
      );
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
      // SỬA: Bỏ biến 'e' vì không dùng đến, tránh lỗi "defined but never used"
      throw new InternalServerErrorException(
        'Không thể lấy thông tin người dùng từ Mezon',
      );
    }
  }

  private async validateAndSaveUser(
    userInfo: MezonUserInfoDto,
  ): Promise<Candidate> {
    // 1. Ép kiểu rõ ràng về chuỗi (string) để ESLint không vặn vẹo
    const mezonId: string = String(userInfo.mezon_id || userInfo.sub || '');
    const email: string | null = userInfo.email ? String(userInfo.email) : null;
    const fullName: string = String(
      userInfo.display_name ||
        userInfo.username ||
        userInfo.name ||
        'Người dùng Mezon',
    );
    const avatarUrl: string = String(userInfo.avatar || userInfo.picture || '');

    // 2. Định nghĩa rõ candidate là kiểu Candidate hoặc null
    let candidate: Candidate | null = await this.candidateRepository.findOne({
      where: { mezonId },
    });

    if (!candidate) {
      if (email) {
        // Khai báo rõ kiểu Candidate | null cho emailExist
        const emailExist: Candidate | null =
          await this.candidateRepository.findOne({ where: { email } });

        if (emailExist) {
          // Lúc này ESLint đã biết chắc chắn emailExist là một Candidate
          emailExist.mezonId = mezonId;
          emailExist.avatarUrl = avatarUrl;
          return await this.candidateRepository.save(emailExist);
        }
      }

      // Tạo mới user
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
      // Cập nhật user cũ
      candidate.email = email || candidate.email;
      candidate.fullName = fullName || candidate.fullName;
      candidate.avatarUrl = avatarUrl || candidate.avatarUrl;
      return await this.candidateRepository.save(candidate);
    }
  }
}
