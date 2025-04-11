import { Doctor } from '../appointment-bot.interfaces';
import { Logger } from '@nestjs/common';

/**
 * Tạo HTML cho cards bác sĩ - hiển thị chính xác các bác sĩ được truyền vào
 */
export function createDoctorCards(doctors: Doctor[]): string {
  // Styles cho cards
  const styles = `
  <style>
    .doctor-cards {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-top: 15px;
      width: 100%;
    }
    .doctor-card {
      display: flex;
      background-color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 15px;
      cursor: pointer;
      transition: all 0.3s ease;
      width: calc(50% - 10px);
      border: 1px solid #e0e0e0;
    }
    .doctor-card:hover {
      box-shadow: 0 5px 15px rgba(0,0,0,0.15);
      transform: translateY(-2px);
    }
    .doctor-avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: #0d6efd;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      margin-right: 15px;
    }
    .doctor-info {
      flex: 1;
    }
    .doctor-name {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 5px;
    }
    .doctor-specialty {
      color: #666;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .doctor-experience {
      color: #888;
      font-size: 12px;
    }
    @media (max-width: 600px) {
      .doctor-card {
        width: 100%;
      }
    }
  </style>
  `;

  // HTML cho cards bác sĩ - Hiển thị chính xác các bác sĩ được truyền vào
  let html = styles + '<div class="doctor-cards">';

  // Lặp qua các bác sĩ được lọc chính xác theo tên
  doctors.forEach((doctor) => {
    const initial = doctor.name.split(' ').pop()?.charAt(0) || 'X';

    html += `
      <div class="doctor-card" data-id="${doctor.id}" data-name="${doctor.name}" onclick="selectDoctor('${doctor.id}', '${doctor.name}')">
        <div class="doctor-avatar">${initial}</div>
        <div class="doctor-info">
          <div class="doctor-name">${doctor.name}</div>
          <div class="doctor-specialty">${doctor.specialization}</div>
          <div class="doctor-experience">${doctor.experience}</div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  html += `
    <script>
      function selectDoctor(id, name) {
        // Tạo hai tin nhắn: thông thường và định dạng đặc biệt
        const normalMessage = "Tôi muốn khám với bác sĩ " + name;
        const specialMessage = "[DOCTOR_SELECTED] ID: " + id + ", Tên: " + name;
        
        // Send message to parent
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage({
            type: 'doctorSelected',
            doctorId: id,
            doctorName: name,
            message: specialMessage
          }, '*');
        }
      }
    </script>
  `;

  return html;
}

/**
 * Tạo HTML cho giao diện chọn ngày
 */
export function createDateSelector(dates: string[]): string {
  // Styles cho selector ngày
  const styles = `
  <style>
    .date-selector {
      display: flex;
      flex-direction: column;
      width: 100%;
      border: 1px solid #d0e6ff;
      background-color: #f8fbff;
      border-radius: 10px;
      padding: 15px;
    }
    .date-selector-heading {
      text-align: center;
      margin-bottom: 15px;
      font-weight: bold;
      color: #0d6efd;
      font-size: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid #d0e6ff;
    }
    .date-info {
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 5px;
      color: #495057;
      font-size: 14px;
    }
    .date-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .date-button {
      position: relative;
      padding: 12px 15px;
      background-color: #f0f7ff;
      border: 1px solid #bfdaff;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      flex: 1;
      min-width: 100px;
      text-align: center;
      color: #0d6efd;
      font-weight: 500;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .date-button:before {
      content: '📅';
      margin-bottom: 5px;
      font-size: 16px;
    }
    .date-button:hover {
      background-color: #d0e6ff;
      border-color: #95c0ff;
      transform: translateY(-2px);
      box-shadow: 0 3px 5px rgba(0,0,0,0.1);
    }
    .date-button.selected {
      background-color: #0d6efd;
      border-color: #0051cc;
      color: white;
      box-shadow: 0 3px 8px rgba(13, 110, 253, 0.4);
    }
    .date-button.selected:before {
      content: '✓';
    }
  </style>
  `;

  // Convert dates to Vietnamese format for display with timezone safety
  const formatDateForDisplay = (dateStr) => {
    // Parse the date string and handle timezone issues
    const date = new Date(dateStr);
    date.setHours(12); // Set to noon to avoid timezone issues

    // Create days array for Vietnamese display
    const days = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];
    const dayIndex = date.getDay();
    const day = days[dayIndex];

    // Get day and month values with proper formatting
    const day_num = date.getDate();
    const month_num = date.getMonth() + 1; // JavaScript months are 0-based

    // Format date in Vietnamese style: Thu, day/month
    const formattedDate = `${day}, ${day_num}/${month_num}`;

    // Sử dụng logger đã tạo bên trên
    return formattedDate;
  };

  // HTML cho selector ngày
  let html =
    styles +
    '<div class="date-selector"><div class="date-selector-heading">NGÀY KHÁM BỆNH</div>';

  html += `
    <div class="date-info">
      <strong>Chọn ngày khám:</strong> Chỉ hiển thị những <b>ngày</b> có lịch trống. Sau khi chọn ngày, bạn sẽ thấy các khung giờ khả dụng.
    </div>
    <div class="date-buttons">
  `;

  dates.forEach((date) => {
    const displayDate = formatDateForDisplay(date);

    // Parse the date directly here to get components for display
    const dateObj = new Date(date);
    dateObj.setHours(12); // Set to noon to avoid timezone issues
    const dayIndex = dateObj.getDay();
    const day_num = dateObj.getDate();
    const month_num = dateObj.getMonth() + 1;

    // Add a debug log to see what's being passed to the buttons
    // Sử dụng logger đã tạo bên trên

    // Get Vietnamese day of week name
    const days = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];
    const dayName = days[dayIndex];

    // Format the button to match exactly what's in the paste.txt file
    html += `
      <button class="date-button" data-date="${date}" onclick="selectDate('${date}', '${dayName}, ${day_num}/${month_num}')">${dayName}, ${day_num}/${month_num}</button>
    `;
  });

  html += '</div></div>';
  html += `
    <script>
      // Debug function for date selection
      function selectDate(date, displayDate) {
        console.log("selectDate called with date:", date, "displayDate:", displayDate);
        // First, remove selected class from all buttons
        document.querySelectorAll('.date-button').forEach(btn => {
          btn.classList.remove('selected');
        });
        
        // Add selected class to clicked button
        const selector = '.date-button[data-date="' + date + '"]';
        const buttonSelected = document.querySelector(selector);
        if (buttonSelected) {
          buttonSelected.classList.add('selected');
        }
        
        // Tạo tin nhắn đặc biệt để hệ thống có thể xử lý
        // Định dạng SELECTOR:DATE:doctorId:date
        const specialMessage = "SELECTOR:DATE:null:" + date;
        
        // Log for debugging
        console.log('Date selected:', date);
        console.log('Display date:', displayDate);
        
        // Send message to parent
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage({
            type: 'dateSelected',
            date: date,
            displayDate: displayDate,
            message: specialMessage
          }, '*');
        }
      }
    </script>
  `;

  return html;
}

/**
 * Tạo HTML cho giao diện chọn giờ
 */
export function createTimeSelector(times: string[]): string {
  const logger = new Logger('TimeSelector');
  logger.log(`Creating time selector with ${times.length} slots`);
  // Styles cho selector giờ
  const styles = `
  <style>
    .time-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      border: 1px solid #d0e6ff;
      background-color: #f8fbff;
      border-radius: 10px;
      padding: 15px;
    }
    .time-selector-heading {
      text-align: center;
      margin-bottom: 15px;
      font-weight: bold;
      color: #0d6efd;
      font-size: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid #d0e6ff;
    }
    .time-info {
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 5px;
      color: #495057;
      font-size: 14px;
    }
    .time-selector {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 15px;
    }
    .time-button {
      position: relative;
      padding: 12px 15px;
      background-color: #f0f7ff;
      border: 1px solid #bfdaff;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 90px;
      text-align: center;
      color: #0d6efd;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .time-button:before {
      content: '⌚';
      margin-right: 6px;
    }
    .time-button:hover {
      background-color: #d0e6ff;
      border-color: #95c0ff;
      transform: translateY(-2px);
      box-shadow: 0 3px 5px rgba(0,0,0,0.1);
    }
    .time-button.selected {
      background-color: #0d6efd;
      border-color: #0051cc;
      color: white;
      box-shadow: 0 3px 8px rgba(13, 110, 253, 0.4);
    }
    .time-button.selected:before {
      content: '✓';
    }
    .no-times {
      padding: 20px;
      text-align: center;
      background-color: #fff3cd;
      border: 1px solid #ffecb5;
      border-radius: 5px;
      color: #856404;
      width: 100%;
    }
  </style>
  `;

  // HTML cho selector giờ
  let html =
    styles +
    '<div class="time-container"><div class="time-selector-heading">THỜI GIAN KHÁM BỆNH</div>';

  if (times.length === 0) {
    html += `
      <div class="no-times">
        <strong>Không có lịch trống!</strong><br>
        Ngày này không có khung giờ nào khả dụng. Vui lòng chọn ngày khác.
      </div>
    `;
  } else {
    html += `
      <div class="time-info">
        <strong>Chọn giờ khám:</strong> Dưới đây là các <b>khung giờ</b> còn trống cho ngày bạn đã chọn. Nhấn vào một khung giờ để chọn.
      </div>
      <div class="time-selector">
    `;

    times.forEach((time) => {
      html += `
        <button class="time-button" data-time="${time}" onclick="selectTime('${time}')"> ${time}</button>
      `;
    });

    html += '</div>';
  }

  html += '</div>';
  html += `
    <script>
      function selectTime(time) {
        // First, remove selected class from all buttons
        document.querySelectorAll('.time-button').forEach(btn => {
          btn.classList.remove('selected');
        });
        
        // Add selected class to clicked button
        const selector = '.time-button[data-time="' + time + '"]';
        const buttonSelected = document.querySelector(selector);
        if (buttonSelected) {
          buttonSelected.classList.add('selected');
        }
        
        // Tạo tin nhắn đặc biệt để hệ thống có thể xử lý
        // Định dạng SELECTOR:TIME:doctorId:date:time
        const specialMessage = "SELECTOR:TIME:null:null:" + time;
        
        // Send message to parent
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage({
            type: 'timeSelected',
            time: time,
            message: specialMessage
          }, '*');
        }
      }
    </script>
  `;

  return html;
}
