import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsDate,
  IsNotEmpty,
  Min,
  MaxLength,
  ValidateNested,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { UUID } from '../../../common/types/uuid.type';

export class CreatePeriodDTO {
  @ApiProperty({ example: '2026-08' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  period_name!: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  start_date!: Date;

  @ApiProperty({ example: '2026-08-31T23:59:59.000Z' })
  @Type(() => Date)
  @IsDate()
  end_date!: Date;
}

export class UploadBankStatementDTO {
  @ApiProperty({ type: 'string', format: 'binary', description: 'CSV file containing bank statement' })
  file!: any;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  bank_account_id!: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  from_date?: string;

  @ApiPropertyOptional({ example: '2026-08-31T23:59:59.000Z' })
  @IsOptional()
  @IsString()
  to_date?: string;
}

export class MatchItemDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  statementId!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  paymentId!: string;
}

export class ConfirmReconciliationDTO {
  @ApiProperty({ type: [MatchItemDTO] })
  @ValidateNested({ each: true })
  @Type(() => MatchItemDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  matches!: MatchItemDTO[];
}

export class JournalEntryLineDTO {
  @ApiProperty() @IsUUID() account_id!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() cost_center_id?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) debit!: number;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) credit!: number;
}

export class CreateJournalEntryDTO {
  @ApiProperty() @Type(() => Date) @IsDate() entry_date!: Date;

  @ApiProperty() @IsUUID() period_id!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) reference_type?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() reference_id?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) reference_number?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;

  @ApiProperty({ type: [JournalEntryLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  lines!: JournalEntryLineDTO[];
}
