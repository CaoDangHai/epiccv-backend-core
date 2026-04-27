import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as argon from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { SignInDto, SignUpDto } from './dto';

interface CandidateResponse {
  address?: string;
  age?: number;
  createdAt: Date;
  email: string;
  fullName: string;
  id: string;
  phoneNumber?: string;
}

interface SignupResponse {
  candidate: CandidateResponse;
  token: string;
}

export interface OAuthProfile {
  accessToken: string;
  email: string;
  fullName: string;
  id: string;
  mezonId: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(
    AuthService.name,
  );

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signup(dto: SignUpDto) {
    // generate the password hash
    const hash = await argon.hash(dto.password);

    try {
      // save the new user in the db
      const candidate =
        await this.prisma.candidate.create({
          data: {
            email: dto.email,
            hash: hash,
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

      // return the saved user
      return {
        token: await this.signToken(
          candidate.id,
          candidate.email,
        ),
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
    } catch (error) {
      if (
        error instanceof
        PrismaClientKnownRequestError
      ) {
        if (error.code === 'P2002') {
          throw new ForbiddenException(
            'Email is duplate',
          );
        }
      }
      throw error;
    }
  }

  async signin(dto: SignInDto) {
    // find the user by email
    // if user does not exist throw exeption
    const candidate =
      await this.prisma.candidate.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (!candidate)
      throw new ForbiddenException(
        'Credentials incorrect',
      );
    // compare password
    const pwMatches = await argon.verify(
      candidate.hash,
      dto.password,
    );

    // if password incorrect throw exception
    if (!pwMatches)
      throw new ForbiddenException(
        'Credentials incorrect',
      );

    // send back the candidate
    return {
      token: await this.signToken(
        candidate.id,
        candidate.email,
      ),
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

  async handleMezonOAuth(
    profile: OAuthProfile,
  ): Promise<SignupResponse> {
    try {
      let candidate =
        await this.prisma.candidate.findUnique({
          where: { email: profile.email },
        });

      if (!candidate) {
        candidate =
          await this.prisma.candidate.create({
            data: {
              address: '',
              age: 0,
              email: profile.email,
              fullName:
                profile.fullName || profile.email,
              hash: '',
              mezonId: profile.id,
              phoneNumber: '',
            },
          });
      }

      return {
        candidate: {
          address: candidate.address || undefined,
          age: candidate.age || undefined,
          createdAt: candidate.createdAt,
          email: candidate.email,
          fullName:
            candidate.fullName || 'No name',
          id: candidate.id,
          phoneNumber:
            candidate.phoneNumber || undefined,
        },
        token: await this.signToken(
          candidate.id,
          candidate.email,
        ),
      };
    } catch (error) {
      this.logger.error(
        `OAuth error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error
          ? error.stack
          : undefined,
      );
      throw new InternalServerErrorException(
        'OAuth processing failed',
      );
    }
  }

  async signToken(
    candidateId: string,
    email: string,
  ): Promise<string> {
    const payload = { sub: candidateId, email };

    const secret =
      this.config.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error(
        'JWT_SECRET is missing in .env',
      );
    }
    const token: string =
      await this.jwt.signAsync(payload, {
        expiresIn: '15m',
        secret,
      });

    return token;
  }
}
