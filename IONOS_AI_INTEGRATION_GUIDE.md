# IONOS AI Model Hub - Universal Integration Guide

**Version**: 1.0
**For**: AI Coding Agents & Developers
**Purpose**: Add IONOS AI chat capabilities to any web application

---

## 🎯 Quick Integration Summary

**What this adds**: AI-powered chat completions using IONOS AI Model Hub
**Time to integrate**: 10-20 minutes
**Requirements**: Node.js backend, modern frontend
**User provides**: IONOS API Token

**Available Models**:
- `meta-llama/Meta-Llama-3.1-8B-Instruct` (Fast, efficient)
- `meta-llama/Meta-Llama-3.1-70B-Instruct` (More capable)
- `meta-llama/Meta-Llama-3.1-405B-Instruct` (Most powerful)
- And more (see IONOS AI Model Hub documentation)

---

## 📋 Prerequisites Checklist

Before starting integration, verify:

- [ ] Application has a Node.js/Express backend (or can add one)
- [ ] Frontend can make HTTP requests to backend
- [ ] Node.js v18+ installed
- [ ] User has provided: `IONOS_API_TOKEN`

---

## 🔧 Integration Steps

### Step 1: Backend Integration

#### 1.1 Install Dependencies

Add to your backend's `package.json`:

```json
{
  "dependencies": {
    "axios": "^1.0.0",
    "cors": "^2.8.0",
    "dotenv": "^16.0.0",
    "express": "^4.18.0"
  }
}
```

Run:
```bash
npm install axios cors dotenv express
```

#### 1.2 Add Environment Variables

Add to your `.env` file:

```env
# IONOS AI Model Hub Configuration
IONOS_API_TOKEN=your_ionos_api_token_here

# Optional: Default model
IONOS_DEFAULT_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
```

**Important**: Add `.env` to `.gitignore` if not already present.

#### 1.3 Create IONOS AI Service Module

Create file: `backend/services/ionosAIService.js`

```javascript
// backend/services/ionosAIService.js
import axios from 'axios';

/**
 * IONOS AI Model Hub Service
 * Provides chat completions using IONOS AI models
 */
class IONOSAIService {
    constructor() {
        this.apiToken = process.env.IONOS_API_TOKEN;
        this.baseURL = 'https://openai.inference.de-txl.ionos.com/v1';
        this.defaultModel = process.env.IONOS_DEFAULT_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct';

        this.headers = {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Validate that required credentials are configured
     * @returns {boolean} True if valid, false otherwise
     */
    isConfigured() {
        return !!this.apiToken;
    }

    /**
     * List available AI models
     * @returns {Promise<Object>} Available models
     */
    async listModels() {
        if (!this.isConfigured()) {
            throw new Error('IONOS API token not configured');
        }

        try {
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: this.headers,
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error('Error listing models:', error.response?.data || error.message);
            throw new Error(`Failed to list models: ${error.message}`);
        }
    }

    /**
     * Get chat completion from IONOS AI
     * @param {Array<Object>} messages - Array of message objects with role and content
     * @param {Object} options - Optional parameters
     * @param {string} options.model - Model to use (default: Meta-Llama-3.1-8B-Instruct)
     * @param {number} options.maxTokens - Maximum tokens to generate (default: 500)
     * @param {number} options.temperature - Temperature for randomness 0-2 (default: 0.7)
     * @param {number} options.topP - Nucleus sampling parameter (default: 1)
     * @param {boolean} options.stream - Stream response (default: false)
     * @returns {Promise<string>} Generated response text
     */
    async getChatCompletion(messages, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('IONOS API token not configured');
        }

        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('Messages array is required and must not be empty');
        }

        const {
            model = this.defaultModel,
            maxTokens = 500,
            temperature = 0.7,
            topP = 1,
            stream = false
        } = options;

        try {
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: model,
                    messages: messages,
                    max_tokens: maxTokens,
                    temperature: temperature,
                    top_p: topP,
                    stream: stream
                },
                {
                    headers: this.headers,
                    timeout: 30000
                }
            );

            if (!response.data || !response.data.choices || response.data.choices.length === 0) {
                throw new Error('Invalid response from IONOS AI');
            }

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Error getting chat completion:', error.response?.data || error.message);
            throw new Error(`Failed to get chat completion: ${error.message}`);
        }
    }

    /**
     * Get streaming chat completion from IONOS AI
     * @param {Array<Object>} messages - Array of message objects
     * @param {Object} options - Optional parameters
     * @param {Function} options.onChunk - Callback for each chunk
     * @returns {Promise<void>}
     */
    async getStreamingChatCompletion(messages, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('IONOS API token not configured');
        }

        const {
            model = this.defaultModel,
            maxTokens = 500,
            temperature = 0.7,
            onChunk = () => {}
        } = options;

        try {
            const response = await axios.post(
                `${this.baseURL}/chat/completions`,
                {
                    model: model,
                    messages: messages,
                    max_tokens: maxTokens,
                    temperature: temperature,
                    stream: true
                },
                {
                    headers: this.headers,
                    responseType: 'stream',
                    timeout: 30000
                }
            );

            let buffer = '';

            response.data.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                onChunk(content);
                            }
                        } catch (e) {
                            // Skip malformed JSON
                        }
                    }
                }
            });

            return new Promise((resolve, reject) => {
                response.data.on('end', resolve);
                response.data.on('error', reject);
            });
        } catch (error) {
            console.error('Error getting streaming completion:', error.response?.data || error.message);
            throw new Error(`Failed to get streaming completion: ${error.message}`);
        }
    }

    /**
     * Create a simple chat with history management
     * Useful for maintaining conversation context
     * @param {string} userMessage - User's message
     * @param {Array<Object>} conversationHistory - Previous messages (optional)
     * @param {string} systemPrompt - System prompt to set behavior (optional)
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response with message and updated history
     */
    async chat(userMessage, conversationHistory = [], systemPrompt = null, options = {}) {
        const messages = [];

        // Add system prompt if provided
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // Add conversation history
        messages.push(...conversationHistory);

        // Add current user message
        messages.push({
            role: 'user',
            content: userMessage
        });

        // Get completion
        const response = await this.getChatCompletion(messages, options);

        // Update conversation history
        const updatedHistory = [
            ...conversationHistory,
            { role: 'user', content: userMessage },
            { role: 'assistant', content: response }
        ];

        return {
            message: response,
            conversationHistory: updatedHistory
        };
    }

    /**
     * Health check for IONOS AI service
     * @returns {Promise<Object>} Service health status
     */
    async healthCheck() {
        const configured = this.isConfigured();

        if (!configured) {
            return {
                configured: false,
                status: 'not_configured',
                apiToken: '✗'
            };
        }

        try {
            // Try to list models as a health check
            await this.listModels();
            return {
                configured: true,
                status: 'healthy',
                apiToken: '✓',
                baseURL: this.baseURL
            };
        } catch (error) {
            return {
                configured: true,
                status: 'error',
                apiToken: '✓',
                error: error.message
            };
        }
    }
}

export default new IONOSAIService();
```

#### 1.4 Add API Endpoints

Add to your Express server file (e.g., `server.js`, `app.js`, or `routes.js`):

```javascript
// Import at the top of your server file
import ionosAI from './services/ionosAIService.js';

// Add these routes

/**
 * GET /api/ionos-ai/models
 * List available AI models
 */
app.get('/api/ionos-ai/models', async (req, res) => {
    try {
        const models = await ionosAI.listModels();
        res.json(models);
    } catch (error) {
        console.error('Error listing models:', error);
        res.status(500).json({
            error: 'Failed to list models',
            message: error.message
        });
    }
});

/**
 * POST /api/ionos-ai/chat
 * Get chat completion from IONOS AI
 *
 * Body:
 * {
 *   "message": "User message",
 *   "conversationHistory": [], // optional
 *   "systemPrompt": "You are a helpful assistant", // optional
 *   "options": { // optional
 *     "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
 *     "maxTokens": 500,
 *     "temperature": 0.7
 *   }
 * }
 */
app.post('/api/ionos-ai/chat', async (req, res) => {
    try {
        const {
            message,
            conversationHistory = [],
            systemPrompt = null,
            options = {}
        } = req.body;

        if (!message) {
            return res.status(400).json({
                error: 'Message is required'
            });
        }

        const result = await ionosAI.chat(
            message,
            conversationHistory,
            systemPrompt,
            options
        );

        res.json(result);
    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({
            error: 'Failed to get chat response',
            message: error.message
        });
    }
});

/**
 * POST /api/ionos-ai/completion
 * Get raw chat completion (more control)
 *
 * Body:
 * {
 *   "messages": [
 *     { "role": "system", "content": "You are helpful" },
 *     { "role": "user", "content": "Hello" }
 *   ],
 *   "options": {
 *     "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
 *     "maxTokens": 500,
 *     "temperature": 0.7
 *   }
 * }
 */
app.post('/api/ionos-ai/completion', async (req, res) => {
    try {
        const { messages, options = {} } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Messages array is required'
            });
        }

        const response = await ionosAI.getChatCompletion(messages, options);

        res.json({ response });
    } catch (error) {
        console.error('Error in completion:', error);
        res.status(500).json({
            error: 'Failed to get completion',
            message: error.message
        });
    }
});

/**
 * POST /api/ionos-ai/stream
 * Get streaming chat completion
 * Returns server-sent events (SSE)
 */
app.post('/api/ionos-ai/stream', async (req, res) => {
    try {
        const { messages, options = {} } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Messages array is required'
            });
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        await ionosAI.getStreamingChatCompletion(messages, {
            ...options,
            onChunk: (chunk) => {
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            }
        });

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('Error in streaming:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to stream completion',
                message: error.message
            });
        }
    }
});

/**
 * GET /api/ionos-ai/health
 * Health check for IONOS AI service
 */
app.get('/api/ionos-ai/health', async (req, res) => {
    try {
        const health = await ionosAI.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

**✅ Backend integration complete!**

---

### Step 2: Frontend Integration

#### 2.1 Create IONOS AI Client Module

Choose the appropriate implementation for your framework:

---

### **Option A: Vanilla JavaScript**

Create file: `frontend/src/ionosAI.js`

```javascript
// frontend/src/ionosAI.js

class IONOSAIClient {
    constructor(options = {}) {
        this.apiBaseUrl = options.apiBaseUrl || '/api/ionos-ai';
        this.conversationHistory = [];
    }

    /**
     * Send a chat message
     * @param {string} message - User's message
     * @param {Object} options - Optional parameters
     * @returns {Promise<Object>} Response with message and updated history
     */
    async chat(message, options = {}) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    conversationHistory: this.conversationHistory,
                    systemPrompt: options.systemPrompt,
                    options: {
                        model: options.model,
                        maxTokens: options.maxTokens,
                        temperature: options.temperature
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Update local conversation history
            this.conversationHistory = data.conversationHistory;

            return data;
        } catch (error) {
            console.error('Chat error:', error);
            throw error;
        }
    }

    /**
     * Send a message with streaming response
     * @param {string} message - User's message
     * @param {Function} onChunk - Callback for each chunk
     * @param {Object} options - Optional parameters
     */
    async chatStream(message, onChunk, options = {}) {
        try {
            const messages = [
                ...this.conversationHistory,
                { role: 'user', content: message }
            ];

            const response = await fetch(`${this.apiBaseUrl}/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages,
                    options: {
                        model: options.model,
                        maxTokens: options.maxTokens,
                        temperature: options.temperature
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.chunk) {
                                fullResponse += parsed.chunk;
                                onChunk(parsed.chunk, fullResponse);
                            }
                        } catch (e) {
                            // Skip malformed JSON
                        }
                    }
                }
            }

            // Update conversation history
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: fullResponse }
            );

            return fullResponse;
        } catch (error) {
            console.error('Stream error:', error);
            throw error;
        }
    }

    /**
     * Get available models
     * @returns {Promise<Object>} Available models
     */
    async listModels() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/models`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error listing models:', error);
            throw error;
        }
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Get current conversation history
     * @returns {Array<Object>} Conversation history
     */
    getHistory() {
        return [...this.conversationHistory];
    }

    /**
     * Set conversation history
     * @param {Array<Object>} history - Conversation history
     */
    setHistory(history) {
        this.conversationHistory = history;
    }
}

export default IONOSAIClient;
```

**Usage:**

```javascript
import IONOSAIClient from './ionosAI.js';

const aiClient = new IONOSAIClient();

// Simple chat
document.getElementById('sendBtn').addEventListener('click', async () => {
    const userMessage = document.getElementById('messageInput').value;

    try {
        const response = await aiClient.chat(userMessage, {
            systemPrompt: 'You are a helpful assistant',
            temperature: 0.7
        });

        console.log('AI Response:', response.message);
        displayMessage('assistant', response.message);
    } catch (error) {
        console.error('Error:', error);
    }
});

// Streaming chat
document.getElementById('streamBtn').addEventListener('click', async () => {
    const userMessage = document.getElementById('messageInput').value;

    try {
        await aiClient.chatStream(
            userMessage,
            (chunk, fullText) => {
                // Update UI with each chunk
                updateStreamingMessage(fullText);
            },
            {
                temperature: 0.7
            }
        );
    } catch (error) {
        console.error('Error:', error);
    }
});
```

---

### **Option B: React**

Create file: `src/hooks/useIONOSAI.js`

```javascript
// src/hooks/useIONOSAI.js
import { useState, useCallback, useRef } from 'react';

export const useIONOSAI = (options = {}) => {
    const [conversationHistory, setConversationHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);

    const apiBaseUrl = options.apiBaseUrl || '/api/ionos-ai';

    const chat = useCallback(async (message, chatOptions = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${apiBaseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    conversationHistory,
                    systemPrompt: chatOptions.systemPrompt,
                    options: {
                        model: chatOptions.model,
                        maxTokens: chatOptions.maxTokens,
                        temperature: chatOptions.temperature
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            setConversationHistory(data.conversationHistory);

            return data.message;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [apiBaseUrl, conversationHistory]);

    const chatStream = useCallback(async (message, onChunk, chatOptions = {}) => {
        setIsLoading(true);
        setError(null);

        abortControllerRef.current = new AbortController();

        try {
            const messages = [
                ...conversationHistory,
                { role: 'user', content: message }
            ];

            const response = await fetch(`${apiBaseUrl}/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages,
                    options: {
                        model: chatOptions.model,
                        maxTokens: chatOptions.maxTokens,
                        temperature: chatOptions.temperature
                    }
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.chunk) {
                                fullResponse += parsed.chunk;
                                onChunk(parsed.chunk, fullResponse);
                            }
                        } catch (e) {
                            // Skip
                        }
                    }
                }
            }

            setConversationHistory([
                ...conversationHistory,
                { role: 'user', content: message },
                { role: 'assistant', content: fullResponse }
            ]);

            return fullResponse;
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message);
                throw err;
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [apiBaseUrl, conversationHistory]);

    const clearHistory = useCallback(() => {
        setConversationHistory([]);
    }, []);

    const cancelStream = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    return {
        chat,
        chatStream,
        clearHistory,
        cancelStream,
        conversationHistory,
        isLoading,
        error
    };
};
```

**Usage:**

```javascript
// src/components/ChatComponent.js
import React, { useState } from 'react';
import { useIONOSAI } from '../hooks/useIONOSAI';

export const ChatComponent = () => {
    const [message, setMessage] = useState('');
    const [streamedResponse, setStreamedResponse] = useState('');

    const {
        chat,
        chatStream,
        clearHistory,
        conversationHistory,
        isLoading,
        error
    } = useIONOSAI();

    const handleSend = async () => {
        try {
            const response = await chat(message, {
                systemPrompt: 'You are a helpful assistant',
                temperature: 0.7
            });
            console.log('Response:', response);
            setMessage('');
        } catch (err) {
            console.error('Error:', err);
        }
    };

    const handleStream = async () => {
        setStreamedResponse('');
        try {
            await chatStream(
                message,
                (chunk, fullText) => {
                    setStreamedResponse(fullText);
                },
                { temperature: 0.7 }
            );
            setMessage('');
        } catch (err) {
            console.error('Error:', err);
        }
    };

    return (
        <div>
            <div className="conversation">
                {conversationHistory.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.role}`}>
                        <strong>{msg.role}:</strong> {msg.content}
                    </div>
                ))}
                {streamedResponse && (
                    <div className="message assistant streaming">
                        <strong>assistant:</strong> {streamedResponse}
                    </div>
                )}
            </div>

            <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
            />

            <button onClick={handleSend} disabled={isLoading}>
                Send
            </button>

            <button onClick={handleStream} disabled={isLoading}>
                Stream
            </button>

            <button onClick={clearHistory}>
                Clear History
            </button>

            {error && <div className="error">Error: {error}</div>}
        </div>
    );
};
```

---

### **Option C: Vue 3**

Create file: `src/composables/useIONOSAI.js`

```javascript
// src/composables/useIONOSAI.js
import { ref, computed } from 'vue';

export function useIONOSAI(options = {}) {
    const conversationHistory = ref([]);
    const isLoading = ref(false);
    const error = ref(null);
    let abortController = null;

    const apiBaseUrl = options.apiBaseUrl || '/api/ionos-ai';

    const chat = async (message, chatOptions = {}) => {
        isLoading.value = true;
        error.value = null;

        try {
            const response = await fetch(`${apiBaseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    conversationHistory: conversationHistory.value,
                    systemPrompt: chatOptions.systemPrompt,
                    options: {
                        model: chatOptions.model,
                        maxTokens: chatOptions.maxTokens,
                        temperature: chatOptions.temperature
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            conversationHistory.value = data.conversationHistory;

            return data.message;
        } catch (err) {
            error.value = err.message;
            throw err;
        } finally {
            isLoading.value = false;
        }
    };

    const chatStream = async (message, onChunk, chatOptions = {}) => {
        isLoading.value = true;
        error.value = null;

        abortController = new AbortController();

        try {
            const messages = [
                ...conversationHistory.value,
                { role: 'user', content: message }
            ];

            const response = await fetch(`${apiBaseUrl}/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages,
                    options: {
                        model: chatOptions.model,
                        maxTokens: chatOptions.maxTokens,
                        temperature: chatOptions.temperature
                    }
                }),
                signal: abortController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.chunk) {
                                fullResponse += parsed.chunk;
                                onChunk(parsed.chunk, fullResponse);
                            }
                        } catch (e) {
                            // Skip
                        }
                    }
                }
            }

            conversationHistory.value.push(
                { role: 'user', content: message },
                { role: 'assistant', content: fullResponse }
            );

            return fullResponse;
        } catch (err) {
            if (err.name !== 'AbortError') {
                error.value = err.message;
                throw err;
            }
        } finally {
            isLoading.value = false;
            abortController = null;
        }
    };

    const clearHistory = () => {
        conversationHistory.value = [];
    };

    const cancelStream = () => {
        if (abortController) {
            abortController.abort();
        }
    };

    return {
        chat,
        chatStream,
        clearHistory,
        cancelStream,
        conversationHistory: computed(() => conversationHistory.value),
        isLoading: computed(() => isLoading.value),
        error: computed(() => error.value)
    };
}
```

**Usage:**

```vue
<!-- src/components/ChatComponent.vue -->
<template>
  <div class="chat-container">
    <div class="conversation">
      <div
        v-for="(msg, idx) in conversationHistory"
        :key="idx"
        :class="['message', msg.role]"
      >
        <strong>{{ msg.role }}:</strong> {{ msg.content }}
      </div>
      <div v-if="streamedResponse" class="message assistant streaming">
        <strong>assistant:</strong> {{ streamedResponse }}
      </div>
    </div>

    <div class="input-area">
      <input
        v-model="message"
        @keyup.enter="handleSend"
        placeholder="Type your message..."
        :disabled="isLoading"
      />

      <button @click="handleSend" :disabled="isLoading">
        Send
      </button>

      <button @click="handleStream" :disabled="isLoading">
        Stream
      </button>

      <button @click="clearHistory">
        Clear
      </button>
    </div>

    <div v-if="error" class="error">
      Error: {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useIONOSAI } from '../composables/useIONOSAI';

const message = ref('');
const streamedResponse = ref('');

const {
  chat,
  chatStream,
  clearHistory,
  conversationHistory,
  isLoading,
  error
} = useIONOSAI();

const handleSend = async () => {
  try {
    await chat(message.value, {
      systemPrompt: 'You are a helpful assistant',
      temperature: 0.7
    });
    message.value = '';
  } catch (err) {
    console.error('Error:', err);
  }
};

const handleStream = async () => {
  streamedResponse.value = '';
  try {
    await chatStream(
      message.value,
      (chunk, fullText) => {
        streamedResponse.value = fullText;
      },
      { temperature: 0.7 }
    );
    message.value = '';
  } catch (err) {
    console.error('Error:', err);
  }
};
</script>

<style scoped>
.message {
  margin: 10px 0;
  padding: 10px;
  border-radius: 8px;
}

.message.user {
  background: #e3f2fd;
  text-align: right;
}

.message.assistant {
  background: #f5f5f5;
}

.message.streaming {
  opacity: 0.8;
}

.input-area {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.input-area input {
  flex: 1;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.error {
  color: red;
  margin-top: 10px;
}
</style>
```

---

## 🧪 Testing the Integration

### Test Backend

```bash
# Test health endpoint
curl http://localhost:YOUR_PORT/api/ionos-ai/health

# Expected response:
# {"configured":true,"status":"healthy","apiToken":"✓"}

# Test list models
curl http://localhost:YOUR_PORT/api/ionos-ai/models

# Test chat
curl -X POST http://localhost:YOUR_PORT/api/ionos-ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! Tell me a joke.",
    "systemPrompt": "You are a funny comedian"
  }'
```

### Test Frontend

1. Open your application
2. Type a message
3. Click "Send" or "Stream"
4. Verify AI responds

**Success indicators:**
- ✅ Message appears in conversation
- ✅ AI response is generated
- ✅ Conversation history persists
- ✅ Streaming shows text character-by-character

---

## 🐛 Troubleshooting

### Issue: "IONOS API token not configured"

**Cause**: Missing token in .env

**Fix**:
```bash
# Check .env file
cat .env | grep IONOS_API_TOKEN

# Verify format:
# IONOS_API_TOKEN=your_token_here
```

### Issue: "Failed to list models"

**Cause**: Invalid token or network issue

**Fix**:
1. Verify token is correct
2. Check https://openai.inference.de-txl.ionos.com/v1 is accessible
3. Check firewall/proxy settings

### Issue: "Invalid response from IONOS AI"

**Cause**: Model not available or rate limiting

**Fix**:
- Try a different model
- Check IONOS AI Model Hub status
- Reduce request frequency

---

## 🎨 Advanced Use Cases

### 1. Custom System Prompts

```javascript
// Customer service agent
await aiClient.chat('I need help', {
    systemPrompt: `You are a customer service agent for Acme Corp.
    Be helpful, professional, and solve customer issues efficiently.`
});

// Technical expert
await aiClient.chat('How does async/await work?', {
    systemPrompt: `You are a senior software engineer.
    Explain technical concepts clearly with code examples.`
});

// Creative writer
await aiClient.chat('Write a story about a robot', {
    systemPrompt: `You are a creative fiction writer.
    Write engaging stories with vivid descriptions.`,
    temperature: 0.9  // More creative
});
```

### 2. Different Models for Different Tasks

```javascript
// Fast responses (8B model)
await aiClient.chat('Quick question: what is 2+2?', {
    model: 'meta-llama/Meta-Llama-3.1-8B-Instruct'
});

// Complex reasoning (70B model)
await aiClient.chat('Explain quantum computing', {
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    maxTokens: 1000
});

// Highest capability (405B model)
await aiClient.chat('Write a comprehensive business plan', {
    model: 'meta-llama/Meta-Llama-3.1-405B-Instruct',
    maxTokens: 2000
});
```

### 3. Conversation Context Management

```javascript
// Save conversation to localStorage
localStorage.setItem('chat-history', JSON.stringify(aiClient.getHistory()));

// Load conversation from localStorage
const savedHistory = JSON.parse(localStorage.getItem('chat-history'));
aiClient.setHistory(savedHistory);

// Export conversation
const exportData = {
    timestamp: new Date().toISOString(),
    history: aiClient.getHistory()
};
downloadJSON('conversation.json', exportData);
```

### 4. Streaming with React (Real-time UI updates)

```javascript
const [streamingText, setStreamingText] = useState('');

await chatStream(
    'Write a long story',
    (chunk, fullText) => {
        setStreamingText(fullText);
    },
    {
        temperature: 0.8,
        maxTokens: 2000
    }
);
```

---

## 📝 Available Models

### Meta Llama Models

| Model | Best For | Speed | Capability |
|-------|----------|-------|------------|
| `meta-llama/Meta-Llama-3.1-8B-Instruct` | Quick responses, chatbots | Fast | Good |
| `meta-llama/Meta-Llama-3.1-70B-Instruct` | Complex tasks, analysis | Medium | Great |
| `meta-llama/Meta-Llama-3.1-405B-Instruct` | Advanced reasoning, creativity | Slow | Excellent |

**Note**: Check IONOS AI Model Hub documentation for the latest available models.

---

## 🔒 Security Best Practices

1. **Never expose API token client-side**
   - ✅ Keep token in backend .env
   - ❌ Don't pass token to frontend

2. **Input validation**
   ```javascript
   if (!message || message.trim().length === 0) {
       return res.status(400).json({ error: 'Message required' });
   }

   if (message.length > 10000) {
       return res.status(400).json({ error: 'Message too long' });
   }
   ```

3. **Rate limiting**
   ```javascript
   import rateLimit from 'express-rate-limit';

   const aiLimiter = rateLimit({
       windowMs: 15 * 60 * 1000,
       max: 50 // 50 requests per 15 minutes
   });

   app.post('/api/ionos-ai/chat', aiLimiter, async (req, res) => {
       // ... handler
   });
   ```

4. **Content filtering**
   - Implement profanity filters
   - Block malicious prompts
   - Sanitize user input

---

## 🚀 Production Deployment Checklist

- [ ] Environment variable set on production server
- [ ] Rate limiting implemented
- [ ] Input validation added
- [ ] Error logging configured
- [ ] CORS properly configured
- [ ] API token secured
- [ ] Conversation history storage planned (DB vs. memory)
- [ ] Model selection optimized for cost/performance
- [ ] Timeout handling implemented
- [ ] Retry logic for failed requests

---

## 📚 API Reference

### Backend Endpoints

#### `GET /api/ionos-ai/models`
List available AI models.

**Response:**
```json
{
  "data": [
    {
      "id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "object": "model",
      ...
    }
  ]
}
```

#### `POST /api/ionos-ai/chat`
Simple chat with conversation history management.

**Request:**
```json
{
  "message": "Hello!",
  "conversationHistory": [],
  "systemPrompt": "You are helpful",
  "options": {
    "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "maxTokens": 500,
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "message": "Hello! How can I help you today?",
  "conversationHistory": [
    { "role": "user", "content": "Hello!" },
    { "role": "assistant", "content": "Hello! How can I help you today?" }
  ]
}
```

#### `POST /api/ionos-ai/completion`
Raw completion with full control over messages.

**Request:**
```json
{
  "messages": [
    { "role": "system", "content": "You are helpful" },
    { "role": "user", "content": "Hello!" }
  ],
  "options": {
    "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    "maxTokens": 500,
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "response": "Hello! How can I help you today?"
}
```

#### `POST /api/ionos-ai/stream`
Streaming completion (Server-Sent Events).

**Request:** Same as `/completion`

**Response:** Stream of events:
```
data: {"chunk":"Hello"}

data: {"chunk":"!"}

data: [DONE]
```

#### `GET /api/ionos-ai/health`
Health check.

**Response:**
```json
{
  "configured": true,
  "status": "healthy",
  "apiToken": "✓",
  "baseURL": "https://openai.inference.de-txl.ionos.com/v1"
}
```

---

## 🎯 Integration Checklist

### Backend
- [ ] Dependencies installed
- [ ] `ionosAIService.js` created
- [ ] API endpoints added
- [ ] Environment variable configured
- [ ] Health endpoint returns success

### Frontend
- [ ] IONOS AI client created
- [ ] Chat UI implemented
- [ ] Event handlers added
- [ ] Error handling implemented
- [ ] Conversation history managed

### Testing
- [ ] Health check passes
- [ ] List models works
- [ ] Chat endpoint works
- [ ] Streaming works
- [ ] Error handling works

### Production
- [ ] Rate limiting added
- [ ] Input validation implemented
- [ ] Error logging configured
- [ ] CORS configured
- [ ] Documentation updated

---

## 📖 Complete Example

For a complete working example, see:
- **Repository**: https://github.com/yetog/voice-agent-11
- **Backend**: `backend/server.js` (see `/api/chat` endpoint)
- **Service**: Look for `IONOSAIService` class
- **Frontend**: `frontend/src/js/app.js` (chat functionality)

---

## 🆘 Support

**Issues or questions?**
1. Check troubleshooting section
2. Review IONOS AI Model Hub docs
3. Open GitHub issue
4. Check IONOS support

---

## 📄 License

This integration guide is provided as educational material. Free to use, modify, and distribute.

---

**Version**: 1.0
**Last Updated**: January 2025
**Author**: Zay Legend
**Repository**: https://github.com/yetog/voice-agent-11
