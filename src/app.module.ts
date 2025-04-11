import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentBotModule } from './appointment-bot/appointment-bot.module';
import { ConfigModule } from '@nestjs/config';
import { AppointmentBotWithStructuredOutputModule } from './appointment-bot-with-structured-output/appointment-bot.module';
import { AppointmentBotUseToolSummarizeInfoModule } from './appointment-bot-use-tool-summarize-info/appointment-bot.module';

@Module({
  imports: [
    AppointmentBotModule,
    ConfigModule.forRoot({
      isGlobal: true, // Để biến môi trường khả dụng trên toàn bộ ứng dụng.
    }),
    AppointmentBotWithStructuredOutputModule,
    AppointmentBotUseToolSummarizeInfoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
