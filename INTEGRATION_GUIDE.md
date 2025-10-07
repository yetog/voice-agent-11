# ElevenLabs Voice Agent - Universal Integration Guide

**Version**: 1.0
**For**: AI Coding Agents & Developers
**Purpose**: Add voice conversation capabilities to any web application

---

## 🎯 Quick Integration Summary

**What this adds**: Real-time voice AI conversation capability to any web application
**Time to integrate**: 15-30 minutes
**Requirements**: Node.js backend, modern frontend (vanilla JS, React, Vue, etc.)
**User provides**: ElevenLabs API Key + Agent ID

---

## 📋 Prerequisites Checklist

Before starting integration, verify:

- [ ] Application has a Node.js/Express backend (or can add one)
- [ ] Frontend can make HTTP requests to backend
- [ ] Application serves over HTTPS or localhost (required for microphone access)
- [ ] Node.js v18+ installed
- [ ] User has provided: `ELEVEN_LABS_API_KEY` and `ELEVEN_LABS_AGENT_ID`

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
# ElevenLabs Voice Agent Configuration
ELEVEN_LABS_API_KEY=<USER_PROVIDED_API_KEY>
ELEVEN_LABS_AGENT_ID=<USER_PROVIDED_AGENT_ID>
```

**Important**: Add `.env` to `.gitignore` if not already present.

#### 1.3 Create Voice Agent Service Module

Create file: `backend/services/voiceAgentService.js` (or similar location)

```javascript
// backend/services/voiceAgentService.js
import axios from 'axios';

/**
 * ElevenLabs Voice Agent Service
 * Handles authentication and signed URL generation
 */
class VoiceAgentService {
    constructor() {
        this.apiKey = process.env.ELEVEN_LABS_API_KEY;
        this.agentId = process.env.ELEVEN_LABS_AGENT_ID;
        this.baseURL = 'https://api.elevenlabs.io/v1';
    }

    /**
     * Validate that required credentials are configured
     * @returns {boolean} True if valid, false otherwise
     */
    isConfigured() {
        return !!(this.apiKey && this.agentId);
    }

    /**
     * Get a signed URL for secure WebSocket connection
     * @returns {Promise<string>} Signed WebSocket URL
     * @throws {Error} If credentials are missing or request fails
     */
    async getSignedUrl() {
        if (!this.isConfigured()) {
            throw new Error('ElevenLabs credentials not configured');
        }

        try {
            const response = await axios.get(
                `${this.baseURL}/convai/conversation/get_signed_url?agent_id=${this.agentId}`,
                {
                    headers: {
                        'xi-api-key': this.apiKey,
                    },
                    timeout: 10000,
                }
            );

            if (!response.data || !response.data.signed_url) {
                throw new Error('Invalid response from ElevenLabs API');
            }

            return response.data.signed_url;
        } catch (error) {
            console.error('Error getting signed URL:', error.response?.data || error.message);
            throw new Error(`Failed to get signed URL: ${error.message}`);
        }
    }

    /**
     * Get agent ID (for public agents)
     * @returns {string} Agent ID
     */
    getAgentId() {
        return this.agentId;
    }

    /**
     * Health check for voice agent service
     * @returns {Promise<Object>} Service health status
     */
    async healthCheck() {
        return {
            configured: this.isConfigured(),
            agentId: this.agentId ? '✓' : '✗',
            apiKey: this.apiKey ? '✓' : '✗',
        };
    }
}

export default new VoiceAgentService();
```

#### 1.4 Add API Endpoints

Add to your Express server file (e.g., `server.js`, `app.js`, or `routes.js`):

```javascript
// Import at the top of your server file
import voiceAgentService from './services/voiceAgentService.js';

// Add these routes (can be placed anywhere in your route definitions)

/**
 * GET /api/voice/signed-url
 * Returns a signed URL for ElevenLabs voice agent connection
 */
app.get('/api/voice/signed-url', async (req, res) => {
    try {
        const signedUrl = await voiceAgentService.getSignedUrl();
        res.json({ signedUrl });
    } catch (error) {
        console.error('Voice agent error:', error);
        res.status(500).json({
            error: 'Failed to initialize voice agent',
            message: error.message
        });
    }
});

/**
 * GET /api/voice/agent-id
 * Returns the agent ID (for public agents)
 */
app.get('/api/voice/agent-id', (req, res) => {
    try {
        const agentId = voiceAgentService.getAgentId();
        res.json({ agentId });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get agent ID',
            message: error.message
        });
    }
});

/**
 * GET /api/voice/health
 * Health check for voice agent service
 */
app.get('/api/voice/health', async (req, res) => {
    try {
        const health = await voiceAgentService.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

**✅ Backend integration complete!**

---

### Step 2: Frontend Integration

#### 2.1 Install Frontend Dependencies

**For vanilla JavaScript / Webpack projects:**
```bash
npm install @elevenlabs/client
```

**For React projects:**
```bash
npm install @elevenlabs/client
```

**For Vue projects:**
```bash
npm install @elevenlabs/client
```

**For CDN / non-bundled projects:**
```html
<!-- Add to your HTML <head> -->
<script src="https://cdn.jsdelivr.net/npm/@elevenlabs/client@latest/dist/lib.umd.js"></script>
```

#### 2.2 Create Voice Agent Component/Module

Choose the appropriate implementation for your framework:

---

### **Option A: Vanilla JavaScript / Webpack**

Create file: `frontend/src/voiceAgent.js`

```javascript
// frontend/src/voiceAgent.js
import { Conversation } from '@elevenlabs/client';

class VoiceAgent {
    constructor(options = {}) {
        this.conversation = null;
        this.isConnected = false;

        // Callbacks (can be overridden)
        this.onConnect = options.onConnect || (() => {});
        this.onDisconnect = options.onDisconnect || (() => {});
        this.onModeChange = options.onModeChange || (() => {});
        this.onError = options.onError || (() => {});
        this.onMessage = options.onMessage || (() => {});

        // API endpoint base URL
        this.apiBaseUrl = options.apiBaseUrl || '/api/voice';
    }

    /**
     * Request microphone permission
     * @returns {Promise<boolean>} True if granted, false otherwise
     */
    async requestMicrophonePermission() {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            return false;
        }
    }

    /**
     * Get signed URL from backend
     * @returns {Promise<string>} Signed WebSocket URL
     */
    async getSignedUrl() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/signed-url`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.signedUrl;
        } catch (error) {
            console.error('Error getting signed URL:', error);
            throw error;
        }
    }

    /**
     * Start voice conversation
     * @returns {Promise<void>}
     */
    async start() {
        if (this.isConnected) {
            console.warn('Voice agent already connected');
            return;
        }

        // Request microphone permission
        const hasPermission = await this.requestMicrophonePermission();
        if (!hasPermission) {
            throw new Error('Microphone permission required');
        }

        // Get signed URL
        const signedUrl = await this.getSignedUrl();

        // Start conversation
        this.conversation = await Conversation.startSession({
            signedUrl: signedUrl,

            onConnect: () => {
                console.log('✅ Voice agent connected');
                this.isConnected = true;
                this.onConnect();
            },

            onDisconnect: () => {
                console.log('❌ Voice agent disconnected');
                this.isConnected = false;
                this.onDisconnect();
            },

            onError: (error) => {
                console.error('Voice agent error:', error);
                this.onError(error);
            },

            onModeChange: (mode) => {
                console.log('Mode changed:', mode.mode);
                this.onModeChange(mode);
            },

            onMessage: (message) => {
                console.log('Message:', message);
                this.onMessage(message);
            }
        });
    }

    /**
     * Stop voice conversation
     * @returns {Promise<void>}
     */
    async stop() {
        if (this.conversation) {
            await this.conversation.endSession();
            this.conversation = null;
            this.isConnected = false;
        }
    }

    /**
     * Check if currently connected
     * @returns {boolean}
     */
    getConnectionStatus() {
        return this.isConnected;
    }
}

export default VoiceAgent;
```

**Usage in your app:**

```javascript
// Import the voice agent
import VoiceAgent from './voiceAgent.js';

// Create instance
const voiceAgent = new VoiceAgent({
    onConnect: () => {
        console.log('Connected!');
        updateUI('connected');
    },
    onDisconnect: () => {
        console.log('Disconnected!');
        updateUI('disconnected');
    },
    onModeChange: (mode) => {
        if (mode.mode === 'speaking') {
            updateUI('agent-speaking');
        } else {
            updateUI('agent-listening');
        }
    },
    onError: (error) => {
        showError(error.message);
    },
    onMessage: (message) => {
        displayTranscript(message);
    }
});

// Start conversation
document.getElementById('startVoiceBtn').addEventListener('click', async () => {
    try {
        await voiceAgent.start();
    } catch (error) {
        console.error('Failed to start voice agent:', error);
        alert('Failed to start voice conversation');
    }
});

// Stop conversation
document.getElementById('stopVoiceBtn').addEventListener('click', async () => {
    await voiceAgent.stop();
});
```

---

### **Option B: React**

Create file: `src/hooks/useVoiceAgent.js`

```javascript
// src/hooks/useVoiceAgent.js
import { useState, useRef, useCallback } from 'react';
import { Conversation } from '@elevenlabs/client';

export const useVoiceAgent = (options = {}) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState(null);
    const conversationRef = useRef(null);

    const apiBaseUrl = options.apiBaseUrl || '/api/voice';

    const requestMicrophonePermission = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            return true;
        } catch (err) {
            setError('Microphone permission denied');
            return false;
        }
    };

    const getSignedUrl = async () => {
        const response = await fetch(`${apiBaseUrl}/signed-url`);
        if (!response.ok) {
            throw new Error('Failed to get signed URL');
        }
        const data = await response.json();
        return data.signedUrl;
    };

    const start = useCallback(async () => {
        if (conversationRef.current) {
            console.warn('Already connected');
            return;
        }

        try {
            setError(null);

            const hasPermission = await requestMicrophonePermission();
            if (!hasPermission) return;

            const signedUrl = await getSignedUrl();

            conversationRef.current = await Conversation.startSession({
                signedUrl,

                onConnect: () => {
                    console.log('Voice agent connected');
                    setIsConnected(true);
                    options.onConnect?.();
                },

                onDisconnect: () => {
                    console.log('Voice agent disconnected');
                    setIsConnected(false);
                    setIsSpeaking(false);
                    conversationRef.current = null;
                    options.onDisconnect?.();
                },

                onError: (err) => {
                    console.error('Voice agent error:', err);
                    setError(err.message);
                    options.onError?.(err);
                },

                onModeChange: (mode) => {
                    const speaking = mode.mode === 'speaking';
                    setIsSpeaking(speaking);
                    options.onModeChange?.(mode);
                },

                onMessage: (message) => {
                    options.onMessage?.(message);
                }
            });
        } catch (err) {
            console.error('Failed to start voice agent:', err);
            setError(err.message);
        }
    }, [apiBaseUrl, options]);

    const stop = useCallback(async () => {
        if (conversationRef.current) {
            await conversationRef.current.endSession();
            conversationRef.current = null;
            setIsConnected(false);
            setIsSpeaking(false);
        }
    }, []);

    return {
        start,
        stop,
        isConnected,
        isSpeaking,
        error
    };
};
```

**Usage in React component:**

```javascript
// src/components/VoiceButton.js
import React from 'react';
import { useVoiceAgent } from '../hooks/useVoiceAgent';

export const VoiceButton = () => {
    const { start, stop, isConnected, isSpeaking, error } = useVoiceAgent({
        onConnect: () => console.log('Connected!'),
        onDisconnect: () => console.log('Disconnected!'),
        onModeChange: (mode) => console.log('Mode:', mode.mode),
        onMessage: (msg) => console.log('Message:', msg)
    });

    return (
        <div>
            <button onClick={isConnected ? stop : start}>
                {isConnected ? 'Stop' : 'Start'} Voice Agent
            </button>

            {isConnected && (
                <div>
                    Status: {isSpeaking ? 'Agent Speaking' : 'Agent Listening'}
                </div>
            )}

            {error && <div>Error: {error}</div>}
        </div>
    );
};
```

---

### **Option C: Vue 3**

Create file: `src/composables/useVoiceAgent.js`

```javascript
// src/composables/useVoiceAgent.js
import { ref, onUnmounted } from 'vue';
import { Conversation } from '@elevenlabs/client';

export function useVoiceAgent(options = {}) {
    const isConnected = ref(false);
    const isSpeaking = ref(false);
    const error = ref(null);
    let conversation = null;

    const apiBaseUrl = options.apiBaseUrl || '/api/voice';

    const requestMicrophonePermission = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            return true;
        } catch (err) {
            error.value = 'Microphone permission denied';
            return false;
        }
    };

    const getSignedUrl = async () => {
        const response = await fetch(`${apiBaseUrl}/signed-url`);
        if (!response.ok) {
            throw new Error('Failed to get signed URL');
        }
        const data = await response.json();
        return data.signedUrl;
    };

    const start = async () => {
        if (conversation) {
            console.warn('Already connected');
            return;
        }

        try {
            error.value = null;

            const hasPermission = await requestMicrophonePermission();
            if (!hasPermission) return;

            const signedUrl = await getSignedUrl();

            conversation = await Conversation.startSession({
                signedUrl,

                onConnect: () => {
                    console.log('Voice agent connected');
                    isConnected.value = true;
                    options.onConnect?.();
                },

                onDisconnect: () => {
                    console.log('Voice agent disconnected');
                    isConnected.value = false;
                    isSpeaking.value = false;
                    conversation = null;
                    options.onDisconnect?.();
                },

                onError: (err) => {
                    console.error('Voice agent error:', err);
                    error.value = err.message;
                    options.onError?.(err);
                },

                onModeChange: (mode) => {
                    isSpeaking.value = mode.mode === 'speaking';
                    options.onModeChange?.(mode);
                },

                onMessage: (message) => {
                    options.onMessage?.(message);
                }
            });
        } catch (err) {
            console.error('Failed to start voice agent:', err);
            error.value = err.message;
        }
    };

    const stop = async () => {
        if (conversation) {
            await conversation.endSession();
            conversation = null;
            isConnected.value = false;
            isSpeaking.value = false;
        }
    };

    // Cleanup on component unmount
    onUnmounted(() => {
        stop();
    });

    return {
        start,
        stop,
        isConnected,
        isSpeaking,
        error
    };
}
```

**Usage in Vue component:**

```vue
<!-- src/components/VoiceButton.vue -->
<template>
  <div>
    <button @click="isConnected ? stop() : start()">
      {{ isConnected ? 'Stop' : 'Start' }} Voice Agent
    </button>

    <div v-if="isConnected">
      Status: {{ isSpeaking ? 'Agent Speaking' : 'Agent Listening' }}
    </div>

    <div v-if="error" class="error">
      Error: {{ error }}
    </div>
  </div>
</template>

<script setup>
import { useVoiceAgent } from '../composables/useVoiceAgent';

const { start, stop, isConnected, isSpeaking, error } = useVoiceAgent({
  onConnect: () => console.log('Connected!'),
  onDisconnect: () => console.log('Disconnected!'),
  onModeChange: (mode) => console.log('Mode:', mode.mode),
  onMessage: (msg) => console.log('Message:', msg)
});
</script>
```

---

## 🎨 UI Components (Optional)

### Minimal UI Example (HTML + CSS)

```html
<!-- Add to your HTML -->
<div id="voice-agent-widget">
    <button id="voice-toggle" class="voice-btn">
        <span class="icon">🎤</span>
        <span class="text">Start Voice</span>
    </button>
    <div id="voice-status" class="voice-status hidden">
        <span class="status-dot"></span>
        <span class="status-text">Listening...</span>
    </div>
</div>

<style>
.voice-btn {
    padding: 12px 24px;
    background: linear-gradient(135deg, #007AFF, #5856D6);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.voice-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4);
}

.voice-status {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #f5f5f5;
    border-radius: 20px;
}

.voice-status.hidden {
    display: none;
}

.status-dot {
    width: 8px;
    height: 8px;
    background: #34C759;
    border-radius: 50%;
    animation: pulse 2s infinite;
}

.status-dot.speaking {
    background: #007AFF;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
</style>
```

---

## 🧪 Testing the Integration

### Test Backend

```bash
# Test health endpoint
curl http://localhost:YOUR_PORT/api/voice/health

# Expected response:
# {"configured":true,"agentId":"✓","apiKey":"✓"}

# Test signed URL endpoint
curl http://localhost:YOUR_PORT/api/voice/signed-url

# Expected response:
# {"signedUrl":"wss://api.elevenlabs.io/v1/convai/..."}
```

### Test Frontend

1. Open your application
2. Click the voice button
3. Grant microphone permission
4. Start talking
5. Agent should respond

**Success indicators:**
- ✅ Status changes to "Connected"
- ✅ Mode changes between "Speaking" and "Listening"
- ✅ Agent responds to your voice

---

## 🐛 Troubleshooting

### Issue: "Failed to get signed URL"

**Cause**: Missing or invalid credentials

**Fix**:
```bash
# Check .env file
cat .env | grep ELEVEN_LABS

# Verify format:
# ELEVEN_LABS_API_KEY=sk_...
# ELEVEN_LABS_AGENT_ID=agent_...
```

### Issue: "Microphone permission denied"

**Cause**: Browser blocked microphone access

**Fix**:
1. Check browser address bar for 🔒 icon
2. Click → Permissions → Microphone → Allow
3. Refresh page
4. Try again

### Issue: CORS errors

**Cause**: Frontend and backend on different origins

**Fix**: Add to your Express server:
```javascript
import cors from 'cors';
app.use(cors({
    origin: 'http://localhost:YOUR_FRONTEND_PORT',
    credentials: true
}));
```

### Issue: "Module not found: @elevenlabs/client"

**Cause**: Package not installed or bundler config issue

**Fix**:
```bash
# Reinstall
npm install @elevenlabs/client

# For webpack, add to webpack.config.js:
resolve: {
    fallback: {
        "fs": false,
        "path": false,
        "crypto": false
    }
}
```

---

## 📝 Configuration Options

### Voice Agent Options

```javascript
const voiceAgent = new VoiceAgent({
    // API endpoint base URL
    apiBaseUrl: '/api/voice',  // default

    // Callbacks
    onConnect: () => {
        // Called when connection established
    },
    onDisconnect: () => {
        // Called when connection closed
    },
    onModeChange: (mode) => {
        // mode.mode: 'speaking' | 'listening'
    },
    onError: (error) => {
        // Called on errors
    },
    onMessage: (message) => {
        // Called on transcript updates
        // message.role: 'user' | 'assistant'
        // message.message: string
    }
});
```

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Environment variables set on production server
- [ ] HTTPS enabled (required for microphone access)
- [ ] CORS configured for production domain
- [ ] Error logging implemented
- [ ] Rate limiting added to API endpoints
- [ ] Microphone permission UI tested on mobile
- [ ] Browser compatibility tested (Chrome, Safari, Firefox)
- [ ] Loading states added for better UX
- [ ] Cleanup on page unload implemented

---

## 🔒 Security Best Practices

1. **Never expose API keys client-side**
   - ✅ Use signed URLs (as in this integration)
   - ❌ Don't pass API keys to frontend

2. **Environment variables**
   - Store in `.env` file
   - Add `.env` to `.gitignore`
   - Use process.env in code

3. **Rate limiting**
   ```javascript
   import rateLimit from 'express-rate-limit';

   const voiceLimiter = rateLimit({
       windowMs: 15 * 60 * 1000, // 15 minutes
       max: 100 // limit each IP to 100 requests per windowMs
   });

   app.get('/api/voice/signed-url', voiceLimiter, async (req, res) => {
       // ... handler
   });
   ```

4. **HTTPS only**
   - Microphone requires secure context
   - Use Let's Encrypt for free SSL

---

## 💡 Advanced Customization

### Add Transcript Display

```javascript
const voiceAgent = new VoiceAgent({
    onMessage: (message) => {
        const transcriptDiv = document.getElementById('transcript');
        const entry = document.createElement('div');
        entry.className = message.role === 'user' ? 'user-message' : 'agent-message';
        entry.textContent = message.message;
        transcriptDiv.appendChild(entry);
        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
    }
});
```

### Add Analytics

```javascript
let conversationMetrics = {
    startTime: null,
    turns: 0,
    duration: 0
};

const voiceAgent = new VoiceAgent({
    onConnect: () => {
        conversationMetrics.startTime = Date.now();
    },
    onDisconnect: () => {
        conversationMetrics.duration = Date.now() - conversationMetrics.startTime;
        sendAnalytics(conversationMetrics);
    },
    onMessage: () => {
        conversationMetrics.turns++;
    }
});
```

### Custom Voice Selection (if using multiple agents)

```javascript
async function startWithVoice(voiceType) {
    // Map voice types to different agent IDs
    const agentIds = {
        'friendly': 'agent_abc123...',
        'professional': 'agent_def456...',
        'technical': 'agent_ghi789...'
    };

    // Update agent ID before starting
    process.env.ELEVEN_LABS_AGENT_ID = agentIds[voiceType];

    await voiceAgent.start();
}
```

---

## 📚 API Reference

### Backend Endpoints

#### `GET /api/voice/signed-url`
Returns a signed WebSocket URL for secure connection.

**Response:**
```json
{
  "signedUrl": "wss://api.elevenlabs.io/v1/convai/conversation?..."
}
```

**Error Response:**
```json
{
  "error": "Failed to initialize voice agent",
  "message": "Error details..."
}
```

#### `GET /api/voice/agent-id`
Returns the configured agent ID.

**Response:**
```json
{
  "agentId": "agent_xxxxx..."
}
```

#### `GET /api/voice/health`
Health check for voice agent service.

**Response:**
```json
{
  "configured": true,
  "agentId": "✓",
  "apiKey": "✓"
}
```

### Frontend Methods

#### `voiceAgent.start()`
Starts the voice conversation.

**Returns:** `Promise<void>`

**Throws:** Error if microphone denied or connection fails

#### `voiceAgent.stop()`
Stops the voice conversation.

**Returns:** `Promise<void>`

#### `voiceAgent.getConnectionStatus()`
Returns current connection status.

**Returns:** `boolean`

---

## 🎯 Integration Checklist

Use this checklist to verify integration:

### Backend
- [ ] Dependencies installed (`axios`, `cors`, `dotenv`, `express`)
- [ ] `voiceAgentService.js` created
- [ ] API endpoints added to server
- [ ] Environment variables configured
- [ ] Health endpoint returns success

### Frontend
- [ ] `@elevenlabs/client` installed
- [ ] Voice agent module/hook/composable created
- [ ] UI components added
- [ ] Event callbacks implemented
- [ ] Error handling added

### Testing
- [ ] Backend health check passes
- [ ] Signed URL endpoint works
- [ ] Frontend connects successfully
- [ ] Microphone permission works
- [ ] Voice conversation works
- [ ] Disconnect works cleanly

### Production
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Error logging added
- [ ] Rate limiting implemented
- [ ] Documentation updated

---

## 📖 Complete Integration Example

For a complete working example, see:
- **Repository**: https://github.com/yetog/voice-agent-11
- **Backend**: `backend/server.js` and `backend/services/voiceAgentService.js`
- **Frontend**: `frontend/src/js/conversational-app.js`
- **Documentation**: `TUTORIAL.md` and `CONVERSATIONAL_AI_GUIDE.md`

---

## 🆘 Support

**Issues or questions?**
1. Check the troubleshooting section above
2. Review the complete example repository
3. Open an issue on GitHub
4. Check ElevenLabs documentation

---

## 📄 License

This integration guide is provided as educational material. Free to use, modify, and distribute.

---

**Version**: 1.0
**Last Updated**: January 2025
**Author**: Zay Legend
**Repository**: https://github.com/yetog/voice-agent-11
