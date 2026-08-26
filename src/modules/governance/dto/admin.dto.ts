import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsUUID,
  IsBoolean,
  IsOptional,
  IsString,
  IsArray,
  ArrayNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateUserDTO {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  full_name!: string;

  @ApiProperty({ example: 'S3cureP@ss!' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiProperty({ type: [String], example: ['123e4567-e89b-12d3-a456-426614174000'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  role_ids!: string[];
}

export class UpdateUserDTO {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  full_name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ type: [String], example: ['123e4567-e89b-12d3-a456-426614174000'] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  role_ids?: string[];
}

export class CreateRoleDTO {
  @ApiProperty({ example: 'Store_Manager' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 'Store Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ type: [String], example: ['123e4567-e89b-12d3-a456-426614174000'] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  permission_ids!: string[];
}

export class UpdateRoleDTO {
  @ApiPropertyOptional({ example: 'Store_Manager' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'Store Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['123e4567-e89b-12d3-a456-426614174000'] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  permission_ids?: string[];
}
