import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentBotModule } from './appointment-bot/appointment-bot.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    AppointmentBotModule,
    ConfigModule.forRoot({
      isGlobal: true, // Để biến môi trường khả dụng trên toàn bộ ứng dụng.
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
