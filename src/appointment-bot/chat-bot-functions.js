$(document).ready(function () {
  // Helper function to update lastVariables object (ALWAYS returns an object)
  function updateLastVariables(newVars) {
    let currentVars = {};
    // Check if lastVariables is already a valid object
    if (typeof lastVariables === 'object' && lastVariables !== null) {
      currentVars = { ...lastVariables }; // Clone if object
    }
    // NOTE: No longer attempting to parse from string, assume it's an object or empty {}

    // Merge new variables, overwriting existing ones
    const updatedVars = { ...currentVars, ...newVars };

    // Update extractedVariables as well (mirrors lastVariables)
    Object.assign(extractedVariables, updatedVars);

    // Log the updated object for debugging
    console.log('Updated lastVariables object:', updatedVars);

    // Return the object itself
    return updatedVars;
  }

  // Hàm gửi tin nhắn đến backend với thông tin bác sĩ và ngày để tự động lấy các khung giờ trống
  function requestTimeSlotsForDate(doctorId, doctorName, date) {
    if (!doctorId || !date) {
      console.error(
        'Missing required doctorId or date for requestTimeSlotsForDate',
      );
      return;
    }

    console.log(
      `Automatically requesting time slots for doctor ${doctorId} on date ${date}`,
    );

    // Cập nhật currentAppointmentSelection
    window.currentAppointmentSelection.doctorId = doctorId;
    window.currentAppointmentSelection.doctorName = doctorName || 'Bác sĩ';
    window.currentAppointmentSelection.date = date;

    // Cập nhật biến trích xuất
    extractedVariables.doctorId = doctorId;
    if (doctorName) extractedVariables.doctorName = doctorName;
    extractedVariables.appointmentDate = date;

    // Cập nhật lastVariables (now an object) using the helper
    lastVariables = updateLastVariables({
      doctorId: doctorId,
      doctorName: doctorName,
      appointmentDate: date,
    });

    // Gửi tin nhắn yêu cầu các khung giờ trống
    sendMessageToBackend(`SELECTOR:DATE:${doctorId}:${date}`);
  }
  // Hàm cập nhật log entry hiện tại với thông tin mới
  function updateLogEntryWithDoctorInfo(doctorId, doctorName) {
    if (!doctorId || !doctorName) return;

    // Lấy log entry đầu tiên
    const logEntry = document.querySelector(
      '#logContent .log-entry:first-child .log-data:first-child',
    );
    if (!logEntry) return;

    // Kiểm tra xem đã có thông tin bác sĩ chưa
    if (
      logEntry.textContent.includes(`id bác sĩ: ${doctorId}`) ||
      logEntry.textContent.includes(`muốn khám bác sĩ: ${doctorName}`)
    ) {
      return;
    }

    // Thêm thông tin bác sĩ vào cuối log entry
    let content = logEntry.textContent;
    content += content
      ? `, muốn khám bác sĩ: ${doctorName}, id bác sĩ: ${doctorId}`
      : `Muốn khám bác sĩ: ${doctorName}, id bác sĩ: ${doctorId}`;

    logEntry.textContent = content;
  }

  // Khởi tạo biến
  const userId = `user-${Date.now()}`;
  let lastVariables = {}; // Initialize as an empty object
  let isLoading = false;
  let iframeIdCounter = 0;

  // Thêm entry mới vào log
  function addLogEntry(data) {
    if (!data) return;

    const logContent = document.getElementById('logContent');
    const timestamp = new Date().toLocaleTimeString();

    // Handle both string and object data for logging
    let userFriendlyPart = '';
    let machinePartStr = ''; // Use a different name to avoid conflict

    if (typeof data === 'object') {
      // If it's an object, stringify it for the machine part
      machinePartStr = 'Các biến đã trích xuất:\n';
      let hasVars = false;
      for (const [key, value] of Object.entries(data)) {
        if (value) {
          // Only include non-empty values
          machinePartStr += `- ${key}: ${value}\n`;
          hasVars = true;
        }
      }
      if (!hasVars) {
        machinePartStr = 'Chưa có biến nào được trích xuất.';
      }
      // Create a user-friendly summary from the object
      userFriendlyPart =
        Object.entries(data)
          .filter(([, value]) => value) // Filter out empty/null values
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ') || 'Cập nhật trạng thái biến.'; // Provide default if empty
    } else if (typeof data === 'string') {
      // If it's a string, try to parse it like before for display
      if (data.includes('Các biến đã trích xuất:')) {
        const parts = data.split('\n\nCác biến đã trích xuất:');
        userFriendlyPart = parts[0];
        machinePartStr =
          parts.length > 1 ? 'Các biến đã trích xuất:' + parts[1] : '';
      } else {
        userFriendlyPart = data; // Assume it's just a user-friendly string
      }
    } else {
      userFriendlyPart = 'Dữ liệu log không hợp lệ.';
    }

    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
      <div class="log-timestamp">${timestamp}</div>
      <div class="log-data">${userFriendlyPart || 'Không có thông tin'}</div>
      ${machinePartStr ? `<details><summary>Chi tiết</summary><div class="log-data" style="margin-top:5px;">${machinePartStr}</div></details>` : ''}
    `;

    logContent.prepend(logEntry);
  }

  // Thêm log ban đầu (now logs an empty object state)
  addLogEntry(lastVariables);

  // Theo dõi các biến đã được trích xuất (should mirror lastVariables)
  let extractedVariables = { ...lastVariables };

  // Hàm cập nhật biến extractedVariables từ chuỗi tóm tắt (DEPRECATED, use updateLastVariables)
  function updateExtractedVariablesFromSummary(summary) {
    // This function is likely redundant now as lastVariables is the source of truth
    console.warn(
      'updateExtractedVariablesFromSummary called, consider removing if lastVariables is always an object.',
    );
    if (!summary || typeof summary !== 'string') return;

    console.log('Updating from summary string:', summary);
    const tempVars = {};
    const machineReadablePart =
      summary.split('Các biến đã trích xuất:')[1] || '';
    const variableLines = machineReadablePart.match(
      /- ([a-zA-Z]+):\s*([^\n]+)/g,
    );

    if (variableLines) {
      variableLines.forEach((line) => {
        const match = line.match(/- ([a-zA-Z]+):\s*([^\n]+)/);
        if (match && match.length >= 3) {
          const key = match[1];
          const value = match[2].trim();
          tempVars[key] = value;
        }
      });
    }
    // Update both lastVariables and extractedVariables if parsed from string
    lastVariables = { ...lastVariables, ...tempVars };
    Object.assign(extractedVariables, lastVariables);
    console.log('Variables updated from summary string:', lastVariables);
  }

  // Scroll xuống cuối cuộc trò chuyện
  function scrollToBottom() {
    const chatContainer = document.getElementById('chatMessages');
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Hiển thị indicator đang nhập
  function showTypingIndicator() {
    $('#typingIndicator').show();
    scrollToBottom();
  }

  // Ẩn indicator đang nhập
  function hideTypingIndicator() {
    $('#typingIndicator').hide();
  }

  // Điều chỉnh chiều cao của iframe
  function adjustIframeHeight(iframeId) {
    const iframe = document.getElementById(iframeId);
    if (!iframe) return;

    function updateHeight() {
      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document;
        const height = iframeDoc.body.scrollHeight;
        iframe.style.height = `${height + 20}px`; // Add some padding
      } catch (e) {
        console.error('Error adjusting iframe height:', e);
      }
    }

    // Update height at various intervals to handle dynamic content
    updateHeight();
    iframe.onload = updateHeight;
    setTimeout(updateHeight, 500);
    setTimeout(updateHeight, 1000);
  }

  // Xử lý tin nhắn từ iframe
  function handleIframeMessage(event) {
    // Log ALL messages received for debugging
    console.log('Received message event from iframe/window:', event);

    const data = event.data;
    // Basic validation: Check if data exists and has a 'type' property
    if (typeof data !== 'object' || data === null || !data.type) {
      // Ignore messages that don't fit the expected structure (e.g., from browser extensions)
      // console.log('Ignored message from iframe/window (invalid format):', data);
      return;
    }

    console.log('Processing message from iframe:', data); // Log valid messages

    // Lưu trữ lựa chọn hiện tại
    window.currentAppointmentSelection = window.currentAppointmentSelection || {
      departmentId: null,
      departmentName: null,
      doctorId: null,
      doctorName: null,
      date: null,
      time: null,
    };

    // Xử lý các loại tin nhắn từ iframe
    switch (data.type) {
      case 'departmentSelected':
        // Người dùng chọn khoa
        if (data.departmentName) {
          window.currentAppointmentSelection.departmentId = data.departmentId;
          window.currentAppointmentSelection.departmentName =
            data.departmentName;
          window.currentAppointmentSelection.doctorId = null;
          window.currentAppointmentSelection.doctorName = null;
          window.currentAppointmentSelection.date = null;
          window.currentAppointmentSelection.time = null;
          // Update lastVariables object
          lastVariables = updateLastVariables({
            departmentId: data.departmentId,
            departmentName: data.departmentName,
            doctorId: null, // Clear doctor selection
            doctorName: null,
            appointmentDate: null, // Clear date/time
            appointmentTime: null,
          });
          sendMessageToBackend(
            `SELECTOR:DEPARTMENT:${data.departmentId}:${data.departmentName}`,
          );
        }
        break;

      case 'doctorSelected':
        // Người dùng chọn bác sĩ
        if (data.doctorName) {
          window.currentAppointmentSelection.doctorId = data.doctorId;
          window.currentAppointmentSelection.doctorName = data.doctorName;
          window.currentAppointmentSelection.date = null;
          window.currentAppointmentSelection.time = null;
          // Update lastVariables object
          lastVariables = updateLastVariables({
            doctorId: data.doctorId,
            doctorName: data.doctorName,
            appointmentDate: null, // Clear date/time
            appointmentTime: null,
          });
          sendMessageToBackend(
            `SELECTOR:DOCTOR:${data.doctorId}:${data.doctorName}`,
          );
        }
        break;

      case 'dateSelected':
        // Người dùng chọn ngày
        if (data.date) {
          // Cập nhật thông tin ngày
          window.currentAppointmentSelection.date = data.date;
          extractedVariables.appointmentDate = data.date; // Keep this for immediate use below
          window.currentAppointmentSelection.time = null;

          // Cập nhật lastVariables (now an object) using the helper
          lastVariables = updateLastVariables({
            appointmentDate: data.date,
            appointmentTime: null,
          }); // Clear time

          // Lấy doctorId từ biến đã lưu hoặc các biến trích xuất
          let doctorId =
            window.currentAppointmentSelection.doctorId ||
            extractedVariables.doctorId;
          let doctorName =
            window.currentAppointmentSelection.doctorName ||
            extractedVariables.doctorName;

          // Cập nhật thông tin ngày trong log (using lastVariables object now)
          addLogEntry(lastVariables); // Log the updated state

          // Nếu có doctorId, gửi yêu cầu lấy các khung giờ trống
          if (doctorId) {
            console.log(
              `Requesting time slots using doctor ${doctorId} and date ${data.date}`,
            );
            requestTimeSlotsForDate(doctorId, doctorName, data.date);
          } else {
            // Nếu không có doctorId, thông báo lỗi hoặc yêu cầu chọn bác sĩ trước
            console.log(
              'No doctorId available, cannot proceed with date selection',
            );
            addMessageToChat(
              'assistant',
              'Vui lòng chọn bác sĩ trước khi chọn ngày.',
            );
            // Send a message indicating date selection anyway
            console.log(
              `Date selected: ${data.date}. Doctor unknown. Sending generic message.`,
            ); // Added log
            sendMessageToBackend(`Tôi đã chọn ngày ${data.date}.`);
          }
        }
        break;

      case 'timeSelected':
        // Người dùng chọn giờ
        if (data.time) {
          const selectedTime = data.time; // Use a local variable for clarity
          console.log(`Processing timeSelected: ${selectedTime}`); // Log time selection start
          window.currentAppointmentSelection.time = selectedTime;

          // Cập nhật biến extractedVariables với giờ đã chọn
          extractedVariables.appointmentTime = selectedTime;

          // Cập nhật lastVariables using the helper (now an object)
          lastVariables = updateLastVariables({
            appointmentTime: selectedTime,
          });

          // Gửi đầy đủ thông tin đã chọn (nếu có) hoặc chỉ giờ đã chọn
          const doctorId =
            window.currentAppointmentSelection.doctorId ||
            extractedVariables.doctorId;
          const doctorName =
            window.currentAppointmentSelection.doctorName ||
            extractedVariables.doctorName;
          const date =
            window.currentAppointmentSelection.date ||
            extractedVariables.appointmentDate;

          // Luôn cập nhật log với thông tin giờ khám đã chọn
          addLogEntry(lastVariables); // Log the updated state

          // Always send a message to backend indicating the time selection
          let messageToSend = `Tôi đã chọn giờ ${selectedTime}.`;
          if (doctorId && date) {
            // If context is available, send the structured message
            messageToSend = `SELECTOR:TIME:${doctorId}:${doctorName || 'Bác sĩ'}:${date}:${selectedTime}`;
            console.log(
              `Time selected: ${selectedTime}. Doctor and Date known. Sending structured message: ${messageToSend}`,
            ); // Added log
          } else {
            console.warn(
              `Time selected: ${selectedTime}. Missing doctorId or date. Sending generic message.`,
            ); // Added log
          }
          sendMessageToBackend(messageToSend);
        }
        break;

      case 'confirmAppointment':
        // Người dùng xác nhận lịch hẹn từ giao diện
        console.log('Confirming appointment...');

        // Use lastVariables directly as it should be the most up-to-date object
        const confirmedData = { ...lastVariables };

        // Log lại hẹn đã được xác nhận
        console.log('Confirmed appointment details:', confirmedData);

        // Tạo log entry cho lịch hẹn đã xác nhận
        addLogEntry({ ...confirmedData, status: 'confirmed' }); // Add status for clarity

        // Gửi tin nhắn xác nhận
        sendMessageToBackend('xác nhận');
        break;

      default:
        console.warn(`Received unknown message type from iframe: ${data.type}`);
    }
  }

  // Set up global message handler once
  window.addEventListener('message', handleIframeMessage);

  // Remove the redundant second event listener

  // Thêm tin nhắn vào giao diện chat
  function addMessageToChat(role, content, isHtml = false) {
    const messageClass = role === 'user' ? 'user-message' : 'bot-message';
    let messageHtml;

    if (isHtml) {
      // Nếu là HTML, tạo iframe để hiển thị an toàn
      const iframeId = `iframe-${iframeIdCounter++}`;
      messageHtml = `
                <div class="${messageClass}" style="width: 100%; max-width: 100%;">
                    <iframe id="${iframeId}" class="message-iframe" frameborder="0"></iframe>
                </div>
            `;

      // Thêm tin nhắn vào trước typing indicator
      $('#typingIndicator').before(messageHtml);

      // Tạo nội dung cho iframe
      setTimeout(() => {
        const iframe = document.getElementById(iframeId);
        if (!iframe) return;

        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document;

        // Set standard HTML template with no scripts from live-reload
        const template = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                margin: 0;
                                padding: 0;
                            }
                        </style>
                    </head>
                    <body>${content}</body>
                    </html>
                `;

        iframeDoc.open();
        iframeDoc.write(template);
        iframeDoc.close();

        // Adjust iframe height to content
        adjustIframeHeight(iframeId);
      }, 100);
    } else {
      // Nếu là text bình thường
      messageHtml = `
                <div class="${messageClass}">
                    <div class="message-content">${content}</div>
                </div>
            `;

      // Thêm tin nhắn vào trước typing indicator
      $('#typingIndicator').before(messageHtml);
    }

    scrollToBottom();
  }

  // Quick action
  window.sendQuickMessage = function (text) {
    // Thêm tin nhắn người dùng vào chat
    addMessageToChat('user', text);
    // Gửi tin nhắn đến backend
    sendMessageToBackend(text);
  };

  // Trích xuất biến từ tin nhắn người dùng (DEPRECATED - handled by backend/updateLastVariables)
  function extractVariablesFromMessage(message) {
    console.warn(
      'extractVariablesFromMessage called - this should ideally be handled by backend.',
    );
    // Update from lastVariables object first
    if (typeof lastVariables === 'object' && lastVariables !== null) {
      Object.assign(extractedVariables, lastVariables);
    }
    // Basic parsing for demonstration, but backend should be primary source
    const phoneMatch = message.match(/(\d{9,11})/g);
    if (phoneMatch) extractedVariables.phoneNumber = phoneMatch[0];
    const symptomsMatch = message.match(/đau\s+[^,)]+/i);
    if (symptomsMatch) extractedVariables.symptoms = symptomsMatch[0];
    // ... other basic parsing ...

    // Update lastVariables object
    lastVariables = updateLastVariables(extractedVariables); // Ensure consistency
    return lastVariables; // Return the object
  }

  // Gửi tin nhắn đến backend
  async function sendMessageToBackend(messageText) {
    if (!messageText || isLoading) {
      return;
    }

    // Kiểm tra nếu là lệnh xác nhận
    const isConfirmation = messageText
      .toLowerCase()
      .includes('xác nhận lịch hẹn');
    if (isConfirmation) {
      console.log('Tiến hành xác nhận lịch hẹn:', messageText);
    }

    // Cập nhật trạng thái loading
    isLoading = true;
    showTypingIndicator();

    try {
      // Chuẩn bị dữ liệu gửi đi
      console.log('Sending variables object to server:', lastVariables);

      // Ensure lastVariables is an object before sending
      const variablesObject =
        typeof lastVariables === 'object' && lastVariables !== null
          ? lastVariables
          : {}; // Send empty object if invalid

      // Gọi API backend với object thay vì string
      const response = await fetch(
        'http://localhost:3000/appointment-bot/chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
            message: messageText,
            variables: variablesObject, // Sử dụng object thay vì string
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      console.log('Server response:', data);

      // Không cần lưu tin nhắn vào lịch sử nữa

      // Kiểm tra nếu phản hồi chứa HTML
      let isHtml = false;
      let content = data.text;

      // Nếu phản hồi chứa HTML đặc biệt (từ backend)
      if (data.htmlContent && data.htmlContent.trim() !== '') {
        isHtml = true;
        content = data.htmlContent;
      }

      // Cập nhật lastVariables nếu có từ server
      if (data.variables) {
        // Ensure lastVariables is updated as an object
        lastVariables =
          typeof data.variables === 'object' && data.variables !== null
            ? data.variables
            : {}; // Default to empty object if invalid

        // Log the received object
        console.log(
          'Updated lastVariables from server (object):',
          lastVariables,
        );

        // Update extractedVariables (which should mirror lastVariables)
        Object.assign(extractedVariables, lastVariables);

        // Add log entry using the object
        addLogEntry(lastVariables);

        // Kiểm tra nếu có thông tin bác sĩ trong biến đã trích xuất
        if (extractedVariables.doctorId && extractedVariables.doctorName) {
          console.log('Found doctor info in variables, updating log entry');
          // Cập nhật log entry hiện tại với thông tin bác sĩ
          updateLogEntryWithDoctorInfo(
            extractedVariables.doctorId,
            extractedVariables.doctorName,
          );
        }

        // Hiển thị biến đã cập nhật
        console.log('Extracted variables updated:');
        console.log(JSON.stringify(extractedVariables, null, 2));
      }

      // Hiển thị thông tin token và system prompt (nếu có)
      if (data.token || data.systemPrompt) {
        const logContent = document.getElementById('logContent');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';

        let logHtml = `<div class="log-timestamp">${timestamp}</div>`;

        // Hiển thị thông tin token
        if (data.token) {
          logHtml += `
            <div class="log-data">
              <strong>User Message:</strong> ${messageText}<br>
              <strong>Token Info:</strong><br>
              <pre>${JSON.stringify(data.token, null, 2)}</pre>
            </div>
          `;
        }

        // Hiển thị system prompt (nếu có)
        if (data.systemPrompt) {
          const truncatedPrompt = data.systemPrompt;
          logHtml += `
            <details>
              <summary>System Prompt</summary>
              <div class="log-data" style="margin-top:5px;">
                <pre>${truncatedPrompt}</pre>
              </div>
            </details>
          `;
        }

        logEntry.innerHTML = logHtml;
        logContent.prepend(logEntry);
      }

      // Hiển thị phản hồi từ bot (chỉ hiển thị kết quả cho người dùng, không hiển thị phần tóm tắt biến)
      addMessageToChat('assistant', content, isHtml);
    } catch (error) {
      console.error('Error sending message:', error);

      // Hiển thị thông báo lỗi
      const errorMessage =
        'Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn của bạn. Vui lòng thử lại sau.';
      addMessageToChat('assistant', errorMessage);

      // Không cần lưu vào lịch sử nữa
    } finally {
      // Cập nhật trạng thái
      isLoading = false;
      hideTypingIndicator();
    }
  }

  // Xử lý gửi tin nhắn
  function sendMessage() {
    const messageText = $('#messageInput').val().trim();

    if (!messageText) {
      return;
    }

    // Xóa input và thêm tin nhắn người dùng vào chat
    $('#messageInput').val('');
    addMessageToChat('user', messageText);

    // Không cần trích xuất biến từ tin nhắn nữa, để server xử lý và gửi lại

    // Gửi tin nhắn đến backend
    sendMessageToBackend(messageText);
  }

  // Event listeners
  $('#sendButton').on('click', sendMessage);

  $('#messageInput').on('keypress', function (e) {
    if (e.which === 13) {
      // Enter key
      sendMessage();
      e.preventDefault();
    }
  });

  // Focus vào input khi trang tải xong
  $('#messageInput').focus();

  // Initial scroll to bottom
  scrollToBottom();
});
