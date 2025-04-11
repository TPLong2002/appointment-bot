import { Module } from '@nestjs/common';
import { AppointmentBotController } from './appointment-bot.controller';
import { AppointmentBotService } from './appointment-bot.service';
import { HtmlResponseService } from './html-response.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [AppointmentBotController],
  providers: [AppointmentBotService, HtmlResponseService],
  exports: [AppointmentBotService],
})
export class AppointmentBotModule {}
