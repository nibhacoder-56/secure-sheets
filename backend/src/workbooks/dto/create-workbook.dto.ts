import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateWorkbookDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
