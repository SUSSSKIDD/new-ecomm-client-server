import { IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ParcelStatus } from '@prisma/client';

export class ParcelQueryDto {
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    limit?: number = 10;

    @IsOptional()
    @IsEnum(ParcelStatus)
    status?: ParcelStatus;
}
