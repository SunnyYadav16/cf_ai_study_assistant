// src/durable-objects/SessionManager.js
export class SessionManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    switch(url.pathname) {
      case '/add':
        return this.addInteraction(request);
      case '/history':
        return this.getHistory();
      case '/clear':
        return this.clearHistory();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  async addInteraction(request) {
    const { message, response } = await request.json();
    const history = await this.state.storage.get('history') || [];

    history.push({
      timestamp: Date.now(),
      userMessage: message,
      aiResponse: response
    });

    // Keep only last 20 interactions
    if (history.length > 20) {
      history.shift();
    }

    await this.state.storage.put('history', history);
    return new Response('OK');
  }

  async getHistory() {
    const history = await this.state.storage.get('history') || [];
    return new Response(JSON.stringify(history), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async clearHistory() {
    await this.state.storage.delete('history');
    return new Response('History cleared');
  }
}