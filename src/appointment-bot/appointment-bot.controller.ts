import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { AppointmentBotService } from './appointment-bot.service';
import { HtmlResponseService } from './html-response.service';
import { text } from 'stream/consumers';

@Controller('appointment-bot')
export class AppointmentBotController {
  private readonly logger = new Logger(AppointmentBotController.name);
  constructor(
    private readonly appointmentBotService: AppointmentBotService,
    private readonly htmlResponseService: HtmlResponseService,
  ) {}

  @Post('chat')
  async chat(
    @Body()
    body: {
      userId: string;
      message: string;
      variables?: Record<string, string>;
    },
  ) {
    const { userId, message, variables = {} } = body;

    this.logger.log(`Received message from ${userId}: ${message}`);
    this.logger.log(`Received variables: ${JSON.stringify(variables)}`);

    // Xử lý yêu cầu đặt lịch thông thường
    const response = await this.appointmentBotService.processMessage(
      userId,
      message,
      variables,
    );

    // Kiểm tra và tạo HTML nếu cần
    const htmlResponse = this.htmlResponseService.processResponseForHtml(
      response.text,
    );

    // Hiển thị thông tin summary log
    this.logger.log(`Summary Info Log:`);
    this.logger.log(`User Message: ${message}`);
    this.logger.log(`Token Info: ${JSON.stringify(response.token)}`);
    this.logger.log(`Variables: ${JSON.stringify(response.variables)}`);
    this.logger.log(
      `System Prompt (first 100 chars): ${response.systemPrompt?.slice(0, 100) || ''}...`,
    ); // Hiển thị 100 ký tự đầu của system prompt

    // Merge the HTML content with the original response
    return {
      ...htmlResponse,
      // text: response.text,
      // htmlContent: '',
      variables: response.variables,
      token: response.token,
      systemPrompt: response.systemPrompt,
    };
  }
}
