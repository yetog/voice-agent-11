# Building a Voice AI Agent with ElevenLabs Conversational AI

## 📚 Tutorial Overview

This tutorial will guide you through building a real-time voice AI assistant using ElevenLabs Conversational AI SDK. By the end, you'll have a working voice agent that can:

- ✅ Have natural voice conversations in real-time
- ✅ Detect when the agent is speaking vs listening
- ✅ Provide visual feedback for connection status
- ✅ Run securely with proper authentication

**Time to Complete**: ~2-3 hours
**Difficulty**: Intermediate
**Prerequisites**: Basic JavaScript, Node.js, and terminal knowledge

---

## 🎯 What You'll Learn

1. How to set up an ElevenLabs Conversational AI agent
2. Modern frontend development with Webpack
3. Backend API development with Express.js
4. Real-time WebSocket communication
5. Secure authentication with signed URLs
6. Audio handling in the browser

---

## 🛠 Prerequisites

### Required Accounts
1. **ElevenLabs Account** (Free tier available)
   - Sign up at https://elevenlabs.io
   - Create a Conversational AI agent
   - Get your API key

2. **GitHub Account** (optional, for deployment)

### Required Software
- **Node.js** v18+ ([Download](https://nodejs.org))
- **npm** (comes with Node.js)
- **Code Editor** (VS Code recommended)
- **Terminal/Command Line**

### Knowledge Required
- Basic JavaScript (ES6+)
- HTML/CSS basics
- Command line basics
- Understanding of REST APIs

---

## 📋 Step 1: Get Your ElevenLabs Credentials

### 1.1 Create an ElevenLabs Account

1. Go to https://elevenlabs.io
2. Sign up for a free account
3. Verify your email

### 1.2 Get Your API Key

1. Go to your [Profile Settings](https://elevenlabs.io/app/settings/api-keys)
2. Click "Create API Key" or copy your existing key
3. **Important**: Save this securely - you'll need it later

### 1.3 Create a Conversational AI Agent

1. Navigate to **Conversational AI** section
2. Click **"Create New Agent"**
3. Configure your agent:
   - **Name**: Give it a descriptive name (e.g., "My Voice Assistant")
   - **Voice**: Choose from available voices
   - **System Prompt**: Define how your agent should behave
   - **Settings**: Configure response speed, interruption handling, etc.

4. **Save the Agent ID**:
   - After creating, copy your Agent ID
   - Format: `agent_xxxxxxxxxxxxxxxxxxxxx`

**Example System Prompt**:
```
You are a helpful AI assistant. You speak in a friendly, conversational tone.
Keep your responses concise and natural. When answering questions, be clear
and helpful. If you don't know something, say so honestly.
```

---

## 📁 Step 2: Project Setup

### 2.1 Create Project Structure

```bash
# Create main project folder
mkdir voice-ai-assistant
cd voice-ai-assistant

# Create backend and frontend folders
mkdir backend frontend

# Initialize git (optional but recommended)
git init
```

### 2.2 Create .gitignore File

Create a `.gitignore` file in the root:

```gitignore
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local

# Build outputs
dist/
build/

# IDE
.vscode/
.DS_Store

# Database and audio files
*.db
audio/
```

**Why**: This prevents committing sensitive files (like API keys) and large dependencies to git.

---

## 🔧 Step 3: Backend Setup

### 3.1 Initialize Backend

```bash
cd backend
npm init -y
```

### 3.2 Install Dependencies

```bash
npm install express cors dotenv axios @elevenlabs/client
```

**What each package does**:
- `express`: Web server framework
- `cors`: Enable cross-origin requests (frontend ↔ backend)
- `dotenv`: Load environment variables from .env file
- `axios`: HTTP client for API calls
- `@elevenlabs/client`: Official ElevenLabs SDK

### 3.3 Create Environment Variables

Create `backend/.env`:

```env
# ElevenLabs Configuration
ELEVEN_LABS_API_KEY=your_api_key_here
ELEVEN_LABS_AGENT_ID=your_agent_id_here

# Server Settings
PORT=5001
```

**⚠️ Security Note**: Never commit this file to git! Add it to .gitignore.

### 3.4 Create Backend Server

Create `backend/server.js`:

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// Get signed URL for ElevenLabs Conversational AI
app.get('/api/signed-url', async (req, res) => {
    try {
        const agentId = process.env.ELEVEN_LABS_AGENT_ID;
        const apiKey = process.env.ELEVEN_LABS_API_KEY;

        if (!agentId || !apiKey) {
            return res.status(500).json({
                error: 'ElevenLabs configuration missing'
            });
        }

        const response = await axios.get(
            `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
            {
                headers: {
                    'xi-api-key': apiKey,
                },
            }
        );

        if (!response.data || !response.data.signed_url) {
            throw new Error('Failed to get signed URL from ElevenLabs');
        }

        res.json({ signedUrl: response.data.signed_url });
    } catch (error) {
        console.error('Error getting signed URL:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to get signed URL',
            details: error.message
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`🎙️  Backend server running on http://localhost:${port}`);
});
```

### 3.5 Update package.json

Add `"type": "module"` to use ES6 imports:

```json
{
  "name": "voice-assistant-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@elevenlabs/client": "^0.7.1",
    "axios": "^1.0.0",
    "cors": "^2.8.0",
    "dotenv": "^16.0.0",
    "express": "^4.18.0"
  }
}
```

### 3.6 Test Backend

```bash
npm start
```

You should see: `🎙️  Backend server running on http://localhost:5001`

Test it:
```bash
curl http://localhost:5001/api/health
# Should return: {"status":"OK","timestamp":"..."}

curl http://localhost:5001/api/signed-url
# Should return: {"signedUrl":"wss://..."}
```

---

## 🎨 Step 4: Frontend Setup

### 4.1 Initialize Frontend

```bash
cd ../frontend
npm init -y
```

### 4.2 Install Dependencies

```bash
npm install @elevenlabs/client
npm install --save-dev webpack webpack-cli webpack-dev-server copy-webpack-plugin
```

### 4.3 Create Webpack Configuration

Create `frontend/webpack.config.js`:

```javascript
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/js/app.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/'
    },
    mode: 'development',
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        port: 3000,
        proxy: [
            {
                context: ['/api'],
                target: 'http://localhost:5001'
            }
        ],
        hot: true
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'index.html', to: 'index.html' },
                { from: 'styles.css', to: 'styles.css' }
            ],
        }),
    ],
    resolve: {
        fallback: {
            "fs": false,
            "path": false,
            "crypto": false
        }
    }
};
```

### 4.4 Update package.json Scripts

```json
{
  "name": "voice-assistant-frontend",
  "version": "1.0.0",
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack serve --mode development",
    "start": "npm run build && npx serve dist"
  }
}
```

### 4.5 Create Project Structure

```bash
mkdir -p src/js
touch index.html styles.css src/js/app.js
```

### 4.6 Create HTML Interface

Create `frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice AI Assistant</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Voice AI Assistant</h1>
            <div class="status">
                <div class="status-dot" id="statusDot"></div>
                <span id="statusText">Disconnected</span>
            </div>
        </header>

        <main>
            <div class="voice-interface">
                <div class="status-badges">
                    <div class="badge" id="connectionBadge">Disconnected</div>
                    <div class="badge" id="modeBadge">Silent</div>
                </div>

                <div class="voice-circle" id="voiceCircle">
                    <svg width="80" height="80" viewBox="0 0 48 48">
                        <path d="M24 30c3.314 0 6-2.686 6-6V12c0-3.314-2.686-6-6-6s-6 2.686-6 6v12c0 3.314 2.686 6 6 6z" fill="currentColor"/>
                        <path d="M14 24c0 5.523 4.477 10 10 10s10-4.477 10-10" stroke="currentColor" stroke-width="2"/>
                        <path d="M24 34v8M18 42h12" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>

                <div class="controls">
                    <button id="startButton" class="btn primary">Start Conversation</button>
                    <button id="endButton" class="btn secondary" disabled>End Conversation</button>
                </div>

                <p class="instructions">
                    Click "Start Conversation" to begin talking with the AI assistant.
                    Grant microphone permission when prompted.
                </p>
            </div>
        </main>
    </div>

    <div id="loadingOverlay" class="loading-overlay" style="display: none;">
        <div class="spinner"></div>
        <p id="loadingText">Connecting...</p>
    </div>

    <div id="errorToast" class="error-toast">
        <p id="errorMessage"></p>
    </div>

    <script src="/bundle.js"></script>
</body>
</html>
```

### 4.7 Create JavaScript Application

Create `frontend/src/js/app.js`:

```javascript
import { Conversation } from '@elevenlabs/client';

let conversation = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const endButton = document.getElementById('endButton');

    startButton.addEventListener('click', startConversation);
    endButton.addEventListener('click', endConversation);

    updateStatus(false);
});

// Request microphone permission
async function requestMicrophonePermission() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        return false;
    }
}

// Get signed URL from backend
async function getSignedUrl() {
    try {
        const response = await fetch('/api/signed-url');
        if (!response.ok) {
            throw new Error('Failed to get signed URL');
        }
        const data = await response.json();
        return data.signedUrl;
    } catch (error) {
        console.error('Error getting signed URL:', error);
        throw error;
    }
}

// Update connection status UI
function updateStatus(isConnected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const connectionBadge = document.getElementById('connectionBadge');

    if (isConnected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Connected';
        connectionBadge.textContent = 'Connected';
        connectionBadge.classList.add('success');
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Disconnected';
        connectionBadge.textContent = 'Disconnected';
        connectionBadge.classList.remove('success');
    }
}

// Update speaking/listening mode UI
function updateMode(modeData) {
    const modeBadge = document.getElementById('modeBadge');
    const voiceCircle = document.getElementById('voiceCircle');

    const isSpeaking = modeData.mode === 'speaking';

    if (isSpeaking) {
        modeBadge.textContent = 'Agent Speaking';
        modeBadge.classList.add('speaking');
        voiceCircle.classList.add('speaking');
    } else {
        modeBadge.textContent = 'Agent Listening';
        modeBadge.classList.remove('speaking');
        voiceCircle.classList.remove('speaking');
    }
}

// Show/hide loading overlay
function showLoading(show, message = 'Connecting...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');

    overlay.style.display = show ? 'flex' : 'none';
    text.textContent = message;
}

// Show error message
function showError(message) {
    const toast = document.getElementById('errorToast');
    const errorMsg = document.getElementById('errorMessage');

    errorMsg.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

// Start conversation
async function startConversation() {
    const startButton = document.getElementById('startButton');
    const endButton = document.getElementById('endButton');

    try {
        showLoading(true, 'Requesting microphone access...');

        // Request microphone permission
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
            showError('Microphone permission is required');
            showLoading(false);
            return;
        }

        showLoading(true, 'Connecting to ElevenLabs...');

        // Get signed URL from backend
        const signedUrl = await getSignedUrl();

        // Start conversation session
        conversation = await Conversation.startSession({
            signedUrl: signedUrl,

            onConnect: () => {
                console.log('✅ Connected to ElevenLabs');
                updateStatus(true);
                startButton.disabled = true;
                endButton.disabled = false;
                showLoading(false);
            },

            onDisconnect: () => {
                console.log('❌ Disconnected from ElevenLabs');
                updateStatus(false);
                startButton.disabled = false;
                endButton.disabled = true;
            },

            onError: (error) => {
                console.error('Error:', error);
                showError(`Error: ${error.message}`);
                showLoading(false);
            },

            onModeChange: (mode) => {
                console.log('Mode changed:', mode);
                updateMode(mode);
            },

            onMessage: (message) => {
                console.log('Message:', message);
            }
        });

    } catch (error) {
        console.error('Failed to start conversation:', error);
        showError(`Failed to start: ${error.message}`);
        showLoading(false);
        startButton.disabled = false;
        endButton.disabled = true;
    }
}

// End conversation
async function endConversation() {
    const startButton = document.getElementById('startButton');
    const endButton = document.getElementById('endButton');

    try {
        if (conversation) {
            showLoading(true, 'Ending conversation...');
            await conversation.endSession();
            conversation = null;
            showLoading(false);
        }
    } catch (error) {
        console.error('Error ending conversation:', error);
        showError('Failed to end conversation');
        showLoading(false);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (conversation) {
        conversation.endSession();
    }
});
```

### 4.8 Create Styles

Create `frontend/styles.css`:

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #000 0%, #1a1a2e 100%);
    color: #fff;
    min-height: 100vh;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
}

header {
    text-align: center;
    margin-bottom: 60px;
}

header h1 {
    font-size: 32px;
    margin-bottom: 20px;
    background: linear-gradient(135deg, #007AFF, #5856D6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #666;
    transition: background 0.3s;
}

.status-dot.connected {
    background: #34C759;
    box-shadow: 0 0 10px #34C759;
}

.voice-interface {
    text-align: center;
}

.status-badges {
    display: flex;
    gap: 15px;
    justify-content: center;
    margin-bottom: 40px;
}

.badge {
    padding: 10px 20px;
    background: #2C2C2E;
    border-radius: 20px;
    font-size: 14px;
    border: 1px solid #38383A;
}

.badge.success {
    border-color: #34C759;
    color: #34C759;
}

.badge.speaking {
    border-color: #007AFF;
    color: #007AFF;
    animation: pulse 1.5s infinite;
}

.voice-circle {
    width: 200px;
    height: 200px;
    margin: 40px auto;
    background: linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(88, 86, 214, 0.1));
    border: 2px solid rgba(0, 122, 255, 0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
}

.voice-circle.speaking {
    border-color: #007AFF;
    box-shadow: 0 0 40px rgba(0, 122, 255, 0.4);
    animation: pulse-scale 1s infinite;
}

.controls {
    display: flex;
    gap: 15px;
    justify-content: center;
    margin: 40px 0;
}

.btn {
    padding: 14px 32px;
    border-radius: 12px;
    border: none;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}

.btn.primary {
    background: linear-gradient(135deg, #007AFF, #5856D6);
    color: white;
}

.btn.primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 122, 255, 0.4);
}

.btn.secondary {
    background: #2C2C2E;
    color: white;
    border: 1px solid #38383A;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.instructions {
    color: #98989D;
    font-size: 14px;
    line-height: 1.6;
}

.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    z-index: 1000;
}

.spinner {
    width: 50px;
    height: 50px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #007AFF;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.error-toast {
    position: fixed;
    bottom: -100px;
    left: 50%;
    transform: translateX(-50%);
    background: #FF3B30;
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(255, 59, 48, 0.3);
    transition: bottom 0.3s;
    z-index: 1001;
}

.error-toast.show {
    bottom: 30px;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

@keyframes pulse-scale {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
```

---

## 🚀 Step 5: Run and Test

### 5.1 Start Backend

```bash
# In backend directory
npm start
```

Should see: `🎙️  Backend server running on http://localhost:5001`

### 5.2 Start Frontend

```bash
# In frontend directory (new terminal)
npm run dev
```

Should see: `webpack compiled successfully`

### 5.3 Test in Browser

1. Open http://localhost:3000
2. Click "Start Conversation"
3. Grant microphone permission
4. Start talking!

**What to look for**:
- ✅ Status changes to "Connected" (green)
- ✅ "Agent Listening" badge appears
- ✅ When you speak, agent responds
- ✅ Badge changes to "Agent Speaking" (blue) when AI talks

---

## 🔍 How It Works

### Architecture Flow

```
Browser (Frontend)
    ↓
    1. Click "Start Conversation"
    ↓
    2. GET /api/signed-url (Backend)
    ↓
    3. Backend → ElevenLabs API (get signed URL)
    ↓
    4. Frontend → Direct WebSocket to ElevenLabs
    ↓
    5. Real-time voice conversation
```

### Key Concepts

**1. Signed URLs**
- Secure way to authenticate without exposing API keys
- Generated server-side, used client-side
- Temporary and scoped to specific conversation

**2. Conversation SDK**
- Handles microphone access
- Manages WebSocket connection
- Processes audio in real-time
- Provides event callbacks

**3. Event-Driven Architecture**
- `onConnect`: When connection establishes
- `onDisconnect`: When connection closes
- `onModeChange`: Speaking vs listening
- `onError`: Error handling
- `onMessage`: Transcript updates

---

## 🎓 Understanding the Code

### Backend: Why Signed URLs?

**Security Problem**:
```javascript
// ❌ BAD: Exposing API key in frontend
const conversation = await Conversation.startSession({
    apiKey: 'sk_abc123...',  // Visible to anyone!
});
```

**Secure Solution**:
```javascript
// ✅ GOOD: Backend generates temporary signed URL
app.get('/api/signed-url', async (req, res) => {
    // Backend has the API key (secret)
    // Returns a temporary signed URL (safe to expose)
    const response = await axios.get(url, {
        headers: { 'xi-api-key': apiKey }
    });
    res.json({ signedUrl: response.data.signed_url });
});
```

### Frontend: Event Callbacks Explained

```javascript
conversation = await Conversation.startSession({
    signedUrl: signedUrl,

    // Called once when connected
    onConnect: () => {
        console.log('Connected!');
        // Update UI, enable buttons, etc.
    },

    // Called when mode changes (speaking ↔ listening)
    onModeChange: (mode) => {
        if (mode.mode === 'speaking') {
            // Agent is talking
        } else {
            // Agent is listening to you
        }
    },

    // Called when errors occur
    onError: (error) => {
        console.error('Error:', error);
        // Show error to user
    }
});
```

---

## 🐛 Troubleshooting

### Issue: "Failed to get signed URL"

**Causes**:
1. Missing or invalid API key
2. Wrong agent ID
3. Backend not running

**Solution**:
```bash
# Check backend .env file
cat backend/.env

# Verify API key format: sk_...
# Verify agent ID format: agent_...

# Test endpoint directly
curl http://localhost:5001/api/signed-url
```

### Issue: "Microphone permission denied"

**Causes**:
1. Browser blocked microphone
2. No HTTPS (required for mic access)
3. Microphone in use by another app

**Solution**:
1. Check browser permissions (🔒 icon in address bar)
2. Use `localhost` for development (allowed without HTTPS)
3. Close other apps using microphone
4. Try different browser (Chrome recommended)

### Issue: "Cannot GET /api/signed-url" in frontend

**Cause**: Webpack proxy not working

**Solution**:
Check `webpack.config.js`:
```javascript
proxy: [
    {
        context: ['/api'],
        target: 'http://localhost:5001'  // Backend URL
    }
]
```

### Issue: Connection drops immediately

**Causes**:
1. Invalid agent ID
2. Conversation limit reached (free tier)
3. Network issues

**Solution**:
1. Verify agent ID in ElevenLabs dashboard
2. Check your usage limits
3. Test with: `curl -I https://api.elevenlabs.io`

---

## 🎨 Customization Ideas

### 1. Add Conversation Transcript

```javascript
onMessage: (message) => {
    const transcript = document.getElementById('transcript');
    const entry = document.createElement('div');
    entry.textContent = `${message.role}: ${message.message}`;
    transcript.appendChild(entry);
}
```

### 2. Change Agent Personality

In your ElevenLabs dashboard, update the system prompt:

```
You are a [role]. You speak with a [tone] voice.
Your responses are [style]. When discussing [topic],
you [behavior].
```

Examples:
- Customer service agent (helpful, patient)
- Technical interviewer (challenging, analytical)
- Language tutor (encouraging, corrective)

### 3. Add Voice Selection

```javascript
// Allow user to choose voice before starting
const voiceSelect = document.getElementById('voiceSelect');
const selectedVoice = voiceSelect.value;

// Create different agents with different voices
// Then use the appropriate agent ID
```

### 4. Add Analytics

```javascript
let conversationMetrics = {
    startTime: null,
    endTime: null,
    userTurns: 0,
    agentTurns: 0
};

onModeChange: (mode) => {
    if (mode.mode === 'speaking') {
        metrics.agentTurns++;
    } else {
        metrics.userTurns++;
    }
}
```

---

## 📦 Next Steps

### Deploy to Production

**Option 1: Vercel (Easiest)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Option 2: DigitalOcean/AWS**
```bash
# SSH to server
ssh user@your-server

# Clone and setup
git clone your-repo
cd project
npm install
npm run build

# Use PM2 for backend
pm2 start backend/server.js
```

### Enhancements to Build

1. **Authentication**: Add user login
2. **Conversation History**: Save conversations to database
3. **Multi-language Support**: Use ElevenLabs' language features
4. **Custom Wake Word**: Add keyword detection
5. **Mobile App**: Use React Native with same backend

---

## 📚 Additional Resources

### Documentation
- [ElevenLabs Conversational AI Docs](https://elevenlabs.io/docs/conversational-ai)
- [ElevenLabs API Reference](https://api.elevenlabs.io/docs)
- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Webpack Documentation](https://webpack.js.org/)

### Example Repositories
- [Official ElevenLabs Examples](https://github.com/elevenlabs/elevenlabs-examples)
- [This Project's Repo](https://github.com/yetog/voice-agent-11)

### Community
- [ElevenLabs Discord](https://discord.gg/elevenlabs)
- [ElevenLabs Community Forum](https://community.elevenlabs.io)

---

## 🎉 Congratulations!

You've built a fully functional voice AI assistant! You now understand:

- ✅ How to use ElevenLabs Conversational AI
- ✅ Secure backend API development
- ✅ Modern frontend build tools (Webpack)
- ✅ Real-time WebSocket communication
- ✅ Browser audio handling
- ✅ Event-driven programming

**Next Challenge**: Customize it for your use case!

---

## 📝 License

This tutorial is provided as educational material. You're free to use, modify, and distribute this code for your own projects.

**Important**: Remember to keep your API keys secure and never commit them to public repositories!

---

## 🙋 FAQ

**Q: Is this free?**
A: ElevenLabs offers a free tier with limited usage. Check their pricing page for current limits.

**Q: Can I use this commercially?**
A: Yes, but you'll need a paid ElevenLabs plan. Check their terms of service.

**Q: Does this work offline?**
A: No, it requires an internet connection to communicate with ElevenLabs' servers.

**Q: Can I change the voice?**
A: Yes! In the ElevenLabs dashboard, you can select from hundreds of voices or clone your own.

**Q: How do I add more features?**
A: Check the ElevenLabs API documentation for advanced features like custom tools, knowledge bases, and more!

---

**Tutorial Version**: 1.0
**Last Updated**: January 2025
**Author**: Zay Legend (zaylegend.com)

**Questions?** Open an issue on the [GitHub repository](https://github.com/yetog/voice-agent-11) or reach out!
