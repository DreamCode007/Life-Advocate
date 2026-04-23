


/* ══════════════════════════════════════
   CHAT ENGINE — AI WELLNESS COMPANION
══════════════════════════════════════ */

var chatMessages = document.getElementById('chatMessages');
var chatInput = document.getElementById('chatInput');
var chatWelcome = document.getElementById('chatWelcome');
var typingIndicator = document.getElementById('typingIndicator');
var conversationStarted = false;
var pendingRequests = 0;
var conversationVersion = 0;

/* ── Keyword detection for smarter responses ── */
function detectCategory(text) {
  var lower = text.toLowerCase();
  if (/stress|overwhelm|pressure|too much|can't cope|burnt out|burnout|exhausted/.test(lower)) return 'stress';
  if (/anxi|worry|worr|nervous|panic|scared|fear|tight|racing/i.test(lower)) return 'anxiety';
  if (/sleep|insomni|can't sleep|rest|tired|awake|night|bed/.test(lower)) return 'sleep';
  if (/mindful|meditat|breath|calm|peace|present|grounding|zen/.test(lower)) return 'mindfulness';
  if (/grat|thankf|appreciat|bless|good things/.test(lower)) return 'gratitude';
  if (/emotion|feel|feeling|mood|sad|happy|angry|depress|lonely|confus/.test(lower)) return 'emotions';
  if (/journal|write|diary|thoughts|express|vent/.test(lower)) return 'journal';
  return 'default';
}

async function getAIResponse(userText) {
  var category = detectCategory(userText);
  var response = await fetch('wellness_api.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: userText,
      topic: category
    })
  });

  var data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || 'Unable to reach the wellness assistant right now.');
  }

  if (!data.reply) {
    throw new Error('The wellness assistant returned an empty response.');
  }

  return data.reply;
}

function getCurrentTime() {
  var now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ── Create message DOM ── */
function createMessage(text, isUser) {
  var msg = document.createElement('div');
  msg.className = 'message ' + (isUser ? 'user' : 'ai');

  var contentWrapper = document.createElement('div');
  var avatarSVG = isUser
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--slate)" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="var(--sage)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21C12 21 5 15 5 10C5 6 8 4 12 7C16 4 19 6 19 10C19 15 12 21 12 21Z"/></svg>';

  var messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.textContent = text;

  var messageTime = document.createElement('div');
  messageTime.className = 'message-time';
  messageTime.textContent = getCurrentTime();

  var avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = avatarSVG;

  contentWrapper.appendChild(messageContent);
  contentWrapper.appendChild(messageTime);

  msg.appendChild(avatar);
  msg.appendChild(contentWrapper);

  return msg;
}

/* ── Send message ── */
async function sendMessage() {
  var text = chatInput.value.trim();
  if (!text) return;
  var version = conversationVersion;

  // Hide welcome if shown
  if (!conversationStarted) {
    conversationStarted = true;
    if (chatWelcome) chatWelcome.style.display = 'none';
  }

  // Add user message
  chatMessages.insertBefore(createMessage(text, true), typingIndicator);
  chatInput.value = '';
  chatInput.style.height = 'auto';
  scrollToBottom();

  // Show typing
  pendingRequests += 1;
  typingIndicator.classList.add('visible');
  scrollToBottom();

  try {
    var response = await getAIResponse(text);
    if (version !== conversationVersion) return;
    chatMessages.insertBefore(createMessage(response, false), typingIndicator);
  } catch (error) {
    if (version !== conversationVersion) return;
    chatMessages.insertBefore(
      createMessage(
        'I could not reach the wellness assistant just now. Please try again in a moment.',
        false
      ),
      typingIndicator
    );
  } finally {
    if (pendingRequests > 0) {
      pendingRequests -= 1;
    }
    if (pendingRequests === 0) {
      typingIndicator.classList.remove('visible');
    }
    scrollToBottom();
  }
}


function sendQuickPromptText(text) {
  chatInput.value = text;
  sendMessage();
}

/* ── Clear chat ── */
function clearChat() {
  // Remove all messages
  var messages = chatMessages.querySelectorAll('.message');
  messages.forEach(function(m) { m.remove(); });

  // Show welcome again
  conversationStarted = false;
  conversationVersion += 1;
  pendingRequests = 0;
  if (chatWelcome) chatWelcome.style.display = '';
  typingIndicator.classList.remove('visible');
}

/* ── Textarea auto-resize & Enter to send ── */
chatInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

chatInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
