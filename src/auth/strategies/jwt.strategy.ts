import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../../database/entities/candidate.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,

    @InjectRepository(Candidate)
    private readonly candidateRepository: Repository<Candidate>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: { sub: string; email: string; mezonId: string }) {
    // 1. Tìm User mới nhất trong Database
    const candidate = await this.candidateRepository.findOne({
      where: { id: payload.sub },
    });

    // 2. Nếu User đã bị xóa hoặc không tồn tại -> Block
    if (!candidate) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khóa.',
      );
    }

    // 3. Nếu User chưa xác minh email -> Block
    if (candidate.isVerified === false) {
      throw new UnauthorizedException(
        'Tài khoản chưa được xác minh. Vui lòng kiểm tra email.',
      );
    }

    // 4. Trả về thông tin an toàn gắn vào req.user
    return {
      sub: candidate.id,
      email: candidate.email,
      mezonId: candidate.mezonId,
      isVerified: candidate.isVerified,
    };
  }
}
