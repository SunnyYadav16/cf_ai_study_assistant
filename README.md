# cf_ai_study_assistant

An AI-powered study assistant built on Cloudflare Workers that helps students learn programming concepts through interactive chat.

## Features
- Real-time chat interface with Llama 3.3 LLM
- Voice-to-text input (Web Speech API)
- Conversation memory and context retention
- Session management using Durable Objects
- Chat history export
- Workflow orchestration for complex interactions

## Tech Stack
- Backend: Cloudflare Workers, Durable Objects (SQLite)
- AI: Cloudflare Workers AI (@cf/meta/llama-3.2-3b-instruct)
- Frontend: Vanilla JS with embedded HTML/CSS
- Storage: Durable Objects for session persistence

## Setup Instructions

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure Cloudflare account: `wrangler login`
4. Create KV namespace: `wrangler kv namespace create MEMORY_STORE`
5. Update wrangler.toml with your KV namespace ID
6. Deploy: `wrangler deploy`

## Local Development
```bash
npm run dev
```

## Production Development
```bash
https://cf-ai-study-assistant.yadav-sunny.workers.dev/
```
