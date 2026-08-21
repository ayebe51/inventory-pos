import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveRequestDTO {
  @ApiPropertyOptional({ example: 'Disetujui untuk diproses' })
  notes?: string;
}

export class RejectRequestDTO {
  @ApiProperty({ example: 'Budget tidak mencukupi' })
  reason!: string;
}
