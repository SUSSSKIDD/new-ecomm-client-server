import { IsNumber, Min } from 'class-validator';

export class ApproveParcelDto {
    @IsNumber()
    @Min(0)
    codAmount: number;
}
