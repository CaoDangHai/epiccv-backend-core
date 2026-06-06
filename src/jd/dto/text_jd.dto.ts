import { IsString, IsOptional } from 'class-validator';

export class TextJdDto {
  @IsString()
  @IsOptional()
  content?: string;
}
