function getGeminiTools() {
  return [{
    functionDeclarations: [
      {
        name: 'check_availability',
        description: '查詢指定日期與開始時間是否可預約',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: { type: 'STRING' },
            startTime: { type: 'STRING' },
            serviceType: { type: 'STRING' },
          },
          required: ['date', 'startTime'],
        },
      },
      {
        name: 'find_alternative_slots',
        description: '查詢 2 天內替代時段',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: { type: 'STRING' },
            startTime: { type: 'STRING' },
            days: { type: 'NUMBER' },
            serviceType: { type: 'STRING' },
          },
          required: ['date', 'startTime'],
        },
      },
      {
        name: 'create_booking',
        description: '建立預約',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            lineUserId: { type: 'STRING' },
            serviceType: { type: 'STRING' },
            date: { type: 'STRING' },
            startTime: { type: 'STRING' },
            notes: { type: 'STRING' },
            isPregnant: { type: 'BOOLEAN' },
            gestationalWeek: { type: 'NUMBER' },
          },
          required: ['name', 'lineUserId', 'serviceType', 'date', 'startTime'],
        },
      },
      {
        name: 'reschedule_booking',
        description: '改期',
        parameters: {
          type: 'OBJECT',
          properties: {
            bookingId: { type: 'STRING' },
            newDate: { type: 'STRING' },
            newStartTime: { type: 'STRING' },
          },
          required: ['bookingId', 'newDate', 'newStartTime'],
        },
      },
      {
        name: 'cancel_booking',
        description: '取消預約',
        parameters: {
          type: 'OBJECT',
          properties: {
            bookingId: { type: 'STRING' },
            reason: { type: 'STRING' },
          },
          required: ['bookingId'],
        },
      },
      {
        name: 'get_booking_by_user',
        description: '查詢使用者預約',
        parameters: {
          type: 'OBJECT',
          properties: {
            lineUserId: { type: 'STRING' },
          },
          required: ['lineUserId'],
        },
      },
    ],
  }];
}

function callGeminiGenerateContent(contents, tools) {
  const cfg = getConfig();
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + cfg.geminiModel + ':generateContent?key=' + cfg.geminiApiKey;
  const payload = {
    contents: contents,
    tools: tools,
    systemInstruction: {
      parts: [{ text: buildSystemPrompt() }],
    },
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  if (code >= 400) {
    throw new Error('Gemini API 錯誤: ' + code + ' ' + resp.getContentText());
  }

  return JSON.parse(resp.getContentText());
}

function executeToolByName(name, args) {
  switch (name) {
    case 'check_availability':
      return checkAvailability(args);
    case 'find_alternative_slots':
      return findAlternativeSlots(args);
    case 'create_booking':
      return createBooking(args);
    case 'reschedule_booking':
      return rescheduleBooking(args);
    case 'cancel_booking':
      return cancelBooking(args);
    case 'get_booking_by_user':
      return getBookingByUser(args);
    default:
      return { error: 'unknown_tool', name: name };
  }
}

function runAssistantConversation(userMessage, userContext) {
  const contents = [
    {
      role: 'user',
      parts: [{ text: JSON.stringify(userContext) + '\n\n使用者訊息：' + userMessage }],
    },
  ];

  const tools = getGeminiTools();
  let bookingResult = null;

  for (let i = 0; i < 4; i++) {
    const response = callGeminiGenerateContent(contents, tools);
    const candidate = response.candidates && response.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts) {
      break;
    }

    const parts = candidate.content.parts;
    const functionCallPart = parts.find(function(part) { return !!part.functionCall; });
    const textPart = parts.find(function(part) { return !!part.text; });

    if (functionCallPart) {
      const name = functionCallPart.functionCall.name;
      const args = functionCallPart.functionCall.args || {};
      const result = executeToolByName(name, args);

      if (name === 'create_booking' && result && result.success) {
        bookingResult = {
          isPregnant: !!args.isPregnant,
          gestationalWeek: args.gestationalWeek,
          booking: result,
        };
      }

      contents.push({
        role: 'model',
        parts: [{ functionCall: functionCallPart.functionCall }],
      });
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: name, response: result } }],
      });
      continue;
    }

    if (textPart) {
      return {
        text: textPart.text,
        bookingResult: bookingResult,
      };
    }
  }

  return {
    text: '抱歉，系統目前較忙碌。我已收到您的需求，請稍候我再為您確認。',
    bookingResult: bookingResult,
  };
}
