export { SessionManager } from './durable-objects/SessionManager.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes
      if (url.pathname === '/api/chat') {
        return await handleChatRequest(request, env, corsHeaders);
      } else if (url.pathname === '/api/session') {
        return await handleSessionRequest(request, env, corsHeaders);
      } else if (url.pathname === '/api/session/clear') {
        return await handleClearSessionRequest(request, env, corsHeaders);
      } else if (url.pathname === '/api/voice') {
        return await handleVoiceRequest(request, env, corsHeaders);
      }

      // Serve static frontend
      return new Response(getHTMLContent(), {
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

export async function handleChatRequest(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const { userId, message } = await request.json();

  if (!userId || !message) {
    return new Response(JSON.stringify({ error: 'Missing userId or message' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Get or create session using Durable Object
  const sessionId = env.SESSION_MANAGER.idFromName(userId);
  const session = env.SESSION_MANAGER.get(sessionId);

  // Get conversation history
  const historyResponse = await session.fetch(new Request('http://session/history'));
  const history = await historyResponse.json();

  // Build context from recent history (last 5 interactions)
  const recentHistory = history.slice(-5).map(h => ({
    user: h.userMessage,
    assistant: h.aiResponse
  }));

  // Generate AI response
  let aiResponse;
  try {
    const prompt = buildPrompt(message, recentHistory);

    // Use Cloudflare AI with increased token limit
    const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      prompt: prompt,
      max_tokens: 2048,  // Increased from 500 to 2048 for complete responses
      temperature: 0.7
    });

    aiResponse = response.response || 'I apologize, but I could not generate a response. Please try again.';
  } catch (error) {
    console.error('AI Error:', error);
    aiResponse = 'I encountered an error while processing your request. Please try again.';
  }

  // Store the interaction in session
  await session.fetch(new Request('http://session/add', {
    method: 'POST',
    body: JSON.stringify({ message, response: aiResponse })
  }));

  return new Response(JSON.stringify({
    response: aiResponse,
    sessionId: userId
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

async function handleSessionRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Missing userId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const sessionId = env.SESSION_MANAGER.idFromName(userId);
  const session = env.SESSION_MANAGER.get(sessionId);

  const response = await session.fetch(new Request('http://session/history'));
  const history = await response.json();

  return new Response(JSON.stringify(history), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

async function handleClearSessionRequest(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Missing userId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const sessionId = env.SESSION_MANAGER.idFromName(userId);
  const session = env.SESSION_MANAGER.get(sessionId);

  await session.fetch(new Request('http://session/clear', { method: 'POST' }));

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

async function handleVoiceRequest(request, env, corsHeaders) {
  // Voice transcription endpoint (optional implementation)
  return new Response(JSON.stringify({
    error: 'Voice transcription not yet implemented'
  }), {
    status: 501,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function buildPrompt(message, history) {
  let prompt = `You are an AI study assistant specializing in programming and computer science education.
You help students understand complex concepts through clear explanations and examples and you can use technical terminology appropriately.
`;

  if (history && history.length > 0) {
    prompt += "Previous conversation context:\n";
    history.forEach(h => {
      prompt += `Student: ${h.user}\nAssistant: ${h.assistant}\n`;
    });
    prompt += "\n";
  }

  prompt += `Current question: ${message}\n\nProvide a helpful, educational response:`;

  return prompt;
}

function getHTMLContent() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Study Assistant</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 800px;
            height: 600px;
            display: flex;
            flex-direction: column;
        }

        header {
            padding: 20px;
            border-bottom: 1px solid #e0e0e0;
            text-align: center;
        }

        header h1 {
            color: #333;
            font-size: 24px;
            margin-bottom: 5px;
        }

        header p {
            color: #666;
            font-size: 14px;
        }

        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .message {
            display: flex;
            align-items: flex-start;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
            justify-content: flex-end;
        }

        .message-content {
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 18px;
            word-wrap: break-word;
        }

        .message.user .message-content {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-bottom-right-radius: 4px;
        }

        .message.assistant .message-content {
            background: #f0f0f0;
            color: #333;
            border-bottom-left-radius: 4px;
        }

        .message.system .message-content {
            background: #ffe4e1;
            color: #d00;
            text-align: center;
            max-width: 100%;
        }

        .timestamp {
            font-size: 11px;
            color: #999;
            margin-top: 4px;
            padding: 0 4px;
        }

        .input-area {
            padding: 20px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
        }

        #messageInput {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 25px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }

        #messageInput:focus {
            border-color: #667eea;
        }

        button {
            padding: 12px 24px;
            border: none;
            border-radius: 25px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: transform 0.2s;
        }

        button:hover {
            transform: scale(1.05);
        }

        button:active {
            transform: scale(0.95);
        }

        #voiceButton {
            padding: 12px 16px;
            font-size: 20px;
        }

        #voiceButton.recording {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff4757 100%);
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }

        .features {
            padding: 10px 20px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
            justify-content: center;
        }

        .features button {
            padding: 8px 16px;
            font-size: 12px;
            background: #f0f0f0;
            color: #666;
        }

        .features button:hover {
            background: #e0e0e0;
        }

        .typing-dots {
            display: flex;
            gap: 4px;
            padding: 8px;
        }

        .typing-dots span {
            width: 8px;
            height: 8px;
            background: #999;
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }

        .typing-dots span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-dots span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typing {
            0%, 60%, 100% { transform: scale(1); opacity: 1; }
            30% { transform: scale(1.3); opacity: 0.7; }
        }

        pre {
            background: #f4f4f4;
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 8px 0;
        }

        code {
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }
        
        .message-content strong { font-weight: bold; }
        
        .message-content em { font-style: italic; }
        
        .message-content ul, .message-content ol { 
          margin: 10px 0; 
          padding-left: 20px; 
        }
        
        .message-content li { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>AI Study Assistant</h1>
            <p>Ask questions about programming and computer science concepts</p>
        </header>

        <div class="chat-container">
            <div id="messages" class="messages"></div>
            <div class="input-area">
                <input type="text" id="messageInput" placeholder="Ask a question..." autofocus>
                <button id="sendButton">Send</button>
                <button id="voiceButton" title="Voice input">🎤</button>
            </div>
        </div>

        <div class="features">
            <button id="clearHistory">Clear History</button>
            <button id="exportChat">Export Chat</button>
        </div>
    </div>

    <script>${getJavaScriptContent()}</script>
</body>
</html>`;
}

function getJavaScriptContent() {
  return `
class StudyAssistant {
  constructor() {
    this.userId = this.getOrCreateUserId();
    this.messages = document.getElementById('messages');
    this.input = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendButton');
    this.voiceButton = document.getElementById('voiceButton');

    this.initializeEventListeners();
    this.loadHistory();
    this.addMessage('system', 'Welcome! I\\'m your AI Study Assistant. Ask me anything about programming and computer science.');
  }

  getOrCreateUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', userId);
    }
    return userId;
  }

  initializeEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.voiceButton.addEventListener('click', () => this.startVoiceInput());

    document.getElementById('clearHistory').addEventListener('click', () => {
      this.clearHistory();
    });

    document.getElementById('exportChat').addEventListener('click', () => {
      this.exportChat();
    });
  }

  async sendMessage() {
    const message = this.input.value.trim();
    if (!message) return;

    this.addMessage('user', message);
    this.input.value = '';

    const typingId = this.showTypingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          message: message
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      this.removeTypingIndicator(typingId);
      this.addMessage('assistant', data.response);

    } catch (error) {
      console.error('Error:', error);
      this.removeTypingIndicator(typingId);
      this.addMessage('system', 'Error: Unable to get response. Please try again.');
    }
  }

  addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + type;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = this.formatMessage(content);
    messageDiv.appendChild(contentDiv);

    if (type !== 'system') {
      const timestampDiv = document.createElement('div');
      timestampDiv.className = 'timestamp';
      timestampDiv.textContent = new Date().toLocaleTimeString();
      messageDiv.appendChild(timestampDiv);
    }

    this.messages.appendChild(messageDiv);
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  formatMessage(content) {
  // First, escape HTML to prevent XSS
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Handle code blocks with triple backticks
  formatted = formatted.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
  
  // Handle inline code with single backticks
  formatted = formatted.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
  
  // Handle bold text with ** or __
  formatted = formatted.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Handle italic text with * or _
  formatted = formatted.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Handle numbered lists (1. 2. 3. etc)
  formatted = formatted.replace(/^(\\d+)\\.\\s+(.+)$/gm, '<li>$2</li>');
  
  // Handle bullet points with * or -
  formatted = formatted.replace(/^\\*\\s+(.+)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/^-\\s+(.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive <li> elements in <ul>
  formatted = formatted.replace(/(<li>.*<\\/li>\\s*)+/g, function(match) {
    return '<ul>' + match + '</ul>';
  });
  
  // Handle line breaks
  formatted = formatted.replace(/\\n/g, '<br>');
  
  return formatted;
}

  async startVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      this.voiceButton.classList.add('recording');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      this.input.value = transcript;
      this.sendMessage();
    };

    recognition.onerror = (event) => {
      this.voiceButton.classList.remove('recording');
      console.error('Voice recognition error:', event.error);
      if (event.error === 'no-speech') {
        alert('No speech detected. Please try again.');
      } else {
        alert('Voice recognition error: ' + event.error);
      }
    };

    recognition.onend = () => {
      this.voiceButton.classList.remove('recording');
    };

    try {
      recognition.start();
    } catch (error) {
      alert('Failed to start voice recognition. Please try again.');
      this.voiceButton.classList.remove('recording');
    }
  }

  showTypingIndicator() {
    const id = 'typing_' + Date.now();
    const indicator = document.createElement('div');
    indicator.id = id;
    indicator.className = 'message assistant typing';
    indicator.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    this.messages.appendChild(indicator);
    this.messages.scrollTop = this.messages.scrollHeight;
    return id;
  }

  removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) indicator.remove();
  }

  async loadHistory() {
    try {
      const response = await fetch('/api/session?userId=' + this.userId);
      if (!response.ok) return;

      const history = await response.json();

      history.forEach(item => {
        this.addMessage('user', item.userMessage);
        this.addMessage('assistant', item.aiResponse);
      });
    } catch (error) {
      console.log('No previous history found');
    }
  }

  async clearHistory() {
    if (confirm('Are you sure you want to clear all conversation history?')) {
      try {
        await fetch('/api/session/clear?userId=' + this.userId, { method: 'POST' });
        this.messages.innerHTML = '';
        this.addMessage('system', 'Conversation history cleared. How can I help you today?');
      } catch (error) {
        alert('Failed to clear history. Please try again.');
      }
    }
  }

  exportChat() {
    const messages = Array.from(this.messages.children);
    let exportText = 'AI Study Assistant - Conversation Export\\n';
    exportText += 'Date: ' + new Date().toLocaleString() + '\\n\\n';

    messages.forEach(msg => {
      const type = msg.className.includes('user') ? 'You' :
                   msg.className.includes('assistant') ? 'AI Assistant' : 'System';
      const content = msg.querySelector('.message-content').textContent;
      const timestamp = msg.querySelector('.timestamp')?.textContent || '';

      exportText += type + ' ' + timestamp + ':\\n' + content + '\\n\\n';
    });

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study-assistant-chat-' + new Date().getTime() + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new StudyAssistant();
});
`;
}