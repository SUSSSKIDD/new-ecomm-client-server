import { IsString, IsNumber, IsOptional, IsDateString, IsUUID, IsIn, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const LEDGER_PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const;

export class CreateLedgerEntryDto {
    @ApiProperty({ example: 'uuid-of-store' })
    @IsUUID()
    storeId: string;

    @ApiProperty({ example: '2026-02-21' })
    @IsDateString()
    date: string;

    @ApiProperty({ example: 500.00 })
    @IsNumber()
    @Min(0.01, { message: 'Amount must be greater than 0' })
    amount: number;

    @ApiProperty({ example: 'CASH', enum: LEDGER_PAYMENT_METHODS })
    @IsString()
    @IsIn([...LEDGER_PAYMENT_METHODS], { message: `Payment method must be one of: ${LEDGER_PAYMENT_METHODS.join(', ')}` })
    paymentMethod: string;

    @ApiPropertyOptional({ example: 'Monthly rent payment' })
    @IsString()
    @IsOptional()
    referenceNotes?: string;
}
