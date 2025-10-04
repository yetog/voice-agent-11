# ElevenLabs Conversational AI Integration Guide

## Overview

This project has been refactored to use the modern **@elevenlabs/client** SDK for conversational AI. The new implementation provides a simpler, more reliable way to integrate real-time voice conversations with ElevenLabs agents.

## What's New

### Backend Improvements

1. **@elevenlabs/client SDK**: Replaced the older `elevenlabs-node` library with the official client SDK
2. **Signed URL Endpoint**: Added secure authentication via signed URLs (`/api/signed-url`)
3. **Agent ID Endpoint**: Alternative public agent endpoint (`/api/agent-id`)

### Frontend Improvements

1. **Modern Conversation API**: Uses the ElevenLabs `Conversation` class for easier integration
2. **Built-in Audio Handling**: SDK handles microphone access and audio streaming automatically
3. **Real-time Status Updates**: Visual feedback for connection and speaking/listening states
4. **Webpack Build System**: Modern bundling with automatic code splitting
5. **Cleaner UI**: Simplified interface focused on the conversation experience

## Key Features

- ✅ **One-click conversation start** - No complex setup required
- ✅ **Real-time mode detection** - Visual indicators when agent is speaking vs listening
- ✅ **Automatic microphone handling** - SDK manages all audio I/O
- ✅ **Error handling** - Graceful error messages and recovery
- ✅ **Loading states** - Clear feedback during connection/disconnection
- ✅ **Secure authentication** - Uses signed URLs instead of exposing API keys

## How to Run

### 1. Start the Backend

```bash
cd backend
npm start
```

The backend server will run on **http://localhost:5001**

### 2. Start the Frontend (Development)

```bash
cd frontend
npm run dev
```

The webpack dev server will run on **http://localhost:3000** with hot reload enabled.

### 3. Start the Frontend (Production)

```bash
cd frontend
npm run build    # Build the production bundle
npm start        # Serve the built files
```

## Architecture Comparison

### Old Architecture
- Custom WebSocket implementation
- Manual microphone recording
- File-based audio upload/download
- Complex state management
- Multiple audio processing libraries

### New Architecture
```
Frontend (Conversation SDK)
    ↓
    GET /api/signed-url (Backend)
    ↓
    ElevenLabs Conversational AI (Direct WebSocket)
```

- **Simplified flow**: Frontend connects directly to ElevenLabs
- **SDK handles everything**: Microphone, audio streaming, state management
- **Backend only provides auth**: Just generates signed URLs
- **Real-time callbacks**: `onConnect`, `onDisconnect`, `onModeChange`, `onMessage`

## Configuration

### Environment Variables

Make sure these are set in `backend/.env`:

```env
ELEVEN_LABS_API_KEY=your_api_key_here
ELEVEN_LABS_AGENT_ID=your_agent_id_here
```

### Using Public Agents vs Signed URLs

The implementation supports both authentication methods:

**Signed URL (Recommended - More Secure)**:
```javascript
conversation = await Conversation.startSession({
    signedUrl: signedUrl,  // Get from /api/signed-url
    onConnect: () => {},
    // ...
});
```

**Agent ID (Public Agents)**:
```javascript
conversation = await Conversation.startSession({
    agentId: agentId,      // Get from /api/agent-id
    onConnect: () => {},
    // ...
});
```

## Code Structure

### Frontend Files

```
frontend/
├── conversational.html              # New conversational UI
├── src/
│   ├── js/
│   │   └── conversational-app.js   # Main app using @elevenlabs/client
│   └── styles/
│       └── conversational.css      # Conversational UI styles
├── webpack.config.js               # Webpack configuration
└── package.json                    # Dependencies and scripts
```

### Backend Endpoints

- `GET /api/signed-url` - Get a signed URL for authentication
- `GET /api/agent-id` - Get the agent ID for public agents
- *All other existing endpoints remain unchanged*

## Callbacks and Events

The Conversation SDK provides these event callbacks:

### onConnect
Called when successfully connected to the ElevenLabs agent.
```javascript
onConnect: () => {
    console.log('Connected!');
    updateStatus(true);
}
```

### onDisconnect
Called when disconnected from the agent.
```javascript
onDisconnect: () => {
    console.log('Disconnected');
    updateStatus(false);
}
```

### onModeChange
Called when the agent switches between speaking and listening.
```javascript
onModeChange: (mode) => {
    // mode.mode can be 'speaking' or 'listening'
    updateSpeakingStatus(mode);
}
```

### onError
Called when an error occurs.
```javascript
onError: (error) => {
    console.error('Error:', error);
    showError(error.message);
}
```

### onMessage
Called when receiving transcript messages.
```javascript
onMessage: (message) => {
    console.log('Message:', message);
    // Display transcript if needed
}
```

## Benefits Over Previous Implementation

1. **Less Code**: ~200 lines vs 1000+ lines
2. **More Reliable**: Official SDK maintained by ElevenLabs
3. **Better UX**: Faster connection, lower latency
4. **Easier Maintenance**: No custom WebSocket/audio handling
5. **Future-proof**: Automatic updates to new features

## Migrating from Old to New

The old implementation is still available at `index.html` and `src/js/app.js`.

To fully migrate:
1. Use the new conversational interface at `http://localhost:3000`
2. Test all your use cases
3. Optionally remove old files: `index.html`, `src/js/app.js`, etc.

## Troubleshooting

### "Failed to get signed URL"
- Check that `ELEVEN_LABS_API_KEY` and `ELEVEN_LABS_AGENT_ID` are set in `backend/.env`
- Ensure backend is running on port 5001

### "Microphone permission denied"
- Grant microphone access when prompted by the browser
- Check browser settings to ensure microphone is not blocked

### "Webpack build errors"
- Run `npm install` in the frontend directory
- Clear `node_modules` and reinstall if issues persist

### Connection issues
- Verify your ElevenLabs agent ID is correct
- Check browser console for detailed error messages
- Ensure you have a stable internet connection

## Next Steps

Potential enhancements:
- Add transcript display
- Implement conversation history
- Add custom styling/themes
- Integrate with scenario selection
- Add analytics/logging

## Resources

- [ElevenLabs Conversational AI Docs](https://elevenlabs.io/docs/conversational-ai)
- [ElevenLabs Client SDK](https://github.com/elevenlabs/elevenlabs-js)
- [Original Examples Repository](https://github.com/yetog/elevenlabs-examples)
