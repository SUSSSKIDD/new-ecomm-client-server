import { IsEnum, IsNumber, IsOptional, IsString, Min, Max, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelCategory } from '@prisma/client';

export class ParcelAddressDto {
    @IsString()
    type: string;

    @IsOptional()
    @IsString()
    houseNo?: string;

    @IsString()
    street: string;

    @IsString()
    city: string;

    @IsOptional()
    @IsString()
    state?: string;

    @IsString()
    zipCode: string;

    @IsOptional()
    @IsString()
    landmark?: string;

    @IsOptional()
    @IsString()
    mapsLink?: string;

    @IsOptional()
    @IsString()
    recipientName?: string;

    @IsOptional()
    @IsString()
    recipientPhone?: string;

    @IsNumber()
    @Min(-90)
    @Max(90)
    lat: number;

    @IsNumber()
    @Min(-180)
    @Max(180)
    lng: number;
}

export class CreateParcelOrderDto {
    @ValidateNested()
    @Type(() => ParcelAddressDto)
    pickupAddress: ParcelAddressDto;

    @ValidateNested()
    @Type(() => ParcelAddressDto)
    dropAddress: ParcelAddressDto;

    @IsEnum(ParcelCategory)
    category: ParcelCategory;

    @IsOptional()
    @IsString()
    categoryOther?: string;

    @IsNumber()
    @Min(0.01)
    weight: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    length?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    width?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    height?: number;

    @IsDateString()
    pickupTime: string;

    @IsDateString()
    dropTime: string;
}
