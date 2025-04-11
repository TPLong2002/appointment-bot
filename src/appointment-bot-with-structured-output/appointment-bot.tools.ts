import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AppointmentBotService } from './appointment-bot.service';

// Schema cho tìm bác sĩ theo tên
const findDoctorByNameSchema = z.object({
  doctorName: z.string().describe('Tên bác sĩ cần tìm kiếm'),
  doctorId: z.string().optional().describe('ID của bác sĩ'),
});

// Schema cho tìm khoa theo triệu chứng
const findDepartmentBySymptomSchema = z.object({
  symptoms: z.string().describe('Các triệu chứng của bệnh nhân'),
});

// Schema cho hành động đặt lịch khám
const bookAppointmentSchema = z.object({
  patientName: z.string().describe('Tên của bệnh nhân'),
  phoneNumber: z.string().describe('Số điện thoại của bệnh nhân'),
  appointmentDate: z.string().describe('Ngày hẹn khám (định dạng YYYY-MM-DD)'),
  appointmentTime: z.string().describe('Giờ hẹn khám (định dạng HH:MM)'),
  symptoms: z.string().describe('Triệu chứng hoặc lý do khám'),
  departmentId: z.string().optional().describe('ID của khoa khám (nếu biết)'),
  doctorId: z
    .string()
    .optional()
    .describe('ID của bác sĩ (nếu bệnh nhân có yêu cầu bác sĩ cụ thể)'),
});

// Schema cho xem thông tin bác sĩ
const getDoctorInfoSchema = z.object({
  doctorId: z.string().optional().describe('ID của bác sĩ cần xem thông tin'),
  doctorName: z.string().optional().describe('Tên của bác sĩ cần tìm'),
  departmentId: z
    .string()
    .optional()
    .describe('ID của khoa để tìm danh sách bác sĩ'),
});

// Schema cho đổi bác sĩ
const changeDoctorSchema = z.object({
  appointmentId: z.string().describe('ID của lịch hẹn cần đổi bác sĩ'),
  newDoctorId: z.string().describe('ID của bác sĩ mới'),
});

// Schema cho xác nhận lịch hẹn
const confirmAppointmentSchema = z.object({
  appointmentId: z.string().describe('ID của lịch hẹn cần xác nhận'),
});

// Tool đặt lịch khám
export class BookAppointmentToConfirmTool extends StructuredTool {
  name = 'book_appointment_to_confirm';
  description =
    'Dùng để tạo lịch hẹn khám cho bệnh nhân để bệnh nhân kiểm tra thông tin và xác nhận lại.';
  schema = bookAppointmentSchema;

  constructor(private service: AppointmentBotService) {
    super();
  }

  async _call(input: z.infer<typeof bookAppointmentSchema>) {
    console.log(
      'BookAppointmentToConfirmTool is running',
      input.patientName,
      input.phoneNumber,
      input.appointmentDate,
      input.appointmentTime,
      input.symptoms,
      input.departmentId,
      input.doctorId,
    );
    return this.service.bookAppointment(
      input.patientName,
      input.phoneNumber,
      input.appointmentDate,
      input.appointmentTime,
      input.symptoms,
      input.departmentId,
      input.doctorId,
    );
  }
}

// Tool liệt kê danh sách khoa
export class ListDepartmentsTool extends StructuredTool {
  name = 'list_departments';
  description = 'Liệt kê danh sách các khoa của bệnh viện';
  schema = z.object({});

  constructor(private service: AppointmentBotService) {
    super();
  }

  async _call() {
    console.log('ListDepartmentsTool is running');
    return this.service.listDepartments();
  }
}

// Tool xem thông tin bác sĩ
export class GetDoctorInfoTool extends StructuredTool {
  name = 'get_doctor';
  description =
    'This tool is used to get doctor details or doctor details list by department ID or doctor ID or doctor name.';
  schema = getDoctorInfoSchema;

  constructor(private service: AppointmentBotService) {
    super();
  }

  async _call(input: {
    doctorId?: string;
    doctorName?: string;
    departmentId: string;
  }) {
    console.log(
      'GetDoctorInfoTool is running:',
      input.doctorId,
      input.doctorName,
      input.departmentId,
    );
    return this.service.getDoctorInfo(
      input.doctorId,
      input.doctorName,
      input.departmentId,
    );
  }
}

// Tool đổi bác sĩ
export class ChangeDoctorTool extends StructuredTool {
  name = 'change_doctor';
  description = 'Tool này dùng để đổi bác sĩ.';
  schema = changeDoctorSchema;

  constructor(private service: AppointmentBotService) {
    super();
  }

  async _call(input: { appointmentId: string; newDoctorId: string }) {
    console.log(
      'ChangeDoctorTool is running',
      input.appointmentId,
      input.newDoctorId,
    );
    return this.service.changeDoctor(input.appointmentId, input.newDoctorId);
  }
}

// Tool xác nhận lịch hẹn
export class ConfirmAppointmentTool extends StructuredTool {
  name = 'confirm_appointment';
  description =
    'Tool này dùng để xác nhận lịch hẹn khám sau khi đã kiểm tra kĩ thông tin. BẮT BUỘC dùng khi người dùng xác nhận đặt lịch khám';
  schema = confirmAppointmentSchema;

  constructor(private service: AppointmentBotService) {
    super();
  }

  async _call(input: { appointmentId: string }) {
    console.log('ConfirmAppointmentTool is running', input.appointmentId);
    return this.service.confirmAppointment(input.appointmentId);
  }
}

// Tool kiểm tra ngày trống của bác sĩ
export class CheckDoctorAvailableDaysTool extends StructuredTool {
  name = 'check_doctor_available_days';
  description =
    'Tool này dùng để kiểm tra các ngày còn lịch trống của một bác sĩ cụ thể. CHỈ ĐƯỢC DÙNG KHI NGƯỜI DÙNG CÓ YÊU CẦU';
  schema = z.object({
    doctorId: z.string().describe('ID của bác sĩ cần kiểm tra'),
  });

  constructor(private service: AppointmentBotService) {
    super();
  }

  async _call(input: { doctorId: string }) {
    console.log('CheckDoctorAvailableDaysTool is running', input.doctorId);

    // Tìm thông tin bác sĩ để lưu lại
    const doctor = this.service.doctors.find(
      (doc) => doc.id === input.doctorId,
    );
    if (doctor) {
      // Cập nhật thông tin bác sĩ vào lastSelectedDoctor
      this.service.lastSelectedDoctor = {
        doctorId: doctor.id,
        doctorName: doctor.name,
        departmentId: doctor.departmentId,
        date: '',
        time: '',
      };
      console.log(
        `Saved doctor to lastSelectedDoctor: ${doctor.id} - ${doctor.name}`,
      );
    }

    return this.service.checkDoctorAvailableDays(input.doctorId);
  }
}

// Tool kiểm tra giờ trống của bác sĩ trong một ngày
export class CheckDoctorTimeSlotsTool extends StructuredTool {
  name = 'check_doctor_time_slots';
  description =
    'Kiểm tra các khung giờ còn trống của một bác sĩ trong một ngày cụ thể. Dùng khi người dùng muốn biết các giờ còn trống để đặt lịch khám với một bác sĩ vào một ngày cụ thể. Bắt buộc phải dùng công cụ này để xem giờ trống khi người dùng yêu cầu đặt lịch vào một ngày cụ thể.';
  schema = z.object({
    doctorId: z.string().describe('ID của bác sĩ cần kiểm tra'),
    date: z.string().describe('Ngày cần kiểm tra (định dạng YYYY-MM-DD)'),
  });

  constructor(private service: AppointmentBotService) {
    super();
  }

  async _call(input: { doctorId: string; date: string }) {
    console.log('CheckDoctorTimeSlotsTool is running');
    console.log(
      '🚀 ~ CheckDoctorTimeSlotsTool ~ _call ~ doctorId:',
      input.doctorId,
      input.date,
    );

    // Tìm thông tin bác sĩ để lưu lại
    const doctor = this.service.doctors.find(
      (doc) => doc.id === input.doctorId,
    );
    if (doctor) {
      // Cập nhật thông tin bác sĩ vào lastSelectedDoctor
      this.service.lastSelectedDoctor = {
        doctorId: doctor.id,
        doctorName: doctor.name,
        departmentId: doctor.departmentId,
        date: input.date,
        time: '',
      };
      console.log(
        `Saved doctor and date to lastSelectedDoctor: ${doctor.id} - ${doctor.name} - ${input.date}`,
      );
    }

    return this.service.checkDoctorTimeSlots(input.doctorId, input.date);
  }
}

// Tool tìm bác sĩ theo tên
export class FindDoctorByNameTool extends StructuredTool {
  name = 'find_doctor_by_name';
  description =
    'Tìm kiếm bác sĩ theo tên. Nếu có nhiều bác sĩ cùng tên, sẽ hiển thị giao diện để chọn. Dùng khi người dùng muốn tìm thông tin về một bác sĩ cụ thể.';
  schema = findDoctorByNameSchema;

  constructor(private service: AppointmentBotService) {
    super();
  }

  async _call(input: { doctorName: string }) {
    console.log('FindDoctorByNameTool is running', input.doctorName);
    return this.service.findDoctorByName(input.doctorName);
  }
}

// Tool tìm khoa dựa trên triệu chứng
export class FindDepartmentBySymptomsTool extends StructuredTool {
  name = 'find_department_by_symptoms';
  description =
    'Gợi ý khoa từ triệu chứng của bệnh nhân. BẮT BUỘC dùng gì bệnh nhân gửi triệu chứng ví dụ như: Tôi bị, Tôi đau, Tôi có triệu chứng...';
  schema = findDepartmentBySymptomSchema;

  constructor(private service: AppointmentBotService) {
    super();
  }

  async _call(input: { symptoms: string }) {
    console.log('FindDepartmentBySymptomsTool is running', input.symptoms);
    return this.service.findDepartmentBySymptoms(input.symptoms);
  }
}
