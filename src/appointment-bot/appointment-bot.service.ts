import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages'; // Import BaseMessage
import { ToolMessage } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  createOpenAIFunctionsAgent,
  AgentExecutor,
  createToolCallingAgent,
} from 'langchain/agents';

import { Doctor, Appointment } from './appointment-bot.interfaces';
import { createDoctorCards } from './html-templates/doctor-cards.template';
import {
  BookAppointmentToConfirmTool,
  ListDepartmentsTool,
  CheckDoctorAvailableDaysTool,
  CheckDoctorTimeSlotsTool,
  GetDoctorInfoTool,
  ChangeDoctorTool,
  FindDoctorByNameTool,
  FindDepartmentBySymptomsTool,
  SummarizeInfoTool,
  ConfirmAppointmentTool,
} from './appointment-bot.tools';
import {
  bookAppointment,
  listDepartments,
  getDoctorInfo,
  changeDoctor,
  checkDoctorAvailableDays,
  checkDoctorTimeSlots,
  findDoctorByName,
  findDepartmentBySymptoms,
  confirmAppointment,
} from './appointment-bot-methods';
import { ChatAnthropic } from '@langchain/anthropic';

@Injectable()
export class AppointmentBotService {
  private readonly logger = new Logger(AppointmentBotService.name);
  private readonly model: ChatOpenAI | any;
  private chatHistories: Map<string, BaseMessage[]> = new Map(); // Store chat history per user

  // Lưu thông tin bác sĩ đã chọn từ giao diện
  public lastSelectedDoctor: {
    doctorId: string;
    doctorName: string;
    departmentId: string;
    date: string;
    time: string;
  } | null = null;

  // Danh sách khoa
  public readonly departments = [
    {
      id: 'dept_1',
      name: 'Khoa Nội tổng hợp',
      doctors: ['Bác sĩ Nguyễn Văn A', 'Bác sĩ Trần Thị B'],
    },
    {
      id: 'dept_2',
      name: 'Khoa Ngoại',
      doctors: ['Bác sĩ Lê Văn C', 'Bác sĩ Phạm Thị D'],
    },
    {
      id: 'dept_3',
      name: 'Khoa Tim mạch',
      doctors: ['Bác sĩ Hoàng Văn E', 'Bác sĩ Ngô Thị F'],
    },
    {
      id: 'dept_4',
      name: 'Khoa Thần kinh',
      doctors: ['Bác sĩ Hoàng Văn E', 'Bác sĩ Vũ Thị H'],
    },
    {
      id: 'dept_5',
      name: 'Khoa Da liễu',
      doctors: ['Bác sĩ Đinh Văn I', 'Bác sĩ Lý Thị K'],
    },
  ];

  // Danh sách bác sĩ
  public readonly doctors: Doctor[] = [
    {
      id: 'doc_1',
      name: 'Nguyễn Văn A',
      departmentId: 'dept_1',
      specialization: 'Nội tổng quát, Tiêu hóa',
      experience: '15 năm kinh nghiệm, Phó Giáo sư',
      availability: ['Thứ 2, 4, 6: 8:00-12:00', 'Thứ 3, 5: 13:00-17:00'],
    },
    {
      id: 'doc_2',
      name: 'Trần Thị B',
      departmentId: 'dept_1',
      specialization: 'Nội tiết, Hô hấp',
      experience: '10 năm kinh nghiệm, Tiến sĩ Y khoa',
      availability: ['Thứ 2, 3, 5: 8:00-12:00', 'Thứ 4, 6: 13:00-17:00'],
    },
    {
      id: 'doc_3',
      name: 'Lê Văn C',
      departmentId: 'dept_2',
      specialization: 'Ngoại tổng quát, Chấn thương',
      experience: '20 năm kinh nghiệm, Giáo sư',
      availability: ['Thứ 2-6: 8:00-12:00'],
    },
    {
      id: 'doc_4',
      name: 'Phạm Thị D',
      departmentId: 'dept_2',
      specialization: 'Phẫu thuật thẩm mỹ, Vi phẫu',
      experience: '12 năm kinh nghiệm, Thạc sĩ Y khoa',
      availability: ['Thứ 2-6: 13:00-17:00'],
    },
    {
      id: 'doc_5',
      name: 'Hoàng Văn E',
      departmentId: 'dept_3',
      specialization: 'Tim mạch can thiệp',
      experience: '18 năm kinh nghiệm, Phó Giáo sư',
      availability: ['Thứ 2, 4, 6: 8:00-17:00'],
    },
    {
      id: 'doc_6',
      name: 'Ngô Thị F',
      departmentId: 'dept_3',
      specialization: 'Rối loạn nhịp tim, Siêu âm tim',
      experience: '14 năm kinh nghiệm, Tiến sĩ Y khoa',
      availability: ['Thứ 3, 5, 7: 8:00-17:00'],
    },
    {
      id: 'doc_7',
      name: 'Hoàng Văn E',
      departmentId: 'dept_4',
      specialization: 'Thần kinh tổng quát, Đột quỵ',
      experience: '16 năm kinh nghiệm, Phó Giáo sư',
      availability: ['Thứ 2, 3, 4: 8:00-12:00', 'Thứ 5, 6: 13:00-17:00'],
    },
    {
      id: 'doc_8',
      name: 'Vũ Thị H',
      departmentId: 'dept_4',
      specialization: 'Bệnh Parkinson, Động kinh',
      experience: '11 năm kinh nghiệm, Tiến sĩ Y khoa',
      availability: ['Thứ 2, 3, 4: 13:00-17:00', 'Thứ 5, 6: 8:00-12:00'],
    },
    {
      id: 'doc_9',
      name: 'Đinh Văn I',
      departmentId: 'dept_5',
      specialization: 'Da liễu tổng quát, Nấm da',
      experience: '13 năm kinh nghiệm, Thạc sĩ Y khoa',
      availability: ['Thứ 2, 4, 6: 8:00-17:00'],
    },
    {
      id: 'doc_10',
      name: 'Lý Thị K',
      departmentId: 'dept_5',
      specialization: 'Mụn trứng cá, Chàm, Vảy nến',
      experience: '9 năm kinh nghiệm, Thạc sĩ Y khoa',
      availability: ['Thứ 3, 5, 7: 8:00-17:00'],
    },
  ];

  // Lịch trống cho từng bác sĩ
  public readonly availableSlots = {
    // Bác sĩ của Khoa Nội tổng hợp
    doc_1: {
      '2025-03-18': ['09:00', '10:00', '11:00'],
      '2025-03-19': [],
      '2025-03-20': ['08:00', '10:00', '15:00'],
      '2025-03-21': ['09:00', '10:00', '11:00'],
    },
    doc_2: {
      '2025-03-18': [],
      '2025-03-19': ['09:00', '11:00', '14:00'],
      '2025-03-20': [],
      '2025-03-21': ['13:00', '14:00', '16:00'],
    },
    // Bác sĩ của Khoa Ngoại
    doc_3: {
      '2025-03-18': ['08:30', '10:30'],
      '2025-03-19': ['09:30', '11:30'],
      '2025-03-20': [],
      '2025-03-21': ['08:30', '10:30'],
    },
    doc_4: {
      '2025-03-18': [],
      '2025-03-19': ['14:30', '16:30'],
      '2025-03-20': ['13:30', '15:30'],
      '2025-03-21': ['13:30', '15:30'],
    },
    // Bác sĩ của Khoa Tim mạch
    doc_5: {
      '2025-03-18': ['08:00', '13:00', '14:00'],
      '2025-03-19': [],
      '2025-03-20': ['09:00', '14:00'],
      '2025-03-21': ['08:00', '13:00', '16:00'],
    },
    doc_6: {
      '2025-03-18': [],
      '2025-03-19': ['10:00', '15:00', '16:00'],
      '2025-03-20': [],
      '2025-03-21': ['11:00', '14:00', '15:00'],
    },
    // Bác sĩ của Khoa Thần kinh
    doc_7: {
      '2025-03-18': ['09:30', '10:30'],
      '2025-03-19': [],
      '2025-03-20': ['10:30', '11:30'],
      '2025-03-21': ['09:30', '11:30'],
    },
    doc_8: {
      '2025-03-18': [],
      '2025-03-19': ['08:30', '13:30', '14:30'],
      '2025-03-20': [],
      '2025-03-21': ['13:30', '14:30', '15:30'],
    },
    // Bác sĩ của Khoa Da liễu
    doc_9: {
      '2025-03-18': ['10:00', '15:00', '16:00'],
      '2025-03-19': [],
      '2025-03-20': ['08:00', '13:00'],
      '2025-03-21': ['10:00', '15:00'],
    },
    doc_10: {
      '2025-03-18': [],
      '2025-03-19': ['09:00', '14:00', '15:00'],
      '2025-03-20': [],
      '2025-03-21': ['09:00', '14:00', '16:00'],
    },
  };

  // Map khoa đến danh sách ID bác sĩ
  public readonly departmentToDoctors = {
    dept_1: ['doc_1', 'doc_2'],
    dept_2: ['doc_3', 'doc_4'],
    dept_3: ['doc_5', 'doc_6'],
    dept_4: ['doc_7', 'doc_8'],
    dept_5: ['doc_9', 'doc_10'],
  };

  // Danh sách lịch hẹn đã xác nhận
  public appointments: Appointment[] = [];

  // Danh sách lịch hẹn đang chờ xác nhận
  public pendingAppointments: Map<string, Appointment> = new Map<
    string,
    Appointment
  >();

  // Flag để chỉ định kiểu trả về
  public preferObjectResponse: boolean = true; // Đặt true để sử dụng object thay vì string

  // Hàm trích xuất biến từ chuỗi tóm tắt hoặc object
  private extractVariablesFromSummary(
    summary: string | Record<string, string>,
  ): Record<string, string> {
    // Nếu summary đã là object thì trả về luôn
    if (typeof summary === 'object') {
      this.logger.log(
        `Summary is already an object: ${JSON.stringify(summary)}`,
      );
      return summary;
    }

    this.logger.log(
      `Extracting variables from summary string of type: ${typeof summary}`,
    );
    this.logger.log(
      `Summary content: ${summary.substring(0, 200)}${summary.length > 200 ? '...' : ''}`,
    );

    const result: Record<string, string> = {};

    if (!summary) {
      this.logger.log('Summary is empty or undefined');
      return result;
    }

    // Thử parse nếu là chuỗi JSON
    try {
      // Kiểm tra xem có phải chuỗi JSON hợp lệ không
      if (summary.trim().startsWith('{') && summary.trim().endsWith('}')) {
        this.logger.log('Summary appears to be JSON, attempting to parse');
        const parsedObject = JSON.parse(summary);
        if (typeof parsedObject === 'object' && parsedObject !== null) {
          this.logger.log(
            `Successfully parsed JSON summary: ${JSON.stringify(parsedObject)}`,
          );
          return parsedObject;
        }
      }
    } catch (error) {
      this.logger.log(
        `Error parsing JSON summary, continuing with string parsing: ${error.message}`,
      );
    }

    // Uu tiên tìm trong phần máy đọc được (bỏ qua phần thân thiện người dùng)
    const machineReadablePart = summary.match(
      /Các biến đã trích xuất:([\s\S]*)$/s,
    );
    const textToSearch = machineReadablePart ? machineReadablePart[1] : summary;
    this.logger.log(
      `Text to search for variables: ${textToSearch.substring(0, 200)}${textToSearch.length > 200 ? '...' : ''}`,
    );

    // Tìm tất cả các dòng có dạng "- key: value"
    const variableLines = textToSearch.match(/- ([a-zA-Z]+):\s*([^\n]+)/g);

    if (variableLines) {
      this.logger.log(
        `Found ${variableLines.length} variable lines in the summary`,
      );
      variableLines.forEach((line) => {
        const match = line.match(/- ([a-zA-Z]+):\s*([^\n]+)/);
        if (match && match.length >= 3) {
          const key = match[1];
          const value = match[2].trim();
          result[key] = value;
          this.logger.log(`Extracted variable: ${key} = ${value}`);
        }
      });
    } else {
      this.logger.log('No variable lines found in the summary');
    }

    this.logger.log(`Extraction result: ${JSON.stringify(result)}`);
    return result;
  }

  constructor(private configService: ConfigService) {
    // Khởi tạo model OpenAI
    this.model = new ChatOpenAI({
      modelName: 'gpt-4o-mini', // Hoặc sử dụng model khác như gpt-3.5-turbo
      temperature: 0,
    });

    // Gắn các phương thức xử lý
    this.bookAppointment = bookAppointment.bind(this);
    this.listDepartments = listDepartments.bind(this);
    this.getDoctorInfo = getDoctorInfo.bind(this);
    this.changeDoctor = changeDoctor.bind(this);
    this.checkDoctorAvailableDays = checkDoctorAvailableDays.bind(this);
    this.checkDoctorTimeSlots = checkDoctorTimeSlots.bind(this);
    this.findDoctorByName = findDoctorByName.bind(this);
    this.findDepartmentBySymptoms = findDepartmentBySymptoms.bind(this);
    this.confirmAppointment = confirmAppointment.bind(this);
  }

  // Helper to manage chat history
  private getChatHistory(userId: string): BaseMessage[] {
    return this.chatHistories.get(userId) || [];
  }

  private addMessageToHistory(
    userId: string,
    message: BaseMessage,
    limit: number = 20,
  ) {
    const history = this.getChatHistory(userId);
    history.push(message);
    // Keep only the last 'limit' messages
    while (history.length > limit) {
      history.shift(); // Remove the oldest message
    }
    this.chatHistories.set(userId, history);
  }

  async processMessage(
    userId: string,
    message: string,
    summarizedVariables: Record<string, string> = {},
  ): Promise<{
    text: string;
    variables: Record<string, string>;
    token: any;
    systemPrompt: string;
  }> {
    // Log the received message to help with debugging
    this.logger.log(`Processing message from user ${userId}: "${message}"`);

    // Đặt tham số preferObjectResponse dựa trên kiểu dữ liệu của summarizedVariables
    this.preferObjectResponse = typeof summarizedVariables === 'object';
    this.logger.log(
      `Setting preferObjectResponse to ${this.preferObjectResponse} based on input type`,
    );

    // Chuyển đổi summarizedVariables từ object sang string nếu cần
    let summarizedVariablesStr = '';

    if (typeof summarizedVariables === 'object') {
      summarizedVariablesStr = 'Các biến đã trích xuất:';
      for (const [key, value] of Object.entries(summarizedVariables)) {
        if (value) {
          summarizedVariablesStr += `\n- ${key}: ${value}`;
        }
      }
    } else {
      // Nếu đã là string, giữ nguyên
      summarizedVariablesStr = summarizedVariables;
    }

    try {
      // Trích xuất biến từ chuỗi summarizedVariablesStr hoặc object summarizedVariables
      let extractedVars = {} as any;

      if (typeof summarizedVariables === 'object') {
        // Nếu là object thì dùng trực tiếp
        extractedVars = summarizedVariables;
      } else {
        // Nếu là string thì trích xuất
        extractedVars = this.extractVariablesFromSummary(
          summarizedVariablesStr,
        );
      }

      this.logger.log(
        `Extracted variables from summary: ${JSON.stringify(extractedVars)}`,
      );

      // Tạo agent với tools
      const tools = [
        new BookAppointmentToConfirmTool(this),
        new ListDepartmentsTool(this),
        new CheckDoctorAvailableDaysTool(this),
        new CheckDoctorTimeSlotsTool(this),
        new GetDoctorInfoTool(this),
        new ChangeDoctorTool(this),
        new FindDoctorByNameTool(this),
        new FindDepartmentBySymptomsTool(this),
        // new SummarizeInfoTool(this),
        new ConfirmAppointmentTool(this),
      ];

      const prompt = this.createPrompt();

      const agent = await createToolCallingAgent({
        llm: this.model,
        tools,
        prompt,
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools,
        returnIntermediateSteps: true,
        maxIterations: 10,
      });

      // Extract variables from the summarizedVariables
      let variables = {} as any;
      if (typeof summarizedVariables === 'object') {
        variables = summarizedVariables;
      } else {
        variables = this.extractVariablesFromSummary(summarizedVariablesStr);
      }

      // Create formatted message for user with doctor and time if available
      let formattedMessage = '';

      if (variables.patientName) {
        formattedMessage += `Người dùng tên: ${variables.patientName}`;
      }

      if (variables.phoneNumber) {
        formattedMessage += formattedMessage
          ? `, Số điện thoại: ${variables.phoneNumber}`
          : `Số điện thoại: ${variables.phoneNumber}`;
      }

      if (variables.symptoms) {
        formattedMessage += formattedMessage
          ? `, dấu hiệu: ${variables.symptoms}`
          : `Dấu hiệu: ${variables.symptoms}`;
      }

      if (variables.departmentName) {
        formattedMessage += formattedMessage
          ? `, muốn khám Khoa: ${variables.departmentName}`
          : `Muốn khám Khoa: ${variables.departmentName}`;
      }

      if (variables.departmentId) {
        formattedMessage += formattedMessage
          ? `, id khoa: ${variables.departmentId}`
          : `ID khoa: ${variables.departmentId}`;
      }

      // Add doctor and time information if available
      if (variables.doctorName) {
        formattedMessage += formattedMessage
          ? `, muốn khám với bác sĩ: ${variables.doctorName}`
          : `Muốn khám với bác sĩ: ${variables.doctorName}`;
      }

      if (variables.doctorId) {
        formattedMessage += formattedMessage
          ? `, doctorId: ${variables.doctorId}`
          : `DoctorId: ${variables.doctorId}`;
      }

      if (variables.appointmentDate) {
        formattedMessage += formattedMessage
          ? `, muốn khám vào ngày: ${variables.appointmentDate}`
          : `Muốn khám vào ngày: ${variables.appointmentDate}`;
      }

      if (variables.appointmentTime) {
        formattedMessage += formattedMessage
          ? `, lúc ${variables.appointmentTime}`
          : `Lúc ${variables.appointmentTime}`;
      }

      // Create selector format if doctor and date are available
      let selectorFormat = '';
      if (variables.doctorId && variables.appointmentDate) {
        selectorFormat = `SELECTOR:DATE:${variables.doctorId}:${variables.appointmentDate}`;
      }

      // Combine all message components
      const fullMessage = selectorFormat
        ? `${selectorFormat}\n${formattedMessage}`
        : formattedMessage
          ? `${message}\n\n${formattedMessage}`
          : message;

      // Ghi log đầy đủ thông điệp
      this.logger.log(`Full message to LLM: ${fullMessage}`);

      let token = null;
      let systemPrompt = null;

      const customHandler = {
        handleLLMEnd: async (output) => {
          token = output.generations[0][0].message.response_metadata.usage;
        },
        handleChatModelStart: async (llm, inputMessages, runId) => {
          systemPrompt = inputMessages[0][0].content;
        },
      };

      // Get chat history for the user (last 4 messages)
      const chatHistory = this.getChatHistory(userId);
      this.logger.log(
        `Using chat history for user ${userId}: ${chatHistory.length} messages`,
      );

      // Thực thi agent với tin nhắn chứa tóm tắt biến và lịch sử chat
      const response = await agentExecutor.invoke(
        {
          input: fullMessage,
          chat_history: chatHistory, // Pass the chat history
          returnIntermediateSteps: true, // Đảm bảo bước trung gian được trả về
        },
        { callbacks: [customHandler] },
      );

      // Lấy system prompt từ agent

      // Add current interaction to history
      this.addMessageToHistory(userId, new HumanMessage(fullMessage));
      this.addMessageToHistory(userId, new AIMessage(response.output));

      let variablesObject: Record<string, string> = {};
      if (response.intermediateSteps) {
        this.logger.log(
          `Found ${response.intermediateSteps.length} intermediate steps`,
        );

        // Lọc các bước chạy tool summarize_info
        const summarySteps = response.intermediateSteps.filter(
          (step) => step.action && step.action.tool === 'summarize_info',
        );

        if (summarySteps.length > 0) {
          // Lấy kết quả của lần chạy cuối cùng
          const lastStep = summarySteps[summarySteps.length - 1];
          if (lastStep.observation) {
            // Kiểm tra kiểu dữ liệu của kết quả từ tool
            if (typeof lastStep.observation === 'object') {
              // Nếu đã là object, sử dụng trực tiếp
              variablesObject = lastStep.observation;
              this.logger.log(
                `Found summary object from SummarizeInfoTool: ${JSON.stringify(variablesObject)}`,
              );
            } else if (typeof lastStep.observation === 'string') {
              // Nếu là string, trích xuất thành object
              const summaryFromTool = lastStep.observation;
              this.logger.log(
                `Found summary string from SummarizeInfoTool: ${summaryFromTool}`,
              );

              // Trích xuất biến từ chuỗi
              variablesObject =
                this.extractVariablesFromSummary(summaryFromTool);
            }

            // Tự động kiểm tra và xác nhận đặt lịch nếu có đủ thông tin
            // variablesObject =
            //   this.autoConfirmAppointmentIfPossible(variablesObject);

            // Lọc nội dung phản hồi trả về cho người dùng (loại bỏ biến trích xuất ở cuối)
            const responseWithoutSummary = response.output
              .replace(/Các biến đã trích xuất:[\s\S]*$/, '')
              .trim();

            return {
              text: responseWithoutSummary,
              variables: variablesObject,
              token: token,
              systemPrompt: systemPrompt,
            };
          }
        }
      }

      // Nếu không tìm thấy phần tóm tắt từ cả hai nguồn, trả về nguyên phản hồi và giữ nguyên biến
      if (Object.keys(variablesObject).length === 0) {
        this.logger.log(
          `No summary found, returning original variables: ${JSON.stringify(summarizedVariables)}`,
        );
      }

      return {
        text: response.output,
        variables: variablesObject,
        token: token,
        systemPrompt: systemPrompt,
      };
    } catch (error) {
      this.logger.error(
        `Error processing message: ${error.message}`,
        error.stack,
      );
      // Xử lý trường hợp lỗi
      let variablesObject = {};

      if (typeof summarizedVariables === 'object') {
        variablesObject = summarizedVariables;
      } else {
        variablesObject = this.extractVariablesFromSummary(
          summarizedVariablesStr,
        );
      }

      return {
        text: 'Xin lỗi, có lỗi xảy ra trong quá trình xử lý tin nhắn của bạn. Vui lòng thử lại sau.',
        variables: variablesObject,
        token: null,
        systemPrompt: '',
      };
    }
  }
  // Tạo prompt template cho agent
  private createPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `Bạn là trợ lý ảo của bệnh viện, có nhiệm vụ giúp bệnh nhân đặt lịch khám.
      Hãy giao tiếp một cách lịch sự, rõ ràng và hữu ích (xưng hô em). 
      
      Khi bệnh nhân muốn đặt lịch, hãy thu thập đầy đủ thông tin sau:
      1. Họ tên bệnh nhân
      2. Số điện thoại liên hệ
      3. Triệu chứng hoặc lý do khám
      4. Khoa khám (nếu bệnh nhân không chắc chắn, hãy gợi ý dựa theo triệu chứng)
      5. Nếu có yêu cầu bác sĩ cụ thể, hãy hỏi người dùng
      

      QUAN TRỌNG:
      - Để dùng 'check_time_slots', bạn cần biết ID của khoa (departmentId) và ngày cụ thể.
      - Hãy sử dụng cách đặt lịch theo các bước riêng biệt: chọn bác sĩ > chọn ngày > chọn giờ.
      - Nếu ID khoa chưa được xác định trong phần "Các biến đã trích xuất", hãy HỎI người dùng xem họ muốn khám khoa nào. Ví dụ: "Dạ, anh/chị muốn khám khoa nào ạ?".
      - Nếu ID Bác sĩ chưa được xác nhận trong phần "Các biến đã trích xuất", hãy HỎI người dùng xem họ muốn khám với bác sĩ nào thuộc khoa vừa chọn. Ví dụ: "Dạ, anh/chị muốn khám với bác sĩ nào ạ?".
      - Sau khi có ID bác sĩ (từ biến trích xuất hoặc người dùng vừa chọn), hãy dùng tool check_doctor_available_days để trả về các ngày trống.
      - Sau khi có ngày (từ biến trích xuất hoặc người dùng vừa chọn), hãy dùng tool check_doctor_time_slots để trả về các giờ trống của ngày đó.
      - Không dùng kiến thức của bạn để xác định ngày giờ, khoa khám mà phải dùng tool.
      - Sau khi dùng 1 tool để lấy kết quả thì trả về để người dùng xác nhận
      
      Nếu người cần thông tin bác sĩ, hãy sử dụng tool get_doctor.
      Nếu người dùng muốn đổi bác sĩ sau khi đặt lịch và trước khi xác nhận cuối cùng, hãy sử dụng tool change_doctor.
      Sau khi người dùng xác nhận thông tin lịch hẹn, hãy sử dụng tool confirm_appointment để hoàn tất quá trình đặt lịch.
      Nếu người dùng muốn đổi khoa thì hãy gọi hàm list_departments để hiển thị danh sách khoa.
      
      Khi bệnh nhân muốn chọn bác sĩ, hãy gửi thông tin về khoa (ID khoa) để giao diện có thể hiển thị danh sách bác sĩ thuộc khoa đó.
      
      Khi người dùng hỏi về bác sĩ cụ thể, hãy kiểm tra trong biến trích xuất trước. Nếu không có, hãy sử dụng find_doctor_by_name. Nếu có nhiều bác sĩ cùng tên, công cụ này sẽ tự động hiển thị danh sách bác sĩ cùng tên.
      
      Khi người dùng mô tả triệu chứng nhưng không biết nên khám khoa nào, hãy sử dụng find_department_by_symptoms để gợi ý các khoa phù hợp.



      Khi người dùng muốn đặt lịch với một bác sĩ cụ thể vào ngày cụ thể (ví dụ: "Tôi muốn đặt lịch với Bác sĩ Hoàng Văn E vào ngày 21/3/2025"):
        1. Đầu tiên kiểm tra trong các biến trích xuất có doctorId chưa. Nếu chưa, hãy dùng find_doctor_by_name để tìm ID của bác sĩ (ví dụ: doc_5 cho Hoàng Văn E)
        2. Tiếp theo, dùng check_doctor_available_days với ID bác sĩ để kiểm tra ngày có khả dụng không
        3. Bắt buộc phải dùng check_doctor_time_slots với ID bác sĩ và ngày cụ thể để xem giờ trống. Đặc biệt là, ngay cả khi bước 2 đã xác nhận rằng ngày đó có lịch trống, vẫn phải tiếp tục dùng check_doctor_time_slots để hiển thị các giờ trống.
      
      Lưu ý: Nếu người dùng chỉ nói "lịch Bác sĩ Hoàng Văn E ngày 21 tháng 3 năm 2025", em vẫn phải thực hiện đầy đủ các bước trên để hiển thị đầy đủ thông tin: ID bác sĩ, check ngày, và các giờ khả dụng.
      Gửi kết quả của tool check_doctor_time_slots cho người dùng là bắt buộc, không được bỏ qua bước này.
      
      ĐỒNG NHẤT ĐỊNH DẠNG KẾT QUẢ:
      1. Khi hiển thị thông tin lịch hẹn hoặc chi tiết đặt lịch, BẮT BUỘC phải sử dụng các trường dữ liệu với ĐÚNG các tiêu đề sau:
      Lịch hẹn của anh/chị đã được xác nhận thành công! Dưới đây là thông tin chi tiết:

      - **Mã lịch hẹn**: [mã]
      - **Bệnh nhân**: [tên bệnh nhân]
      - **Số điện thoại**: [số điện thoại]
      - **Ngày khám**: [ngày khám]
      - **Giờ khám**: [giờ khám]
      - **Khoa**: [tên khoa]
      - **Bác sĩ**: [tên bác sĩ]
      
      KHÔNG sử dụng các tiêu đề khác (như "Họ tên", "Tên bệnh nhân", "Thời gian") chỉ được dùng (Mã lịch hẹn, Bệnh nhân, Số điện thoại, Số điện thoại,Ngày khám, Giờ khám, Khoa, Bác sĩ) để đảm bảo tính nhất quán. Luôn tuân theo cấu trúc định dạng đã quy định ở trên.
      `,
      ],
      new MessagesPlaceholder('chat_history'), // Add placeholder for chat history
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);
  }

  // Các phương thức xử lý được gắn từ appointment-bot-methods.ts
  public bookAppointment: (
    patientName: string,
    phoneNumber: string,
    appointmentDate: string,
    appointmentTime: string,
    symptoms: string,
    departmentId?: string,
    doctorId?: string,
  ) => Promise<string>;

  public listDepartments: () => string;

  public checkAvailability: (departmentId: string, date: string) => string;

  public checkDoctorAvailableDays: (doctorId: string) => string;

  public checkDoctorTimeSlots: (doctorId: string, date: string) => string;

  public getDoctorInfo: (
    doctorId?: string,
    doctorName?: string,
    departmentId?: string,
  ) => string;

  public changeDoctor: (appointmentId: string, newDoctorId: string) => string;

  public confirmAppointment: (appointmentId: string) => string;

  public findDoctorByName: (doctorName: string) => string;

  public findDepartmentBySymptoms: (symptoms: string) => string;
}
