import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { LoginDto } from './login.dto';

export class RegisterDto extends LoginDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString({ message: 'Turnstile token phải là chuỗi' })
  @IsNotEmpty({ message: 'Thiếu mã xác thực Cloudflare Turnstile (Chống Bot)' })
  turnstileToken!: string;
} 