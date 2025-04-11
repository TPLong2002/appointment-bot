import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages'; // Import BaseMessage
import { z } from 'zod'; // Import Zod
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
  // SummarizeInfoTool, // Removed
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

  // Flag để chỉ định kiểu trả về (No longer needed as we always use objects)
  // public preferObjectResponse: boolean = true;

  // Removed extractVariablesFromSummary as it's replaced by withStructuredOutput

  // Define the Zod schema for structured output (based on summarizeInfoSchema)
  private readonly appointmentInfoSchema = z.object({
    patientName: z.string().optional().describe('Tên của bệnh nhân'),
    phoneNumber: z.string().optional().describe('Số điện thoại của bệnh nhân'),
    symptoms: z.string().optional().describe('Triệu chứng hoặc lý do khám'),
    departmentId: z.string().optional().describe('ID của khoa khám'),
    departmentName: z.string().optional().describe('Tên khoa khám'),
    doctorId: z.string().optional().describe('ID của bác sĩ'),
    doctorName: z.string().optional().describe('Tên của bác sĩ'),
    appointmentDate: z
      .string()
      .optional()
      .describe('Ngày hẹn khám (định dạng YYYY-MM-DD)'),
    appointmentTime: z
      .string()
      .optional()
      .describe('Giờ hẹn khám (định dạng HH:MM)'),
  });
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
    limit: number = 4,
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
    // Rename for clarity: these are the variables received from the client initially
    clientVariables: Record<string, string> = {},
  ): Promise<{
    text: string;
    variables: Record<string, string>;
    token: any;
    systemPrompt: string;
  }> {
    // Log the received message to help with debugging
    this.logger.log(`Processing message from user ${userId}: "${message}"`);
    this.logger.log(
      `Received clientVariables: ${JSON.stringify(clientVariables)}`,
    );

    // Initialize finalVariables with a copy of clientVariables.
    let finalVariables: Record<string, string> = { ...clientVariables };
    this.logger.log(
      `Initial finalVariables from client: ${JSON.stringify(finalVariables)}`,
    );

    try {
      // --- Step 1: Use withStructuredOutput for initial extraction ---
      const structuredLlm = this.model.withStructuredOutput(
        this.appointmentInfoSchema,
      );

      // Prepare prompt for structured extraction
      // Prepare a simpler prompt for structured extraction, only taking 'input'
      const extractionPrompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `Extract the relevant appointment information from the following text. Only extract information explicitly mentioned.`,
        ],
        ['human', '{input}'], // Only expects 'input'
      ]);

      const extractionChain = extractionPrompt.pipe(structuredLlm);
      const contextString = JSON.stringify(finalVariables);
      // Combine message and context into a single input string
      const extractionInput = `User Message: "${message}"\nCurrent Context: ${contextString}`;
      this.logger.log(
        `Invoking structured LLM for initial extraction with combined input: ${extractionInput}`,
      );
      // Pass the combined string as the 'input' variable
      const extractedData = await extractionChain.invoke({
        input: extractionInput,
      });
      this.logger.log(
        `Structured LLM Output: ${JSON.stringify(extractedData)}`,
      );

      // Merge extracted data with initial clientVariables. Extracted data takes precedence for non-empty values.
      // Cast extractedData to Record<string, any> to satisfy TypeScript
      const structuredOutput = extractedData as Record<string, any>;
      for (const key in structuredOutput) {
        if (
          structuredOutput[key] !== undefined &&
          structuredOutput[key] !== null &&
          structuredOutput[key] !== ''
        ) {
          finalVariables[key] = structuredOutput[key];
        }
      }
      this.logger.log(
        `Final variables after merging structured output: ${JSON.stringify(finalVariables)}`,
      );

      // --- Step 2: Prepare and execute the agent with tools ---
      const tools = [
        new BookAppointmentToConfirmTool(this),
        new ListDepartmentsTool(this),
        new CheckDoctorAvailableDaysTool(this),
        new CheckDoctorTimeSlotsTool(this),
        new GetDoctorInfoTool(this),
        new ChangeDoctorTool(this),
        new FindDoctorByNameTool(this),
        new FindDepartmentBySymptomsTool(this),
        // SummarizeInfoTool removed
        new ConfirmAppointmentTool(this),
      ];

      const agentPrompt = this.createPrompt(); // Use the existing prompt creation logic

      const agent = await createToolCallingAgent({
        llm: this.model,
        tools,
        prompt: agentPrompt,
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools,
        returnIntermediateSteps: true, // Keep this to see tool calls
        maxIterations: 10,
      });

      // Create formatted message context using the *updated* finalVariables
      let formattedContext = '';
      if (finalVariables.patientName)
        formattedContext += `Người dùng tên: ${finalVariables.patientName}`;
      if (finalVariables.phoneNumber)
        formattedContext += formattedContext
          ? `, Số điện thoại: ${finalVariables.phoneNumber}`
          : `Số điện thoại: ${finalVariables.phoneNumber}`;
      if (finalVariables.symptoms)
        formattedContext += formattedContext
          ? `, dấu hiệu: ${finalVariables.symptoms}`
          : `Dấu hiệu: ${finalVariables.symptoms}`;
      if (finalVariables.departmentName)
        formattedContext += formattedContext
          ? `, muốn khám Khoa: ${finalVariables.departmentName}`
          : `Muốn khám Khoa: ${finalVariables.departmentName}`;
      if (finalVariables.departmentId)
        formattedContext += formattedContext
          ? `, id khoa: ${finalVariables.departmentId}`
          : `ID khoa: ${finalVariables.departmentId}`;
      if (finalVariables.doctorName)
        formattedContext += formattedContext
          ? `, muốn khám với bác sĩ: ${finalVariables.doctorName}`
          : `Muốn khám với bác sĩ: ${finalVariables.doctorName}`;
      if (finalVariables.doctorId)
        formattedContext += formattedContext
          ? `, doctorId: ${finalVariables.doctorId}`
          : `DoctorId: ${finalVariables.doctorId}`;
      if (finalVariables.appointmentDate)
        formattedContext += formattedContext
          ? `, muốn khám vào ngày: ${finalVariables.appointmentDate}`
          : `Muốn khám vào ngày: ${finalVariables.appointmentDate}`;
      if (finalVariables.appointmentTime)
        formattedContext += formattedContext
          ? `, lúc ${finalVariables.appointmentTime}`
          : `Lúc ${finalVariables.appointmentTime}`;

      // Combine the user's message with the formatted context from updated variables
      const fullMessageForAgent = formattedContext
        ? `${message}\n\nContext:\n${formattedContext}` // Append context if available
        : message; // Otherwise, just use the user's message

      this.logger.log(`Full message to Agent: ${fullMessageForAgent}`);

      let token = null;
      let systemPrompt = null;

      const customHandler = {
        handleLLMEnd: async (output) => {
          token = output.generations[0][0].message.response_metadata.usage;
        },
        handleChatModelStart: async (llm, inputMessages, runId) => {
          // Assuming the first message is the system prompt
          if (inputMessages && inputMessages[0] && inputMessages[0][0]) {
            systemPrompt = inputMessages[0][0].content;
          }
        },
      };

      const chatHistory = this.getChatHistory(userId);
      this.logger.log(
        `Using chat history for user ${userId}: ${chatHistory.length} messages`,
      );

      // Execute the agent
      const agentResponse = await agentExecutor.invoke(
        {
          input: fullMessageForAgent,
          chat_history: chatHistory,
        },
        { callbacks: [customHandler] },
      );

      // Add interaction to history
      this.addMessageToHistory(userId, new HumanMessage(fullMessageForAgent)); // Log the message sent to agent
      this.addMessageToHistory(userId, new AIMessage(agentResponse.output));

      // The final response text is directly from the agent
      const responseText = agentResponse.output;

      // NOTE: We are returning the `finalVariables` which were determined *before* the agent ran.
      // If tools called by the agent modify state (like booking an appointment which generates an ID),
      // that specific information might not be reflected back in the returned `variables` object
      // unless the agent's final response *includes* that new info and we parse it here,
      // or if the tools themselves update the `finalVariables` object directly (which they don't currently).
      // For now, we return the state after the initial structured extraction.
      // A more advanced approach might involve another structured extraction *after* the agent runs.

      this.logger.log(
        `Agent execution finished. Returning text: "${responseText}" and variables: ${JSON.stringify(finalVariables)}`,
      );

      return {
        text: responseText,
        variables: finalVariables, // Return variables determined before agent execution
        token: token,
        systemPrompt: systemPrompt,
      };
    } catch (error) {
      this.logger.error(
        `Error processing message: ${error.message}`,
        error.stack,
      );
      return {
        text: 'Xin lỗi, có lỗi xảy ra trong quá trình xử lý tin nhắn của bạn. Vui lòng thử lại sau.',
        variables: finalVariables, // Return potentially partially updated variables
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
      
      Luôn hỏi lại thông tin nếu chưa rõ ràng. Nếu bệnh nhân cung cấp thông tin không hợp lệ, hãy giải thích lý do và yêu cầu họ cung cấp lại.

      QUAN TRỌNG:
      - Để dùng 'check_time_slots', bạn cần biết ID của khoa (departmentId) và ngày cụ thể.
      - Hãy sử dụng cách đặt lịch theo các bước riêng biệt: chọn bác sĩ > chọn ngày > chọn giờ.
      - Nếu ID khoa chưa được xác định trong phần "Các biến đã trích xuất", hãy HỎI người dùng xem họ muốn khám khoa nào. Ví dụ: "Dạ, anh/chị muốn khám khoa nào ạ?".
      - Nếu ID Bác sĩ chưa được xác nhận trong phần "Các biến đã trích xuất", hãy HỎI người dùng xem họ muốn khám với bác sĩ nào thuộc khoa vừa chọn. Ví dụ: "Dạ, anh/chị muốn khám với bác sĩ nào ạ?".
      - Sau khi có ID bác sĩ (từ biến trích xuất hoặc người dùng vừa chọn), hãy dùng tool check_doctor_available_days để trả về các ngày trống.
      - Sau khi có ngày (từ biến trích xuất hoặc người dùng vừa chọn), hãy dùng tool check_doctor_time_slots để trả về các giờ trống của ngày đó.
      - Không dùng kiến thức của bạn để xác định ngày giờ, khoa khám mà phải dùng tool.
      - Mỗi tool chỉ được dùng ĐÚNG 1 lần.
      - Sau khi dùng 1 tool để lấy kết quả thì trả về để người dùng xác nhận
      
      Nếu người cần thông tin bác sĩ, hãy sử dụng tool get_doctor.
      Nếu người dùng muốn đổi bác sĩ sau khi đặt lịch và trước khi xác nhận cuối cùng, hãy sử dụng tool change_doctor.
      Sau khi người dùng xác nhận thông tin lịch hẹn, hãy sử dụng tool confirm_appointment để hoàn tất quá trình đặt lịch.
      Nếu người dùng muốn đổi khoa thì hãy gọi hàm list_departments để hiển thị danh sách khoa.
      
      Khi bệnh nhân muốn chọn bác sĩ, hãy gửi thông tin về khoa (ID khoa) để giao diện có thể hiển thị danh sách bác sĩ thuộc khoa đó.
      
      Khi người dùng hỏi về bác sĩ cụ thể, hãy kiểm tra trong context (thông tin đã biết) trước. Nếu không có, hãy sử dụng find_doctor_by_name. Nếu có nhiều bác sĩ cùng tên, công cụ này sẽ tự động hiển thị danh sách bác sĩ cùng tên.
      
      Khi người dùng mô tả triệu chứng nhưng không biết nên khám khoa nào, hãy sử dụng find_department_by_symptoms để gợi ý các khoa phù hợp.

      SAU MỖI LẦN NHẬN TIN NHẮN MỚI:
      1. Phân tích tin nhắn và context hiện tại để xác định thông tin nào đã có và thông tin nào còn thiếu.
      2. Sử dụng các tool phù hợp để thu thập thông tin còn thiếu hoặc thực hiện yêu cầu của người dùng.


      Khi người dùng muốn đặt lịch với một bác sĩ cụ thể vào ngày cụ thể (ví dụ: "Tôi muốn đặt lịch với Bác sĩ Hoàng Văn E vào ngày 21/3/2025"):
        1. Đầu tiên kiểm tra trong context có doctorId chưa. Nếu chưa, hãy dùng find_doctor_by_name để tìm ID của bác sĩ (ví dụ: doc_5 cho Hoàng Văn E)
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
  // Re-adding type declarations for static analysis
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

  // Assuming checkAvailability was a typo and not used, based on constructor bindings
  // public checkAvailability: (departmentId: string, date: string) => string;

  public checkDoctorAvailableDays: (doctorId: string) => string;

  public checkDoctorTimeSlots: (doctorId: string, date: string) => string;

  public getDoctorInfo: (
    doctorId?: string,
    doctorName?: string,
    departmentId?: string,
  ) => Promise<string>; // Changed to Promise<string> based on method file

  public changeDoctor: (appointmentId: string, newDoctorId: string) => string;

  public confirmAppointment: (appointmentId: string) => string;

  public findDoctorByName: (doctorName: string) => string;

  public findDepartmentBySymptoms: (symptoms: string) => Promise<string>; // Changed to Promise<string> based on method file
}
