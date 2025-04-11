// Các phương thức xử lý của AppointmentBotService
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Doctor, Appointment } from './appointment-bot.interfaces';
import { createDoctorCards } from './html-templates/doctor-cards.template';

const symptomKeywords = {
  dept_1: [
    'sốt',
    'đau đầu',
    'ho',
    'cảm',
    'cúm',
    'đau bụng',
    'tiêu chảy',
    'buồn nôn',
    'nôn',
    'mệt mỏi',
    'chán ăn',
    'khó tiêu',
    'ợ chua',
    'viêm họng',
    'rối loạn tiêu hóa',
  ],
  dept_2: [
    'vết thương',
    'gãy',
    'gãy xương',
    'trật khớp',
    'bong gân',
    'chấn thương',
    'đau khớp',
    'phẫu thuật',
    'cắt',
    'bó bột',
    'chấn thương thể thao',
    'tai nạn',
    'bỏng',
    'vết thương hở',
    'u bướu',
    'sưng tấy',
  ],
  dept_3: [
    'tim',
    'đau ngực',
    'khó thở',
    'huyết áp',
    'mạch',
    'đập thình thịch',
    'hồi hộp',
    'tức ngực',
    'đau tim',
    'cao huyết áp',
    'thấp huyết áp',
    'mệt khi gắng sức',
    'phù chân',
    'đánh trống ngực',
    'nhịp tim nhanh',
    'nhịp tim chậm',
  ],
  dept_4: [
    'đau đầu',
    'chóng mặt',
    'co giật',
    'tê',
    'run',
    'liệt',
    'yếu tay chân',
    'mất ngủ',
    'rối loạn giấc ngủ',
    'đau nửa đầu',
    'mất thăng bằng',
    'động kinh',
    'sa sút trí tuệ',
    'mất trí nhớ',
    'rối loạn cảm giác',
    'ù tai',
    'nhức đầu',
  ],
  dept_5: [
    'nổi mẩn',
    'ngứa',
    'mụn',
    'da',
    'nốt',
    'phát ban',
    'mẩn đỏ',
    'dị ứng da',
    'chàm',
    'vảy nến',
    'nấm da',
    'rụng tóc',
    'mụn trứng cá',
    'u mềm',
    'sẹo',
    'bệnh da liễu',
    'viêm da',
    'loét da',
    'da khô',
    'da dầu',
  ],
};
// Tool đặt lịch khám
export async function bookAppointment(
  this: any,
  patientName: string,
  phoneNumber: string,
  appointmentDate: string,
  appointmentTime: string,
  symptoms: string,
  departmentId?: string,
  doctorId?: string,
): Promise<string> {
  // Kiểm tra xem thông tin có hợp lệ không
  if (
    !patientName ||
    !phoneNumber ||
    !appointmentDate ||
    !appointmentTime ||
    !symptoms
  ) {
    return 'Thông tin không đầy đủ. Vui lòng cung cấp đầy đủ tên, số điện thoại, ngày khám, giờ khám và triệu chứng.';
  }
  console.log(1);
  // Kiểm tra định dạng số điện thoại
  if (!/^\d{10,11}$/.test(phoneNumber)) {
    return 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại từ 10-11 chữ số.';
  }

  // Kiểm tra định dạng ngày tháng
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(appointmentDate)) {
    return 'Định dạng ngày không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD.';
  }

  // Kiểm tra định dạng giờ
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(appointmentTime)) {
    return 'Định dạng giờ không hợp lệ. Vui lòng sử dụng định dạng HH:MM.';
  }

  // Xác định khoa nếu chưa cung cấp
  let selectedDepartment = departmentId;
  if (!selectedDepartment) {
    // Logic đơn giản để gợi ý khoa dựa trên triệu chứng

    const lowerSymptoms = symptoms.toLowerCase();
    for (const [deptId, keywords] of Object.entries(symptomKeywords)) {
      if (keywords.some((keyword) => lowerSymptoms.includes(keyword))) {
        selectedDepartment = deptId;
        break;
      }
    }
  }
  console.log(2);
  // Kiểm tra xem khoa có tồn tại không
  const department = this.departments.find(
    (dept) => dept.id === selectedDepartment,
  );
  if (!department) {
    return `Không tìm thấy khoa với ID ${selectedDepartment}. Vui lòng chọn khoa khác.`;
  }
  // Tìm bác sĩ phù hợp hoặc sử dụng bác sĩ được chỉ định
  let selectedDoctor = null;

  if (doctorId) {
    selectedDoctor = this.doctors.find(
      (doc) => doc.id === doctorId && doc.departmentId === selectedDepartment,
    );
    if (!selectedDoctor) {
      return `Không tìm thấy bác sĩ với ID ${doctorId} trong khoa ${department.name}. Vui lòng chọn bác sĩ khác.`;
    }
  } else {
    // Chọn bác sĩ ngẫu nhiên trong khoa
    const departmentDoctors = this.doctors.filter(
      (doc) => doc.departmentId === selectedDepartment,
    );
    if (departmentDoctors.length > 0) {
      selectedDoctor =
        departmentDoctors[Math.floor(Math.random() * departmentDoctors.length)];
    } else {
      return `Không tìm thấy bác sĩ nào trong khoa ${department.name}. Vui lòng chọn khoa khác.`;
    }
  }

  console.log(
    `Using doctor ID: ${selectedDoctor.id} for checking available slots`,
  );

  // Kiểm tra ngày có lịch trống không
  if (
    !this.availableSlots[selectedDoctor.id] ||
    !this.availableSlots[selectedDoctor.id][appointmentDate]
  ) {
    return `Ngày ${appointmentDate} không có lịch khám với bác sĩ ${selectedDoctor.name}. Vui lòng chọn ngày khác.`;
  }
  console.log(3);
  // Kiểm tra giờ có trống không
  if (
    !this.availableSlots[selectedDoctor.id][appointmentDate].includes(
      appointmentTime,
    )
  ) {
    return `Giờ ${appointmentTime} không có lịch trống vào ngày ${appointmentDate} với bác sĩ ${selectedDoctor.name}. Các giờ còn trống: ${this.availableSlots[selectedDoctor.id][appointmentDate].join(', ')}.`;
  }
  console.log(4);
  // Tạo lịch hẹn mới
  const appointmentId = `APT-${Date.now()}`;
  const appointment: Appointment = {
    id: appointmentId,
    patientName,
    phoneNumber,
    appointmentDate,
    appointmentTime,
    symptoms,
    departmentId: selectedDepartment,
    departmentName: department.name,
    doctorId: selectedDoctor.id,
    doctorName: selectedDoctor.name,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Lưu lịch hẹn vào danh sách chờ xác nhận
  this.pendingAppointments.set(appointmentId, appointment);

  // KHÔNG xóa khung giờ ở đây nữa, sẽ xóa khi xác nhận
  console.log(5);
  return `Đã tạo lịch hẹn khám tạm thời!\n
Thông tin lịch hẹn:
**Mã lịch hẹn**: ${appointmentId}
**Bệnh nhân**: ${patientName}
**Số điện thoại**: ${phoneNumber}
**Ngày khám**: ${appointmentDate}
**Giờ khám**: ${appointmentTime}
**Khoa**: ${department.name} (ID: ${department.id})
**Bác sĩ**: ${selectedDoctor.name} (ID: ${selectedDoctor.id})
**Triệu chứng**: ${symptoms}

Lịch hẹn của bạn đang ở trạng thái chờ xác nhận. Bạn có thể yêu cầu đổi bác sĩ trước khi xác nhận nếu muốn.
Hãy kiểm tra kỹ thông tin trên và xác nhận nếu đã chính xác.`;
}

// Liệt kê danh sách khoa
export function listDepartments(this: any): string {
  let result = 'Danh sách các khoa của bệnh viện:\n\n';
  this.departments.forEach((dept) => {
    result += `- ${dept.name} (ID: ${dept.id})\n`;
  });
  console.log('listDepartments', result);
  return result;
}

export async function getDoctorInfo(
  this: any,
  doctorId?: string,
  doctorName?: string,
  departmentId?: string,
): Promise<string> {
  // Luôn trả về tất cả bác sĩ theo phòng ban, bất kể tham số đầu vào
  // Kiểm tra xem có thông tin về phòng ban và bác sĩ không
  if (!this.departments || this.departments.length === 0) {
    return 'Không có thông tin về các khoa.';
  }

  if (!this.doctors || this.doctors.length === 0) {
    return 'Không có thông tin về các bác sĩ.';
  }

  // Tạo chuỗi kết quả
  let result = 'Danh sách bác sĩ theo phòng ban:\n\n';

  // Xử lý từng phòng ban
  this.departments.forEach((department) => {
    // Tìm các bác sĩ trong phòng ban này
    const doctorsInDepartment = this.doctors.filter(
      (doc) => doc.departmentId === department.id,
    );

    result += `=== Khoa ${department.name} ===\n`;

    if (doctorsInDepartment.length === 0) {
      result += 'Không có bác sĩ nào trong khoa này.\n\n';
    } else {
      doctorsInDepartment.forEach((doctor) => {
        result += `- Bác sĩ ${doctor.name} (ID: ${doctor.id})\n`;
        result += `  Chuyên môn: ${doctor.specialization}\n`;
        result += `  Kinh nghiệm: ${doctor.experience}\n`;
        result += `  Lịch làm việc: ${doctor.availability.join(', ')}\n\n`;
      });
    }
  });
  const systemTemplate = `Bạn là một trợ lý ảo của bệnh viện, hãy cung cấp thông tin chi tiết về bác sĩ theo yêu cầu của người dùng. Nếu không có thông tin cụ thể, hãy trả về danh sách tất cả bác sĩ theo từng khoa.
    
    - **Tên bác sĩ**: [tên bác sĩ]
    - **ID bác sĩ**: [id bác sĩ]
    - **Chuyên khoa**: [chuyên khoa]
    - **Kinh nghiệm**: [kinh nghiệm]
    - **Trình độ**: [Trình độ]`;

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', systemTemplate],
    ['user', '{text}'],
  ]);
  const promptValue = await promptTemplate.invoke({
    text: result,
  });
  const res = await this.model.invoke(promptValue);

  return res.content;
}

// Đổi bác sĩ
export function changeDoctor(
  this: any,
  appointmentId: string,
  newDoctorId: string,
): string {
  // Kiểm tra xem lịch hẹn có tồn tại không
  if (!this.pendingAppointments.has(appointmentId)) {
    return `Không tìm thấy lịch hẹn với ID ${appointmentId}. Vui lòng kiểm tra lại ID lịch hẹn.`;
  }

  const appointment = this.pendingAppointments.get(appointmentId);

  // Kiểm tra trạng thái lịch hẹn
  if (appointment.status !== 'pending') {
    return `Lịch hẹn với ID ${appointmentId} không thể đổi bác sĩ vì đã ${appointment.status === 'confirmed' ? 'xác nhận' : 'hủy'}.`;
  }

  // Kiểm tra xem bác sĩ mới có tồn tại không
  const newDoctor = this.doctors.find((doc) => doc.id === newDoctorId);
  if (!newDoctor) {
    return `Không tìm thấy bác sĩ với ID ${newDoctorId}. Vui lòng chọn bác sĩ khác.`;
  }

  // Kiểm tra xem bác sĩ mới có thuộc cùng khoa không
  if (newDoctor.departmentId !== appointment.departmentId) {
    return `Bác sĩ ${newDoctor.name} không thuộc khoa ${appointment.departmentName}. Vui lòng chọn bác sĩ thuộc cùng khoa.`;
  }

  // Kiểm tra xem bác sĩ mới có trùng với bác sĩ hiện tại không
  if (newDoctor.id === appointment.doctorId) {
    return `Bác sĩ ${newDoctor.name} đã được chỉ định cho lịch hẹn này. Vui lòng chọn bác sĩ khác.`;
  }

  // Cập nhật thông tin bác sĩ cho lịch hẹn
  const oldDoctorName = appointment.doctorName;
  appointment.doctorId = newDoctor.id;
  appointment.doctorName = newDoctor.name;

  // Cập nhật lịch hẹn trong danh sách chờ xác nhận
  this.pendingAppointments.set(appointmentId, appointment);

  return `Đã đổi bác sĩ cho lịch hẹn thành công!\n
Thông tin lịch hẹn sau khi cập nhật:
**Mã lịch hẹn**: ${appointmentId}
**Bệnh nhân**: ${appointment.patientName}
**Số điện thoại**: ${appointment.phoneNumber}
**Ngày khám**: ${appointment.appointmentDate}
**Giờ khám**: ${appointment.appointmentTime}
**Khoa**: ${appointment.departmentName} (ID: ${appointment.departmentId})
**Bác sĩ**: ${appointment.doctorName} (ID: ${appointment.doctorId})
**Triệu chứng**: ${appointment.symptoms}

Lịch hẹn của bạn vẫn ở trạng thái chờ xác nhận. Vui lòng xác nhận nếu thông tin đã chính xác.`;
}

// Kiểm tra ngày trống của bác sĩ
export function checkDoctorAvailableDays(this: any, doctorId: string): string {
  // Kiểm tra xem bác sĩ có tồn tại không
  const doctor = this.doctors.find((doc) => doc.id === doctorId);
  if (!doctor) {
    return `Không tìm thấy bác sĩ với ID ${doctorId}. Vui lòng kiểm tra lại ID bác sĩ.`;
  }

  // Lấy lịch trống của bác sĩ
  const doctorSlots = this.availableSlots[doctorId] || {};

  // Lọc các ngày có ít nhất 1 khung giờ trống
  const availableDays = Object.entries(doctorSlots)
    .filter(([_, timeSlots]) => (timeSlots as string[]).length > 0)
    .map(([date, _]) => date)
    .sort();

  if (availableDays.length === 0) {
    return `Bác sĩ ${doctor.name} hiện không có lịch khám trống nào.`;
  }

  // Trả về các ngày có lịch trống
  return `Bác sĩ ${doctor.name} có lịch trống vào các ngày sau: ${availableDays.join(', ')}. Vui lòng chọn một ngày để xem các khung giờ còn trống.`;
}

// Kiểm tra giờ trống của bác sĩ trong một ngày
export function checkDoctorTimeSlots(
  this: any,
  doctorId: string,
  date: string,
): string {
  // Kiểm tra xem bác sĩ có tồn tại không
  const doctor = this.doctors.find((doc) => doc.id === doctorId);
  if (!doctor) {
    return `Không tìm thấy bác sĩ với ID ${doctorId}. Vui lòng kiểm tra lại ID bác sĩ.`;
  }

  // Kiểm tra ngày có lịch trống không
  const doctorSlots = this.availableSlots[doctorId] || {};
  if (!doctorSlots[date] || doctorSlots[date].length === 0) {
    // Trả về các ngày khác có lịch trống
    const availableDays = Object.entries(doctorSlots)
      .filter(([_, timeSlots]) => (timeSlots as string[]).length > 0)
      .map(([availableDate, _]) => availableDate)
      .sort();

    if (availableDays.length === 0) {
      return `Bác sĩ ${doctor.name} không có lịch khám trống vào ngày ${date} và cũng không có ngày nào khác có lịch trống.`;
    }

    return `Bác sĩ ${doctor.name} không có lịch khám trống vào ngày ${date}. Các ngày có lịch trống: ${availableDays.join(', ')}.`;
  }

  // Trả về các khung giờ còn trống
  return `Các khung giờ còn trống vào ngày ${date} của bác sĩ ${doctor.name}: ${doctorSlots[date].join(', ')}.`;
}

// Xác nhận lịch hẹn
export function confirmAppointment(this: any, appointmentId: string): string {
  // Kiểm tra xem lịch hẹn có tồn tại không
  if (!this.pendingAppointments.has(appointmentId)) {
    return `Không tìm thấy lịch hẹn với ID ${appointmentId}. Vui lòng kiểm tra lại ID lịch hẹn.`;
  }

  const appointment = this.pendingAppointments.get(appointmentId);

  // Kiểm tra trạng thái lịch hẹn
  if (appointment.status !== 'pending') {
    return `Lịch hẹn với ID ${appointmentId} không thể xác nhận vì đã ${appointment.status === 'confirmed' ? 'xác nhận trước đó' : 'hủy'}.`;
  }

  // Cập nhật trạng thái lịch hẹn
  appointment.status = 'confirmed';
  appointment.confirmationDate = new Date().toISOString();

  // Nếu có thông tin bác sĩ đã chọn trong lastSelectedDoctor, sử dụng nó
  if (this.lastSelectedDoctor && this.lastSelectedDoctor.doctorName) {
    // Cập nhật thông tin bác sĩ nếu chưa được đặt
    if (!appointment.doctorId || appointment.doctorId.trim() === '') {
      appointment.doctorId = this.lastSelectedDoctor.doctorId;
    }
    if (!appointment.doctorName || appointment.doctorName.trim() === '') {
      appointment.doctorName = this.lastSelectedDoctor.doctorName;
    }
  }

  // Chuyển lịch hẹn từ danh sách chờ xác nhận sang danh sách đã xác nhận
  this.appointments.push(appointment);
  this.pendingAppointments.delete(appointmentId);

  // Xóa khung giờ đã đặt khỏi danh sách trống
  const { doctorId, appointmentDate, appointmentTime } = appointment;
  if (
    this.availableSlots[doctorId] &&
    this.availableSlots[doctorId][appointmentDate]
  ) {
    const timeIndex =
      this.availableSlots[doctorId][appointmentDate].indexOf(appointmentTime);
    if (timeIndex !== -1) {
      this.availableSlots[doctorId][appointmentDate].splice(timeIndex, 1);
      this.logger.log(
        `Removed slot ${appointmentTime} on ${appointmentDate} for doctor ${doctorId}`,
      );
    } else {
      this.logger.warn(
        `Slot ${appointmentTime} on ${appointmentDate} for doctor ${doctorId} not found in availableSlots during confirmation.`,
      );
    }
  } else {
    this.logger.warn(
      `Available slots for doctor ${doctorId} on ${appointmentDate} not found during confirmation.`,
    );
  }

  return `Đã xác nhận lịch hẹn khám thành công!\n
Thông tin lịch hẹn:
**Mã lịch hẹn**: ${appointmentId}
**Bệnh nhân**: ${appointment.patientName}
**Số điện thoại**: ${appointment.phoneNumber}
**Ngày khám**: ${appointment.appointmentDate}
**Giờ khám**: ${appointment.appointmentTime}
**Khoa**: ${appointment.departmentName} (ID: ${appointment.departmentId})
**Bác sĩ**: ${appointment.doctorName} (ID: ${appointment.doctorId})
**Triệu chứng**: ${appointment.symptoms}

Vui lòng đến trước giờ hẹn 15 phút để làm thủ tục. Mang theo CMND/CCCD và thẻ BHYT (nếu có).
Để hủy hoặc đổi lịch, vui lòng liên hệ số điện thoại 1900-1234 ít nhất 24 giờ trước giờ hẹn.
Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!`;
}

// Tìm kiếm bác sĩ theo tên
export function findDoctorByName(this: any, doctorName: string): string {
  // Kiểm tra nếu tên bác sĩ không được cung cấp
  if (!doctorName || doctorName.trim() === '') {
    return 'Vui lòng cung cấp tên bác sĩ để tìm kiếm.';
  }

  // Tìm tất cả bác sĩ có tên phù hợp (không phân biệt chữ hoa/thường)
  const matchedDoctors = this.doctors.filter((doc) =>
    doc.name.toLowerCase().includes(doctorName.toLowerCase()),
  );

  // Nếu không tìm thấy bác sĩ nào
  if (matchedDoctors.length === 0) {
    return `Không tìm thấy bác sĩ nào có tên "${doctorName}". Vui lòng kiểm tra lại tên hoặc xem danh sách tất cả bác sĩ.`;
  }

  // Nếu chỉ tìm thấy 1 bác sĩ, trả về thông tin chi tiết
  if (matchedDoctors.length === 1) {
    const doctor = matchedDoctors[0];
    const department = this.departments.find(
      (dept) => dept.id === doctor.departmentId,
    );
    console.log(
      'Doctor Info',
      `
Đã tìm thấy bác sĩ:
- Tên: ${doctor.name} (ID: ${doctor.id})
- Khoa: ${department ? department.name : 'Không xác định'} (deptId: ${department.id})
- Chuyên môn: ${doctor.specialization}
- Kinh nghiệm: ${doctor.experience}
- Lịch làm việc: ${doctor.availability.join(', ')}
`,
    );
    return `
Đã tìm thấy bác sĩ:
- Tên: ${doctor.name} (ID: ${doctor.id})
- Khoa: ${department ? department.name : 'Không xác định'} (deptId: ${department.id})
- Chuyên môn: ${doctor.specialization}
- Kinh nghiệm: ${doctor.experience}
- Lịch làm việc: ${doctor.availability.join(', ')}
`;
  }

  // Nếu tìm thấy nhiều bác sĩ có tên giống nhau, trả về giao diện HTML để chọn
  let result = `MULTIPLE_DOCTORS: Có ${matchedDoctors.length} bác sĩ tên ${doctorName} như sau:`;

  for (let i = 0; i < matchedDoctors.length; i++) {
    const doctor = matchedDoctors[i];
    const department = this.departments.find(
      (dept) => dept.id === doctor.departmentId,
    );
    const deptName = department ? department.name : '';
    result += `\n${i + 1}. **Bác sĩ ${doctor.name}** - ${doctor.specialization}, ${doctor.experience}, ${deptName}. (id:${doctor.id}). (deptId: ${department.id})`;
  }

  result += '\n\nBạn muốn khám với bác sĩ nào ạ?';

  // Gửi dữ liệu bác sĩ dưới dạng JSON để HtmlResponseService xử lý
  const doctorsJson = JSON.stringify(matchedDoctors);
  result += `\n[DOCTOR_DATA:${doctorsJson}]`;

  console.log('🚀 ~ findDoctorByName ~ result:', result);
  return result; // Trả về text để agent đọc và HtmlResponseService xử lý
}

// Tìm khoa dựa trên triệu chứng - chỉ trả về danh sách các khoa và triệu chứng
export async function findDepartmentBySymptoms(
  this: any,
  symptoms: string,
): Promise<string> {
  // Sắp xếp các khoa theo thứ tự ID
  const sortedDepartments = [...this.departments].sort((a, b) => {
    const idA = parseInt(a.id.replace('dept_', ''));
    const idB = parseInt(b.id.replace('dept_', ''));
    return idA - idB;
  });

  let result = '';

  // Tạo danh sách tất cả các khoa với triệu chứng tương ứng
  sortedDepartments.forEach((dept) => {
    const deptId = dept.id;
    const deptKeywords = symptomKeywords[deptId] || [];
    result += `Khoa ${dept.name} có id (${dept.id}) gồm các triệu chứng sau: ${deptKeywords.join(', ')}\n`;
  });

  const systemTemplate = `Bạn là một trợ lý ảo của bệnh viện, hãy cung cấp thông tin về các khoa và triệu chứng tương ứng với triệu chứng mà người dùng đã cung cấp. Nếu không có thông tin cụ thể, hãy trả về danh sách tất cả các khoa và triệu chứng tương ứng.`;

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', systemTemplate],
    ['user', '{text}'],
  ]);
  const promptValue = await promptTemplate.invoke({
    text: result,
  });
  const res = await this.model.invoke(promptValue);

  return res.content;

  // return result;
}
