import { IsString, Matches, IsNotEmpty } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Phone number must be a valid Indian number +91xxxxxxxxx',
  })
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Phone number must be a valid Indian number +91xxxxxxxxx',
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class StoreManagerLoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Phone number must be a valid Indian number +91xxxxxxxxx',
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  pin: string;
}
