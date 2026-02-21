import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiPropertyOptional({ description: 'User display name' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;
}
