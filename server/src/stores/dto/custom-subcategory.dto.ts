import { IsString, MinLength, MaxLength, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { STORE_CATEGORIES } from '../../common/constants/store-categories';

export class CreateCustomSubcategoryDto {
  @ApiProperty({ description: 'Name of the new subcategory' })
  @IsString()
  @MinLength(2, { message: 'Subcategory name must be at least 2 characters' })
  @MaxLength(100)
  name: string;
}

export class AdminCreateCustomSubcategoryDto extends CreateCustomSubcategoryDto {
  @ApiProperty({ enum: STORE_CATEGORIES, description: 'Store type to add subcategory under' })
  @IsString()
  @IsIn([...STORE_CATEGORIES])
  storeType: string;
}

export class UpsertCategoryConfigDto {
  @ApiProperty({ enum: STORE_CATEGORIES, description: 'Store type' })
  @IsString()
  @IsIn([...STORE_CATEGORIES])
  storeType: string;

  @ApiProperty({ description: 'Subcategory name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  subcategory: string;

  @ApiProperty({ enum: ['NONE', 'PHOTO_UPLOAD', 'DESIGN_UPLOAD'], description: 'Upload type' })
  @IsString()
  @IsIn(['NONE', 'PHOTO_UPLOAD', 'DESIGN_UPLOAD'])
  uploadType: string;
}
