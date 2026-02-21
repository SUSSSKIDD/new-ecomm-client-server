import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class RemoveImageDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl: string;
}
