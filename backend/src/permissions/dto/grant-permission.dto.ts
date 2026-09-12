import {
  IsEmail,
  IsOptional,
  IsString,
  IsArray,
  IsEnum,
  IsDateString,
  Matches,
  MinLength,
  ArrayMinSize,
} from 'class-validator';

enum PermissionLevel {
  VIEWER = 'VIEWER',
  COMMENTER = 'COMMENTER',
  EDITOR = 'EDITOR',
  FULL_ACCESS = 'FULL_ACCESS',
}

export class GrantPermissionDto {
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
  @IsArray()
  @IsString({ each: true })
  workbookIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sheetIds?: string[];

  @IsOptional()
  @IsEnum(PermissionLevel)
  permission?: PermissionLevel;

  /** ISO date string. null/undefined = permanent access */
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
