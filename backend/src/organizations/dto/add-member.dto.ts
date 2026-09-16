import {
  IsEmail,
  IsOptional,
  IsString,
  IsEnum,
  Matches,
  MinLength,
} from 'class-validator';

enum OrgRoleDto {
  ORG_ADMIN = 'ORG_ADMIN',
  HR = 'HR',
  MEMBER = 'MEMBER',
}

export class AddMemberDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid phone number' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(OrgRoleDto)
  role?: OrgRoleDto;
}
