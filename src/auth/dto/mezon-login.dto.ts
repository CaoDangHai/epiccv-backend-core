import { IsNotEmpty, IsString } from 'class-validator';

export class MezonLoginDto {
  @IsString({ message: 'Auth code phải là chuỗi' })
  @IsNotEmpty({ message: 'Auth code không được để trống' })
  code!: string;

  @IsString({ message: 'State phải là chuỗi' })
  @IsNotEmpty({ message: 'State không được để trống (CSRF Protection)' })
  state!: string;
}
