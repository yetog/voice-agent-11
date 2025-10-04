# IONOS Voice Assistant

A modern voice assistant with Apple Silicon-inspired design using IONOS AI Model Hub and ElevenLabs for text-to-speech.

## Features

- 🎤 **Voice Recognition**: Browser-based audio recording with voice activity detection
- 🤖 **IONOS AI Integration**: Powered by IONOS AI Model Hub for transcription and chat completions
- 🗣️ **ElevenLabs TTS**: High-quality text-to-speech conversion
- 🎨 **Apple Silicon Design**: Modern, sleek interface inspired by Apple's design language
- 📱 **Responsive**: Works on desktop and mobile devices
- ⚙️ **Configurable**: Customizable activation keywords, models, and settings

## Quick Start

### Prerequisites

- Node.js 16+ (for backend)
- Python 3+ (for frontend development server)
- IONOS AI Model Hub API Token
- ElevenLabs API Key

### 1. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit the `.env` file with your API keys:
```env
IONOS_API_TOKEN=your_ionos_token_here
ELEVEN_LABS_API_KEY=your_elevenlabs_key_here
```

Start the backend server:
```bash
npm run dev
```

The backend will be available at `http://localhost:5000`

### 2. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 3. Usage

1. Open `http://localhost:3000` in your browser
2. Allow microphone access when prompted
3. Click the microphone button or press **Spacebar**
4. Say "**assistant**" followed by your question
5. Listen to the AI response

## Project Structure

```
├── backend/                 # Node.js API server
│   ├── server.js           # Main server file
│   ├── voice-listener.js   # Standalone voice listener
│   ├── package.json        # Backend dependencies
│   ├── .env               # Environment variables
│   └── audio/             # Temporary audio files
├── frontend/               # Modern web interface
│   ├── index.html         # Main HTML file
│   ├── src/
│   │   ├── js/
│   │   │   ├── app.js     # Main application logic
│   │   │   └── web-audio-utils.js # Audio utilities
│   │   └── styles/
│   │       └── main.css   # Apple Silicon-inspired styles
│   └── package.json       # Frontend dependencies
└── README.md              # This file
```

## API Endpoints

### Backend API (`http://localhost:5000/api`)

- `GET /health` - Health check
- `GET /models` - List available AI models
- `POST /transcribe` - Transcribe audio to text
- `POST /chat` - Get chat completion
- `POST /tts` - Convert text to speech
- `POST /process-voice` - Complete voice processing pipeline
- `GET /audio/:filename` - Serve generated audio files

## Configuration

### Environment Variables (.env)

```env
# IONOS AI Model Hub
IONOS_API_TOKEN=your_token_here
IONOS_CHAT_COMPLETION_URL=https://openai.inference.de-txl.ionos.com/v1/chat/completions
IONOS_TEXT_COMPLETION_URL=https://openai.inference.de-txl.ionos.com/v1/completions
IONOS_EMBEDDINGS_URL=https://openai.inference.de-txl.ionos.com/v1/embeddings
IONOS_IMAGE_GENERATION_URL=https://openai.inference.de-txl.ionos.com/v1/images/generations
IONOS_LIST_MODELS_URL=https://openai.inference.de-txl.ionos.com/v1/models

# ElevenLabs
ELEVEN_LABS_API_KEY=your_key_here
ELEVEN_LABS_VOICE_ID=pNInz6obpgDQGcFmaJgB

# Application Settings
DEBUG=true
HOST=0.0.0.0
PORT=5000
MAX_CONTENT_LENGTH=16777216
KEYWORD=assistant
SILENCE_DURATION=6
```

### Frontend Settings

Settings can be configured in the web interface:

- **Activation Keyword**: Word to trigger the assistant (default: "assistant")
- **AI Model**: Choose between available models (gpt-3.5-turbo, gpt-4)
- **Continuous Mode**: Keep listening after responses
- **Keyword Required**: Whether activation keyword is required

## Advanced Usage

### Standalone Voice Listener

For command-line usage without the web interface:

```bash
cd backend
node voice-listener.js
```

This creates a standalone voice assistant that:
- Listens continuously through your microphone
- Processes voice commands locally
- Plays responses through your speakers

### Custom Models

To use different AI models, update the model selection in the frontend settings or modify the API calls in `backend/server.js`.

### Voice Customization

Change the ElevenLabs voice by updating the `ELEVEN_LABS_VOICE_ID` in your `.env` file. You can find voice IDs in your ElevenLabs dashboard.

## Troubleshooting

### Common Issues

1. **Microphone Access Denied**
   - Ensure HTTPS or localhost for microphone access
   - Check browser permissions for microphone

2. **API Connection Failed**
   - Verify backend server is running on port 5000
   - Check IONOS API token is valid
   - Ensure ElevenLabs API key is correct

3. **Audio Not Playing**
   - Check browser audio permissions
   - Verify volume settings
   - Ensure ElevenLabs service is accessible

4. **Transcription Not Working**
   - IONOS AI Model Hub may not support audio transcription
   - Check available models at `/api/models`

### macOS/Linux Audio Setup

For the standalone voice listener, you may need to install audio dependencies:

```bash
# macOS
brew install sox

# Linux
sudo apt-get install sox libsox-fmt-all
```

## Development

### Backend Development

```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development

```bash
cd frontend
npm run dev  # Serves on localhost:3000
```

### API Testing

Test individual endpoints:

```bash
# Health check
curl http://localhost:5000/api/health

# List models
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/models

# Chat completion
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review the console logs for errors
- Ensure all API keys are correctly configured