import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UUID } from '../../../common/types/uuid.type';

export class CreatePeriodDTO {
  @ApiProperty({ example: '2026-08' })
  period_name!: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  start_date!: Date;

  @ApiProperty({ example: '2026-08-31T23:59:59.000Z' })
  end_date!: Date;
}

export class UploadBankStatementDTO {
  @ApiProperty({ type: 'string', format: 'binary', description: 'CSV file containing bank statement' })
  file!: any;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  bank_account_id!: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  from_date?: string;

  @ApiPropertyOptional({ example: '2026-08-31T23:59:59.000Z' })
  to_date?: string;
}

export class MatchItemDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  statementId!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  paymentId!: string;
}

export class ConfirmReconciliationDTO {
  @ApiProperty({ type: [MatchItemDTO] })
  matches!: MatchItemDTO[];
}

export class JournalEntryLineDTO {
  @ApiProperty() account_id!: string;
  @ApiPropertyOptional() cost_center_id?: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() debit!: number;
  @ApiProperty() credit!: number;
}

export class CreateJournalEntryDTO {
  @ApiProperty() entry_date!: Date;
  @ApiProperty() period_id!: string;
  @ApiPropertyOptional() reference_type?: string;
  @ApiPropertyOptional() reference_id?: string;
  @ApiPropertyOptional() reference_number?: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ type: [JournalEntryLineDTO] }) lines!: JournalEntryLineDTO[];
}
