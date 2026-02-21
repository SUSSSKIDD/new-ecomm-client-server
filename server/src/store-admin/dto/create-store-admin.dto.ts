import { IsString, IsNotEmpty, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStoreAdminDto {
    @ApiProperty({ example: 'Ramesh Store Admin' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: '+919876543210' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\+91[6-9]\d{9}$/, {
        message: 'Phone number must be a valid Indian number +91xxxxxxxxx',
    })
    phone: string;

    @ApiProperty({ example: '1234', description: '4-digit PIN' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
    pin: string;

    @ApiProperty({ example: 'uuid-store-id' })
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    storeId: string;
}
