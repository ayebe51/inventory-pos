import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDTO {
  @ApiProperty({ example: 'johndoe' })
  username!: string;

  @ApiProperty({ example: 'John Doe' })
  full_name!: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'password123' })
  password?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  role_id!: string;
}

export class UpdateUserDTO {
  @ApiPropertyOptional({ example: 'johndoe' })
  username?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  full_name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  role_id?: string;

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}

export class CreateRoleDTO {
  @ApiProperty({ example: 'MANAGER' })
  name!: string;

  @ApiPropertyOptional({ example: 'Store Manager' })
  description?: string;
  
  @ApiProperty({ type: [String], example: ['INVENTORY.VIEW', 'INVENTORY.UPDATE'] })
  permissions!: string[];
}

export class UpdateRoleDTO {
  @ApiPropertyOptional({ example: 'MANAGER' })
  name?: string;

  @ApiPropertyOptional({ example: 'Store Manager' })
  description?: string;
  
  @ApiPropertyOptional({ type: [String], example: ['INVENTORY.VIEW', 'INVENTORY.UPDATE'] })
  permissions?: string[];
}
