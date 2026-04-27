import { Transform } from 'class-transformer';
import { SignInDto } from './signIn.dto';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class SignUpDto extends SignInDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsOptional() // Hoặc IsNotEmpty tùy bạn
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsOptional()
  age?: number;
}
