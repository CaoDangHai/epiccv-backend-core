import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
// import {User, Bookmark} from '@prisma/client'
import { PrismaService } from 'src/prisma/prisma.service';
import { SignInDto, SignUpDto } from './dto';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AuthService {
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
