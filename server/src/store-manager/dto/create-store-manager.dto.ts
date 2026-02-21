import { IsString, IsNotEmpty, Matches, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStoreManagerDto {
    @ApiProperty({ example: 'John Manager' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: '+919876543210' })
    @IsString()
    @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone must be a valid Indian mobile number (+91XXXXXXXXXX)' })
    phone: string;

    @ApiProperty({ example: '1234' })
    @IsString()
    @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
    pin: string;

    @ApiProperty({ example: 'uuid-of-store' })
    @IsUUID()
    storeId: string;
}
