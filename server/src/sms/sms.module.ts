import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { Msg91Service } from './msg91.service';
import { PrismaModule } from '../prisma.module';

@Global()
@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SmsController],
  providers: [SmsService, Msg91Service],
  exports: [SmsService],
})
export class SmsModule {}
