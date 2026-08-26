import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveRequestDTO {
  @ApiPropertyOptional({ example: 'Disetujui untuk diproses' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectRequestDTO {
  @ApiProperty({ example: 'Budget tidak mencukupi' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
