import { Doctor } from '../appointment-bot.interfaces';
import { chatStyles } from './styles';

/**
 * Tạo HTML cho danh sách bác sĩ
 * @param doctors Danh sách bác sĩ
 * @param departmentName Tên khoa
 * @param departmentId ID khoa
 * @returns HTML cho danh sách bác sĩ
 */
export function createDoctorListHtml(
  doctors: Doctor[],
  departmentName: string,
  departmentId: string,
): string {
  if (doctors.length === 0) {
    return `${chatStyles}<div class="p-3 text-center">Không tìm thấy bác sĩ nào trong khoa này.</div>`;
  }

  let html = `${chatStyles}<div class="doctor-list">`;

  doctors.forEach((doctor) => {
    // Tạo chữ cái đầu tiên cho avatar nếu không có hình ảnh
    const initial = doctor.name.split(' ').pop()?.[0] || 'B';

    html += `
      <div class="doctor-card d-flex" data-id="${doctor.id}" data-name="${doctor.name}">
        <div class="doctor-avatar">
          ${initial}
        </div>
        <div class="doctor-info">
          <div class="doctor-name">${doctor.name}</div>
          <div class="doctor-specialty">${doctor.specialization}</div>
          <div class="doctor-experience">${doctor.experience}</div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

/**
 * Tạo HTML cho giao diện chọn ngày
 * @returns HTML cho giao diện chọn ngày
 */
export function createDateSelectionHtml(): string {
  const availableDates = ['2025-03-24', '2025-03-25', '2025-03-26'];
  let html = `${chatStyles}<div class="date-selection">`;

  availableDates.forEach((date) => {
    const displayDate = new Date(date).toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    html += `<button class="date-button" data-date="${date}">${displayDate}</button>`;
  });

  html += `</div>`;
  return html;
}

/**
 * Tạo HTML cho giao diện chọn giờ
 * @param timeSlots Danh sách giờ khám
 * @returns HTML cho giao diện chọn giờ
 */
export function createTimeSelectionHtml(timeSlots: string[]): string {
  if (timeSlots.length === 0) {
    return `${chatStyles}<div class="p-3 text-center">Không có khung giờ nào trống trong ngày này.</div>`;
  }

  let html = `${chatStyles}<div class="time-selection">`;

  timeSlots.forEach((time) => {
    html += `<button class="time-button" data-time="${time}">${time}</button>`;
  });

  html += `</div>`;
  return html;
}
