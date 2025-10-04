# Test Environment Status

## ✅ Servers Running

### Backend Server
- **URL**: http://localhost:5001
- **Status**: ✅ Running
- **Process ID**: Check with `lsof -i :5001`

### Frontend Dev Server
- **URL**: http://localhost:3000
- **Status**: ✅ Running
- **Webpack**: Hot reload enabled
- **Proxy**: /api → http://localhost:5001

## ✅ API Endpoints Verified

### Signed URL Endpoint
```bash
curl http://localhost:5001/api/signed-url
```
**Response**: ✅ Returns WebSocket signed URL
```json
{
  "signedUrl": "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_5001k5mwc9fhftabwyc2a69b0e7w&conversation_signature=..."
}
```

### Agent ID Endpoint
```bash
curl http://localhost:5001/api/agent-id
```
**Response**: ✅ Returns agent ID
```json
{
  "agentId": "agent_5001k5mwc9fhftabwyc2a69b0e7w"
}
```

### Health Check
```bash
curl http://localhost:5001/api/health
```
**Response**: ✅ Backend healthy
```json
{
  "status": "OK",
  "timestamp": "2025-10-04T17:36:28.772Z",
  "services": {
    "ionos": true,
    "elevenlabs": true
  }
}
```

## 🧪 How to Test the Conversational AI

1. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

2. **You should see**:
   - ElevenLabs Conversational AI header
   - Connection status indicator (Disconnected)
   - Large voice visualizer circle
   - "Start Conversation" button
   - "End Conversation" button (disabled)

3. **Click "Start Conversation"**:
   - Browser will request microphone permission
   - Grant permission when prompted
   - Loading overlay will appear: "Connecting to ElevenLabs..."
   - Status should change to "Connected" (green)
   - Voice circle will show "listening" state (green glow)

4. **Start talking**:
   - Speak into your microphone
   - The agent will respond
   - Watch the status change:
     - "Agent Listening" (green) when you can speak
     - "Agent Speaking" (blue) when AI is responding

5. **Click "End Conversation"** to disconnect

## 🎨 Visual Indicators

| State | Visual Feedback |
|-------|----------------|
| Disconnected | Gray status dot, no glow |
| Connected | Green status dot |
| Agent Listening | Green glow around voice circle |
| Agent Speaking | Blue glow, pulsing animation |
| Error | Red toast notification at bottom |

## 🔧 Background Processes

The servers are running in the background. You can monitor them:

```bash
# Check backend logs
lsof -i :5001

# Check frontend logs
lsof -i :3000

# To stop servers
kill $(lsof -t -i:5001)  # Stop backend
kill $(lsof -t -i:3000)  # Stop frontend
```

## 📝 Testing Checklist

- [x] Backend server started
- [x] Frontend dev server started
- [x] Signed URL endpoint working
- [x] Agent ID endpoint working
- [x] Health check passing
- [ ] Browser test - Open http://localhost:3000
- [ ] Microphone permission granted
- [ ] Conversation starts successfully
- [ ] Agent responds to voice input
- [ ] Mode changes (speaking/listening) work
- [ ] Conversation ends cleanly

## 🐛 If Something Goes Wrong

### Port already in use
```bash
# Kill process on port 5001
kill $(lsof -t -i:5001)

# Kill process on port 3000
kill $(lsof -t -i:3000)

# Restart servers
cd backend && npm start
cd frontend && npm run dev
```

### Can't get signed URL
- Check `.env` file has `ELEVEN_LABS_API_KEY` and `ELEVEN_LABS_AGENT_ID`
- Verify API key is valid
- Check backend logs for errors

### Frontend not loading
- Check webpack compiled successfully
- Look for errors in browser console (F12)
- Verify `dist/` directory was created

### Microphone not working
- Check browser permissions
- Use Chrome/Edge (best compatibility)
- Check system microphone settings

## 📊 Next Steps

Once basic testing works:
1. Test different conversation scenarios
2. Verify mode changes happen smoothly
3. Test error handling (disconnect network, etc.)
4. Check on different browsers
5. Test on mobile devices (if needed)

## 🌐 Access URLs

- **Main App**: http://localhost:3000
- **Backend API**: http://localhost:5001/api
- **Webpack Dev Server**: http://localhost:3000 (with hot reload)
- **Network Access**: http://192.168.7.248:3000 (from other devices on your network)

---

**Ready to test!** Open http://localhost:3000 in your browser and click "Start Conversation" to begin.
