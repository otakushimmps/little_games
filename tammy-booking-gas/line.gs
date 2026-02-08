function parseLineEvents(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return [];
  }
  const body = JSON.parse(e.postData.contents);
  return body.events || [];
}

function verifyLineSignature(rawBody, signature) {
  const cfg = getConfig();
  if (!cfg.lineChannelSecret) {
    return true;
  }
  if (!signature) {
    return false;
  }
  const hash = Utilities.computeHmacSha256Signature(rawBody, cfg.lineChannelSecret);
  const encoded = Utilities.base64Encode(hash);
  return encoded === signature;
}

function replyLineMessage(replyToken, messages) {
  if (!replyToken) {
    return;
  }
  const cfg = getConfig();
  const payload = {
    replyToken: replyToken,
    messages: messages.map(function(msg) {
      return typeof msg === 'string' ? { type: 'text', text: msg } : msg;
    }),
  };

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + cfg.lineChannelAccessToken,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function getLineUserProfile(userId) {
  if (!userId) {
    return null;
  }
  const cfg = getConfig();
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/profile/' + encodeURIComponent(userId), {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + cfg.lineChannelAccessToken,
    },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() >= 400) {
    return null;
  }
  return JSON.parse(response.getContentText());
}
