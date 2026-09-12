import { IsEmail, IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid phone number' })
  phone?: string;

  @IsString()
  @MinLength(8)
  password: string;
}
