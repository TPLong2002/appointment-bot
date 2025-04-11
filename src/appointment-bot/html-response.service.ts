import { Injectable, Logger } from '@nestjs/common';
import { Doctor } from './appointment-bot.interfaces'; // Import Doctor interface
// Removed AppointmentBotService import
import {
  createDoctorCards,
  createDateSelector,
  createTimeSelector,
} from './html-templates/doctor-cards.template'; // Keep template imports

@Injectable()
export class HtmlResponseService {
  private readonly logger = new Logger(HtmlResponseService.name);

  // Removed constructor dependency injection
  constructor() {}

  processResponseForHtml(message: string): {
    text: string;
    htmlContent?: string;
  } {
    // Handle null or undefined messages gracefully
    if (!message) {
      this.logger.warn('Received null or empty message for HTML processing.');
      return { text: '', htmlContent: '' };
    }

    // Diagnostic Log 1: Log the raw message start and length
    this.logger.log(
      `HtmlResponseService received message (len ${message.length}): "${message.substring(0, 150)}${message.length > 150 ? '...' : ''}"`,
    );

    // Normalize the message for more reliable pattern matching
    const normalizedMessage = message
      .replace(/\*\*/g, '') // Remove markdown bold
      .replace(/\s+/g, ' ') // Replace multiple whitespace/newlines with single space
      .trim(); // Trim leading/trailing whitespace

    this.logger.log(
      `Normalized message for pattern matching: "${normalizedMessage.substring(0, 150)}${normalizedMessage.length > 150 ? '...' : ''}"`,
    );

    // --- Pattern Matching Logic (Uses normalizedMessage) ---
    // PRIORITIZE Confirmation Check

    // 1. Check for Confirmation/Pending Appointment Message (Moved to First Check)
    // Examples: "Đã xác nhận lịch hẹn khám thành công!", "Đã tạo lịch hẹn khám tạm thời!", "Mã lịch hẹn: APT-..."
    // Make check even more lenient: includes "Mã lịch hẹn" (no colon) AND "APT-"
    const includesIdLabel = normalizedMessage.includes('Mã lịch hẹn'); // Check without colon
    const includesApt = normalizedMessage.includes('APT-');
    // Diagnostic Log 2: Log the results of the includes checks on normalized message
    this.logger.log(
      `Normalized Confirmation Check (Lenient): includes('Mã lịch hẹn')=${includesIdLabel}, includes('APT-')=${includesApt}`,
    );

    if (includesIdLabel && includesApt) {
      this.logger.log(
        'Detected appointment confirmation/pending message pattern (includes "Mã lịch hẹn" and "APT-"). Generating confirmation card.',
      );
      // Pass the ORIGINAL message to retain formatting for extraction inside the function
      return this.createConfirmationMessage(message);
    } else {
      this.logger.log(
        'Confirmation pattern NOT matched. Proceeding to other checks.',
      );
    }

    // 2. Check for Multiple Doctors Pattern (from findDoctorByName tool)
    // Example: "MULTIPLE_DOCTORS: Có 2 bác sĩ tên Hoàng Văn E như sau:\n1. **Bác sĩ Hoàng Văn E** - Tim mạch can thiệp, 18 năm kinh nghiệm, Khoa Tim mạch. (id:doc_5). (deptId: dept_3)\n2. **Bác sĩ Hoàng Văn E** - Thần kinh tổng quát, Đột quỵ, 16 năm kinh nghiệm, Khoa Thần kinh. (id:doc_7). (deptId: dept_4)\n\nBạn muốn khám với bác sĩ nào ạ?\n[DOCTOR_DATA:[...]]"
    // Check normalized message for keywords, but extract data from original message
    const multipleDoctorsDataMatch = message.match(
      // Still extract from original message
      /\[DOCTOR_DATA:(\[.*?\])\]/s,
    );
    if (multipleDoctorsDataMatch && multipleDoctorsDataMatch[1]) {
      try {
        const doctors = JSON.parse(multipleDoctorsDataMatch[1]);
        if (Array.isArray(doctors) && doctors.length > 0) {
          this.logger.log(
            `Detected multiple doctors pattern with data. Generating doctor cards.`,
          );
          const textPart = message.replace(/\[DOCTOR_DATA:.*?\]/s, '').trim(); // Use original message for text part
          return {
            text: textPart || 'Vui lòng chọn một bác sĩ từ danh sách:', // Fallback text
            htmlContent: createDoctorCards(doctors),
          };
        }
      } catch (e) {
        this.logger.error('Error parsing DOCTOR_DATA JSON', e);
      }
    }
    // Fallback for older pattern without JSON data (less reliable) - Use normalized message for test
    const multipleDoctorsPattern = /(có \d+ bác sĩ tên).+?(như sau|gồm):/i;
    const doctorListPattern = /(\d+\. Bác sĩ).+? - (.+?)$/im; // Adjusted for normalized text
    if (
      multipleDoctorsPattern.test(normalizedMessage) &&
      doctorListPattern.test(normalizedMessage)
    ) {
      this.logger.log(
        'Detected multiple doctors pattern (fallback). Attempting to parse doctors from text.',
      );
      // Still parse from the ORIGINAL message to get details correctly
      // Match both the markdown format and plain text format
      const doctorLines =
        message.match(/\d+\.\s+\*\*Bác sĩ.+?$/gm) ||
        message.match(/\d+\.\s+Bác sĩ.+?$/gm);
      if (doctorLines && doctorLines.length > 0) {
        const doctors = doctorLines.map((line, index) => {
          const nameMatch = line.match(/\*\*Bác sĩ\s+(.+?)\*\*/i);
          const name = nameMatch ? nameMatch[1] : `Bác sĩ ${index + 1}`;
          const idMatch = line.match(/\(id:(doc_\d+)\)/i);
          const id = idMatch ? idMatch[1] : `doc_temp_${index + 1}`;
          const deptIdMatch = line.match(/\(deptId:\s*(dept_\d+)\)/i);
          const departmentId = deptIdMatch ? deptIdMatch[1] : 'dept_unknown';
          // Extract other details loosely
          const detailsMatch = line.match(
            /\*\*\s+-\s+(.+?)(?:\. \(id:|\(deptId:|$)/i,
          );
          const details = detailsMatch ? detailsMatch[1].split(', ') : [];
          const specialization = details[0] || '';
          const experience = details[1] || '';
          const departmentName = details[2] || '';

          return {
            id,
            name,
            specialization,
            experience,
            departmentId,
            departmentName,
            availability: [], // Cannot determine availability from text
          };
        });
        if (doctors.length > 0) {
          const textPart = message.split('\n\n')[0]; // Get the introductory text
          return {
            text:
              textPart ||
              `Dạ, có ${doctors.length} bác sĩ trùng tên. Vui lòng chọn một bác sĩ:`,
            htmlContent: createDoctorCards(doctors),
          };
        }
      }
    }

    // NEW: 2b. Check for List Doctors by Department Pattern
    // Example 1: "Dạ, dưới đây là danh sách bác sĩ thuộc Khoa Tim mạch:"
    // Example 2: "Dạ, trong Khoa Tim mạch có hai bác sĩ như sau:"
    // Example 3: "Dạ, trong Khoa X có Y bác sĩ như sau:"
    // Broadened pattern to match various formats of department announcements
    const listByDeptPattern =
      /(?:trong\s+Khoa|Khoa)\s+(.+?)(?:\s+có\s+|.*?)(?:như sau|có hai bác sĩ như sau)/i;
    const listByDeptMatch = message.match(listByDeptPattern);
    this.logger.log(
      `Attempting listByDeptPattern match with simplified pattern. Result: ${listByDeptMatch ? 'Matched' : 'No Match'}`,
    ); // Log match result

    if (listByDeptMatch) {
      this.logger.log('List doctors by department pattern MATCHED.'); // Explicit log
      const departmentName = listByDeptMatch[1].trim();
      this.logger.log(`Extracted department name: ${departmentName}`); // Log department name
      // Split based on the numbered list format "X. **Bác sĩ Name**" - handle both with and without spaces
      const doctorSections = message.split(/\n\s*\d+\.[ \t]*\*\*/);
      this.logger.log(`Split into ${doctorSections.length} doctor sections.`); // Log section count
      const doctors: Doctor[] = [];

      if (doctorSections.length > 1) {
        // Start from index 1 because index 0 is the text before the first doctor
        for (let i = 1; i < doctorSections.length; i++) {
          this.logger.log(`Processing doctor section ${i}`); // Log section processing
          const block = `**${doctorSections[i]}`; // Add back the removed "**"
          // Extract Name (first line ending with **)
          const nameMatch = block.match(/^\*\*(?:Bác sĩ\s+)?(.+?)\*\*/i);
          const name = nameMatch ? nameMatch[1].trim() : '';
          this.logger.log(`  Extracted raw name: ${name}`); // Log extracted name

          // Extract other fields based on new labels within the block
          const specMatch = block.match(/-\s+\*\*Chuyên khoa\*\*:\s*(.+)/i);
          const expMatch = block.match(/-\s+\*\*Kinh nghiệm\*\*:\s*(.+)/i);
          const levelMatch = block.match(/-\s+\*\*Trình độ\*\*:\s*(.+)/i);
          // Extract ID from the new line format: "- **ID bác sĩ**: doc_X" or similar formats
          const idMatch =
            block.match(/-\s+\*\*ID bác sĩ\*\*:\s*(doc_\d+)/i) ||
            block.match(/\*\*ID bác sĩ\*\*:\s*(doc_\d+)/i) ||
            block.match(/\(id:(doc_\d+)\)/i);
          const id = idMatch ? idMatch[1] : '';
          this.logger.log(`  Extracted ID: ${id || 'Not Found'}`); // Log extracted ID
          const cleanedName = name; // Name is already clean as ID is on a separate line

          if (!id) {
            // Log warning if ID line is missing or format is wrong
            this.logger.warn(
              `Could not extract Doctor ID for "${cleanedName || 'Unknown Name'}" from block. Expected format: '- **ID bác sĩ**: doc_X'. UI card cannot be generated.`,
            );
          }

          const specialization = specMatch ? specMatch[1].trim() : '';
          this.logger.log(`  Extracted specialization: ${specialization}`); // Log specialization
          const experienceBase = expMatch ? expMatch[1].trim() : '';
          const level = levelMatch ? levelMatch[1].trim() : '';
          this.logger.log(`  Extracted experienceBase: ${experienceBase}`); // Log experience
          this.logger.log(`  Extracted level: ${level}`); // Log level

          // Combine experience and level for display
          let combinedExperience = experienceBase;
          if (level) {
            combinedExperience += combinedExperience ? `, ${level}` : level;
          }
          this.logger.log(`  Combined experience: ${combinedExperience}`); // Log combined experience

          // Only add doctor if ID was successfully extracted
          if (cleanedName && id) {
            this.logger.log(`  Adding doctor: ID=${id}, Name=${cleanedName}`); // Log adding doctor
            doctors.push({
              id,
              name: cleanedName,
              specialization,
              experience: combinedExperience,
              departmentId: '',
              availability: [],
            });
          } else if (cleanedName) {
            this.logger.log(
              `  Skipping doctor add (missing ID): Name=${cleanedName}`,
            );
          } else {
            this.logger.log(`  Skipping doctor add (missing name)`);
            this.logger.warn(
              `Could not parse name from block: ${block.substring(0, 50)}...`,
            );
          }
        }
      }

      // Only generate HTML if doctors with IDs were successfully parsed
      if (doctors.length > 0) {
        this.logger.log(
          `Parsed ${doctors.length} doctors from department list. Generating cards.`,
        );
        const textPart = message.split('\n\n')[0]; // Get the introductory text
        return {
          text: textPart || `Danh sách bác sĩ Khoa ${departmentName}:`,
          htmlContent: createDoctorCards(doctors),
        };
      } else {
        this.logger.log(
          'List doctors by department pattern matched, but failed to parse doctor details.',
        );
      }
    } else {
      this.logger.log('List doctors by department pattern DID NOT MATCH.'); // Explicit log for no match
    }

    // 3. Check for Available Time Slots Message (Now Third Check)
    // Example: "Các khung giờ còn trống vào ngày 2025-03-21 của bác sĩ Hoàng Văn E: 08:00, 13:00, 16:00."
    // Example: "Vào ngày 2025-03-21, bác sĩ Hoàng Văn E có các khung giờ còn trống như sau:\n- **08:00**\n- **13:00**\n- **16:00**"
    // Use normalized message for the test
    // Use a slightly broader pattern for detection, checking for "khung giờ trống" and a time format
    const timeSlotsPattern = /khung giờ trống/i;
    const containsTime = /\d{2}:\d{2}/.test(normalizedMessage); // Check normalized for time presence

    if (timeSlotsPattern.test(normalizedMessage) && containsTime) {
      this.logger.log(
        'Time slots pattern matched (found "khung giờ trống" and HH:MM).',
      );
      const timeSlots = [];
      // Extract times from the ORIGINAL message, specifically looking for the list format "- **HH:MM**" or similar
      const timeRegex = /-\s+\**(\d{2}:\d{2})\**/g; // Matches "- HH:MM" or "- **HH:MM**"
      let timeMatch;
      while ((timeMatch = timeRegex.exec(message)) !== null) {
        timeSlots.push(timeMatch[1]); // Group 1 captures HH:MM
      }
      this.logger.log(
        `Extracted time slots using specific list format regex: ${JSON.stringify(timeSlots)}`,
      );

      // Fallback regex if the specific list format isn't found
      if (timeSlots.length === 0) {
        this.logger.log(
          'Specific list format regex failed, trying fallback HH:MM regex.',
        );
        const fallbackTimeRegex = /\b(\d{2}:\d{2})\b/g;
        while ((timeMatch = fallbackTimeRegex.exec(message)) !== null) {
          timeSlots.push(timeMatch[1]);
        }
        this.logger.log(
          `Extracted time slots using fallback regex: ${JSON.stringify(timeSlots)}`,
        );
      }

      if (timeSlots.length > 0) {
        this.logger.log(
          `Detected available time slots pattern. Found ${timeSlots.length} slots. Generating time selector.`,
        );
        return {
          text: message, // Keep original message text
          htmlContent: createTimeSelector(timeSlots),
        };
      } else {
        this.logger.log(
          'Time slots pattern detected, but no HH:MM slots found in the message.',
        );
      }
    }

    // 4. Check for Available Days Message (Now Fourth Check)
    // Example: "Bác sĩ Nguyễn Văn A có lịch trống vào các ngày sau: 2025-03-18, 2025-03-20, 2025-03-21."
    // Example: "Dạ, bác sĩ Hoàng Văn E có lịch trống vào các ngày sau:\n\n- **18/03/2025**\n- **20/03/2025**\n- **21/03/2025**"
    // Use normalized message for the test
    const availableDaysPattern = /lịch trống/i;
    const containsDate = /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(
      normalizedMessage, // Check normalized message for date presence
    );

    if (availableDaysPattern.test(normalizedMessage) && containsDate) {
      this.logger.log('Detected potential available days message pattern.');
      const dates = [];
      // Extract dates from the ORIGINAL message
      const dateRegex =
        /\*?\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b\*?/g;
      let dateMatch;
      while ((dateMatch = dateRegex.exec(message)) !== null) {
        // Extract from original
        let dateStr = dateMatch[1];
        // Convert DD/MM/YYYY to YYYY-MM-DD if necessary
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        // Add only valid YYYY-MM-DD dates
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          dates.push(dateStr);
        }
      }

      if (dates.length > 0) {
        this.logger.log(
          `Detected available days pattern. Found ${dates.length} dates (${dates.join(', ')}). Generating date selector.`,
        );
        return {
          text: message, // Keep original message text
          htmlContent: createDateSelector(dates),
        };
      } else {
        this.logger.log(
          'Available days pattern detected, but no YYYY-MM-DD dates found in the message.',
        );
      }
    }

    // --- Fallback ---
    // If no specific pattern is matched, return the original text without HTML
    this.logger.log(
      'No specific HTML pattern detected. Returning original text.',
    );
    return { text: message, htmlContent: '' };
  }

  // This function remains as it only parses the input message string
  private createConfirmationMessage(message: string): {
    text: string;
    htmlContent: string;
  } {
    this.logger.log(
      `Attempting to create confirmation card for message: "${message.substring(0, 100)}..."`,
    ); // Log input message
    let isConfirmed = false;

    // Simplified isConfirmed logic inside createConfirmationMessage:
    // Check for explicit success keywords first.
    const successKeywords = [
      'xác nhận thành công',
      'đã được xác nhận',
      'xác nhận hoàn tất',
    ];
    if (
      successKeywords.some((keyword) => message.toLowerCase().includes(keyword))
    ) {
      isConfirmed = true;
      this.logger.log(
        'Confirmation success keywords detected inside createConfirmationMessage.',
      );
    }
    // If no success keywords, check for pending keywords. If neither, default to pending if ID exists later.
    else {
      const pendingKeywords = ['tạo tạm thời', 'chờ xác nhận'];
      if (
        pendingKeywords.some((keyword) =>
          message.toLowerCase().includes(keyword),
        )
      ) {
        isConfirmed = false; // Explicitly pending
        this.logger.log(
          'Explicit pending keywords detected inside createConfirmationMessage.',
        );
      } else {
        // Default to pending if we are in this function (meaning ID was likely found)
        // but no explicit success/pending keywords were found.
        isConfirmed = false;
        this.logger.log(
          'No explicit success/pending keywords found inside createConfirmationMessage, defaulting to pending.',
        );
      }
    }

    // Extract data using simplified regex capturing everything after the label:
    const appointmentIdMatch = message.match(
      /^.*\*\*Mã lịch hẹn\*\*\s*:\s*(APT-\d+).*$/im,
    ); // Keep specific ID capture
    const patientMatch = message.match(/^.*\*\*Bệnh nhân\*\*\s*:\s*(.*)$/im);
    const phoneMatch = message.match(/^.*\*\*Số điện thoại\*\*\s*:\s*(.*)$/im);
    const dateMatch = message.match(/^.*\*\*Ngày khám\*\*\s*:\s*(.*)$/im);
    const timeMatch = message.match(/^.*\*\*Giờ khám\*\*\s*:\s*(.*)$/im);
    const deptMatch = message.match(/^.*\*\*Khoa\*\*\s*:\s*(.*)$/im); // Capture whole line
    const doctorMatch = message.match(/^.*\*\*Bác sĩ\*\*\s*:\s*(.*)$/im); // Capture whole line

    // Updated helper to trim, remove markdown (**), and optionally remove (ID:...) suffix
    const cleanValue = (
      match: RegExpMatchArray | null,
      groupIndex = 1,
      removeIdSuffix = false,
    ): string => {
      let value =
        match && match[groupIndex]
          ? match[groupIndex].trim().replace(/\*\*/g, '') // Correctly remove double asterisks only
          : '';
      if (removeIdSuffix) {
        // Remove the (ID: ...) part from the end of the string
        value = value.replace(/\s*\(\s*ID\s*:\s*[^)]+\s*\)\s*$/, '').trim();
      }
      return value;
    };

    // Apply cleaning, removing ID suffix for department and doctor
    const appointmentId = cleanValue(appointmentIdMatch); // ID already captured specifically
    const patientName = cleanValue(patientMatch);
    const phoneNumber = cleanValue(phoneMatch);
    const appointmentDate = cleanValue(dateMatch);
    const appointmentTime = cleanValue(timeMatch);
    const department = cleanValue(deptMatch, 1, true); // Remove ID suffix
    const doctorName = cleanValue(doctorMatch, 1, true); // Remove ID suffix

    // Log extracted values for debugging
    this.logger.log(
      `Cleaned Extracted Data: ID=[${appointmentId}], Patient=[${patientName}], Phone=[${phoneNumber}], Date=[${appointmentDate}], Time=[${appointmentTime}], Dept=[${department}], Doctor=[${doctorName}], isConfirmed=${isConfirmed}`,
    );

    // Check if ID extraction failed, which would prevent button rendering for pending state
    if (!appointmentId && !isConfirmed && message.includes('Mã lịch hẹn:')) {
      this.logger.error(
        'CRITICAL: Failed to extract appointmentId from a message that seems to contain it. Button will not render.',
      );
    }

    const status = isConfirmed ? 'confirmed' : 'waiting';
    const iconSymbol = isConfirmed ? '✓' : '⏱️';
    const statusTitle = isConfirmed
      ? 'Đã xác nhận lịch hẹn khám thành công!'
      : 'Lịch hẹn khám đang chờ xác nhận';
    const headerColor = isConfirmed ? '#2e8b57' : '#e69500'; // Green vs Orange
    const iconBgColor = isConfirmed ? '#2e8b57' : '#e69500';
    const cardBorderColor = isConfirmed ? '#4682b4' : '#f0ad4e';
    const cardBgColor = isConfirmed ? '#f0f8ff' : '#fff9e6';

    const confirmationHtml = `
    <style>
      .appointment-card { background-color: ${cardBgColor}; border: 2px solid ${cardBorderColor}; border-radius: 10px; padding: 20px; margin-top: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: Arial, sans-serif; }
      .appointment-header { display: flex; align-items: center; margin-bottom: 15px; color: ${headerColor}; }
      .appointment-icon { background-color: ${iconBgColor}; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 20px; }
      .appointment-title { font-size: 18px; font-weight: bold; }
      .appointment-info { margin-top: 15px; border-top: 1px solid #e0e0e0; padding-top: 15px; }
      .info-row { display: flex; margin-bottom: 10px; }
      .info-label { font-weight: bold; width: 130px; color: #555; }
      .info-value { flex: 1; }
      .appointment-footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #555; }
      .status-badge { display: inline-block; padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; color: white; background-color: ${headerColor}; margin-left: 10px; }
      .action-button { background-color: #28a745; color: white; border: none; border-radius: 5px; padding: 10px 20px; cursor: pointer; font-weight: bold; font-size: 14px; }
      .action-button:hover { background-color: #218838; }
      .action-container { text-align: center; margin-top: 15px; }
    </style>
    <div class="appointment-card">
      <div class="appointment-header">
        <div class="appointment-icon">${iconSymbol}</div>
        <div class="appointment-title">${statusTitle} <span class="status-badge">${status === 'confirmed' ? 'Đã xác nhận' : 'Đang chờ'}</span></div>
      </div>
      <div class="appointment-info">
        ${appointmentId ? `<div class="info-row"><div class="info-label">Mã lịch hẹn:</div><div class="info-value">${appointmentId}</div></div>` : ''}
        ${patientName ? `<div class="info-row"><div class="info-label">Bệnh nhân:</div><div class="info-value">${patientName}</div></div>` : ''}
        ${phoneNumber ? `<div class="info-row"><div class="info-label">Số điện thoại:</div><div class="info-value">${phoneNumber}</div></div>` : ''}
        ${appointmentDate ? `<div class="info-row"><div class="info-label">Ngày khám:</div><div class="info-value">${appointmentDate}</div></div>` : ''}
        ${appointmentTime ? `<div class="info-row"><div class="info-label">Giờ khám:</div><div class="info-value">${appointmentTime}</div></div>` : ''}
        ${department ? `<div class="info-row"><div class="info-label">Khoa:</div><div class="info-value">${department}</div></div>` : ''}
        ${doctorName ? `<div class="info-row"><div class="info-label">Bác sĩ:</div><div class="info-value">${doctorName}</div></div>` : ''}
      </div>
      <div class="appointment-footer">
        <p>Vui lòng đến trước giờ hẹn 15 phút để làm thủ tục. Mang theo CMND/CCCD và thẻ BHYT (nếu có).</p>
        <p>Để hủy hoặc đổi lịch, vui lòng liên hệ số điện thoại 1900-1234 ít nhất 24 giờ trước giờ hẹn.</p>
        ${(() => {
          // Add specific logging right before the button condition check
          this.logger.log(
            `Button Render Check: isConfirmed=${isConfirmed}, appointmentId=[${appointmentId}]`,
          );
          // Correctly return the conditional HTML string or an empty string
          if (!isConfirmed && appointmentId) {
            return `
        <div class="action-container">
          <button onclick="confirmAppointment('${appointmentId}')" class="action-button">Xác nhận lịch hẹn</button>
        </div>
        <script>
          function confirmAppointment(id) {
            if (window.parent && window.parent.postMessage) {
              window.parent.postMessage({ type: 'confirmAppointment', appointmentId: id, message: "xác nhận lịch hẹn " + id }, '*');
            }
          }
        </script>`;
          } else {
            return ''; // Return empty string if condition is not met
          }
        })()} 
      </div>
    </div>`;

    // Return the original text and the generated HTML
    return {
      text: message,
      htmlContent: confirmationHtml,
    };
  }
}
