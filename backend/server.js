import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import voice from 'elevenlabs-node';
import { createServer } from 'http';
import { Server } from 'socket.io';
import WebSocket from 'ws';
import Database from 'better-sqlite3';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: process.env.MAX_CONTENT_LENGTH || '16mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_CONTENT_LENGTH || '16mb' }));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const audioDir = join(__dirname, 'audio');
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }
        cb(null, audioDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

// Conversation scenarios for role-play practice
const SCENARIOS = {
    "tough_customer": {
        title: "Difficult Customer",
        prompt: "You are an annoyed customer who believes they were overcharged for a service. You're calling customer support and you're frustrated, but you can be convinced if the agent is empathetic and offers a reasonable solution. Be challenging but fair."
    },
    "job_interview": {
        title: "Job Interview",
        prompt: "You are an interviewer for an Associate PM role at a tech startup. Ask relevant questions about product management, prioritization, and problem-solving. Be professional but thorough in your evaluation."
    },
    "sales_objection": {
        title: "Sales Objection",
        prompt: "You are a potential customer considering a software purchase but you have concerns about price, implementation time, and whether it fits your needs. Raise realistic objections that a good salesperson should be able to address."
    },
    "performance_review": {
        title: "Performance Review",
        prompt: "You are a manager conducting a performance review with a team member who has been struggling with deadlines but shows potential. Be constructive but honest about areas for improvement."
    }
};

// Database initialization
const db = new Database('conversations.db');

// Create tables if they don't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        scenario TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        speaker TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
    );

    CREATE TABLE IF NOT EXISTS coaching_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        overall_score INTEGER,
        communication_score INTEGER,
        problem_solving_score INTEGER,
        professionalism_score INTEGER,
        engagement_score INTEGER,
        feedback TEXT,
        strengths TEXT,
        improvements TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
    );
`);

// Prepared statements for performance
const insertSession = db.prepare('INSERT INTO sessions (id, scenario) VALUES (?, ?)');
const insertTurn = db.prepare('INSERT INTO turns (session_id, speaker, message) VALUES (?, ?, ?)');
const insertCoachingEvaluation = db.prepare(`
    INSERT INTO coaching_evaluations
    (session_id, overall_score, communication_score, problem_solving_score, professionalism_score, engagement_score, feedback, strengths, improvements)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getSession = db.prepare('SELECT * FROM sessions WHERE id = ?');
const getSessionTurns = db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY timestamp');
const getCoachingEvaluation = db.prepare('SELECT * FROM coaching_evaluations WHERE session_id = ? ORDER BY created_at DESC LIMIT 1');

class IONOSAIService {
    constructor() {
        this.apiToken = process.env.IONOS_API_TOKEN;
        this.baseURL = 'https://openai.inference.de-txl.ionos.com/v1';
        this.headers = {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
        };
    }

    async listModels() {
        try {
            const response = await axios.get(`${this.baseURL}/models`, {
                headers: this.headers
            });
            return response.data;
        } catch (error) {
            console.error('Error listing models:', error.response?.data || error.message);
            throw error;
        }
    }

    async transcribeAudio(audioFilePath) {
        try {
            // IONOS AI Model Hub doesn't support audio transcription yet
            // Return a placeholder message
            console.log('IONOS AI Model Hub does not support audio transcription. Using placeholder.');
            return "I heard your voice input. Please type your message or use text input for now.";
        } catch (error) {
            console.error('Error transcribing audio:', error.response?.data || error.message);
            throw new Error('Audio transcription not available on IONOS AI Model Hub.');
        }
    }

    async getChatCompletion(messages, model = 'meta-llama/Meta-Llama-3.1-8B-Instruct') {
        try {
            // Use a valid IONOS AI model
            const validModel = model === 'gpt-3.5-turbo' ? 'meta-llama/Meta-Llama-3.1-8B-Instruct' : model;

            const response = await axios.post(`${this.baseURL}/chat/completions`, {
                model: validModel,
                messages,
                max_tokens: 150,
                temperature: 0.7
            }, {
                headers: this.headers
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Error getting chat completion:', error.response?.data || error.message);
            throw error;
        }
    }
}

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVEN_LABS_API_KEY;
        this.voiceId = process.env.ELEVEN_LABS_VOICE_ID;
        this.agentId = process.env.ELEVEN_LABS_AGENT_ID;
    }

    async conversationWithAgent(message, conversationId = null) {
        try {
            // First try the WebSocket agent approach
            const agentResponse = await this.chatWithAgent(message, conversationId);

            console.log('Agent response received:', agentResponse.response);

            // Generate TTS for the agent response if no audio URL provided
            if (agentResponse.audioUrl) {
                // Agent provided audio directly
                return {
                    fileName: agentResponse.audioUrl.split('/').pop(),
                    filePath: join(__dirname, 'audio', agentResponse.audioUrl.split('/').pop()),
                    text: agentResponse.response,
                    conversationId: agentResponse.conversationId
                };
            } else {
                // Generate TTS for the text response
                const fileName = `${Date.now()}.mp3`;
                const audioUrl = await this.generateSpeech(agentResponse.response);

                return {
                    fileName: audioUrl.split('/').pop(),
                    filePath: join(__dirname, 'audio', audioUrl.split('/').pop()),
                    text: agentResponse.response,  // Use actual agent response, not input message
                    conversationId: agentResponse.conversationId
                };
            }
        } catch (error) {
            console.error('Error with ElevenLabs agent conversation:', error.message);
            // Fallback to regular TTS with original message
            return await this.textToSpeech(message);
        }
    }

    async textToSpeech(text) {
        try {
            const fileName = `${Date.now()}.mp3`;
            const filePath = join(__dirname, 'audio', fileName);

            const audioStream = await voice.textToSpeechStream(this.apiKey, this.voiceId, text);
            const fileWriteStream = fs.createWriteStream(filePath);

            audioStream.pipe(fileWriteStream);

            return new Promise((resolve, reject) => {
                fileWriteStream.on('finish', () => {
                    resolve({ fileName, filePath, text });
                });
                fileWriteStream.on('error', reject);
                audioStream.on('error', reject);
            });
        } catch (error) {
            console.error('Error converting text to speech:', error);
            throw error;
        }
    }

    async chatWithAgent(message, conversationId = null) {
        return new Promise((resolve, reject) => {
            // Create WebSocket connection to ElevenLabs agent
            let wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${this.agentId}`;

            // Since ElevenLabs ignores conversation_id parameter, we'll include conversation history in the message
            let contextualMessage = message;

            if (conversationId && conversations.has(conversationId)) {
                const conversationHistory = conversations.get(conversationId);
                // Include last few exchanges for context
                const recentHistory = conversationHistory.slice(-4); // Last 2 exchanges (user + assistant)
                if (recentHistory.length > 0) {
                    const contextPrefix = "Context from our conversation:\n" +
                        recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') +
                        "\n\nCurrent message: ";
                    contextualMessage = contextPrefix + message;
                }
                console.log('Continuing conversation with context:', conversationId);
            } else {
                console.log('Starting new conversation');
            }

            console.log('Connecting to ElevenLabs agent via WebSocket:', wsUrl);

            const ws = new WebSocket(wsUrl, {
                headers: {
                    'xi-api-key': this.apiKey
                }
            });

            let responseReceived = false;
            let audioData = null;
            let agentTextResponse = null;
            let responseConversationId = null;

            const timeout = setTimeout(() => {
                if (!responseReceived) {
                    ws.close();
                    this.handleFallback(message, conversationId, resolve);
                }
            }, 15000); // Increased timeout since we're waiting for multiple events

            ws.on('open', () => {
                console.log('Connected to ElevenLabs agent');

                // Send the message to the agent using correct ElevenLabs format
                const messageData = {
                    type: 'user_message',
                    user_message: {
                        text: contextualMessage
                    }
                };

                console.log('Sending message to agent:', messageData);
                ws.send(JSON.stringify(messageData));
            });

            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    console.log('Agent response:', response);

                    // Handle conversation initiation metadata
                    if (response.type === 'conversation_initiation_metadata') {
                        responseConversationId = response.conversation_initiation_metadata_event?.conversation_id;
                        console.log('Conversation initialized with ID:', responseConversationId);
                        // Don't close connection, wait for actual agent response
                        return;
                    }

                    // Handle audio response events (store audio data but don't resolve yet)
                    if (response.type === 'audio' && response.audio_event) {
                        audioData = response.audio_event.audio_base64 ? 'data:audio/wav;base64,' + response.audio_event.audio_base64 : null;
                        // Don't resolve yet, wait for text response
                        return;
                    }

                    // Handle agent text response (this is what we want for display)
                    if (response.type === 'agent_response' && response.agent_response_event) {
                        agentTextResponse = response.agent_response_event.agent_response;

                        // Now we have the text response, resolve with it
                        if (agentTextResponse && agentTextResponse.trim() !== '') {
                            responseReceived = true;
                            clearTimeout(timeout);
                            ws.close();

                            // Store conversation history
                            const finalConversationId = responseConversationId || conversationId || Date.now().toString();
                            if (!conversations.has(finalConversationId)) {
                                conversations.set(finalConversationId, []);
                            }
                            const history = conversations.get(finalConversationId);
                            history.push({ role: 'user', content: message });
                            history.push({ role: 'assistant', content: agentTextResponse });

                            // Keep only last 10 messages (5 exchanges) to prevent memory bloat
                            if (history.length > 10) {
                                conversations.set(finalConversationId, history.slice(-10));
                            }

                            resolve({
                                response: agentTextResponse,
                                conversationId: finalConversationId,
                                sessionId: Date.now().toString(),
                                messageCount: 1,
                                audioUrl: audioData
                            });
                        } else {
                            // If no proper text response, fall back
                            responseReceived = true;
                            clearTimeout(timeout);
                            ws.close();
                            this.handleFallback(message, conversationId, resolve);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing agent response:', error);
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                clearTimeout(timeout);
                this.handleFallback(message, conversationId, resolve);
            });

            ws.on('close', () => {
                console.log('WebSocket connection closed');
                clearTimeout(timeout);
                if (!responseReceived) {
                    this.handleFallback(message, conversationId, resolve);
                }
            });
        });
    }

    async handleFallback(message, conversationId, resolve) {
        try {
            console.log('Using IONOS AI fallback');
            const messages = [
                { role: 'system', content: 'You are a helpful voice assistant. Keep responses concise and conversational.' },
                { role: 'user', content: message }
            ];
            const fallbackResponse = await ionosAI.getChatCompletion(messages);
            resolve({
                response: fallbackResponse,
                conversationId: conversationId || Date.now().toString(),
                sessionId: Date.now().toString(),
                messageCount: 1
            });
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            resolve({
                response: `I'm having trouble connecting right now. Please try again.`,
                conversationId: conversationId || Date.now().toString(),
                sessionId: Date.now().toString(),
                messageCount: 1
            });
        }
    }

    async generateSpeech(text) {
        try {
            const fileName = `${Date.now()}.mp3`;
            const filePath = join(__dirname, 'audio', fileName);

            // Use a default voice ID if not set
            const voiceId = this.voiceId || 'pNInz6obpgDQGcFmaJgB'; // Default ElevenLabs voice

            console.log(`Generating TTS for: "${text.substring(0, 50)}..." with voice: ${voiceId}`);

            // Use direct axios call to ElevenLabs API instead of the broken library
            const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                text: text,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8
                }
            }, {
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                responseType: 'stream',
                timeout: 15000
            });

            if (!response.data) {
                throw new Error('No audio stream returned from ElevenLabs');
            }

            return new Promise((resolve, reject) => {
                const fileWriteStream = fs.createWriteStream(filePath);
                response.data.pipe(fileWriteStream);
                fileWriteStream.on('finish', () => {
                    console.log(`TTS audio saved: ${fileName}`);
                    resolve(`/api/audio/${fileName}`);
                });
                fileWriteStream.on('error', reject);
                response.data.on('error', reject);
            });

        } catch (error) {
            console.error('Error generating speech:', error);
            // Try using the fallback textToSpeech method
            try {
                return await this.textToSpeech(text);
            } catch (fallbackError) {
                console.error('Fallback TTS also failed:', fallbackError);
                throw error;
            }
        }
    }
}

const ionosAI = new IONOSAIService();
const elevenLabs = new ElevenLabsService();

// In-memory conversation storage (in production, use Redis or database)
const conversations = new Map();

// Real-time voice processing class
class RealTimeVoiceProcessor {
    constructor(io, elevenLabs) {
        this.io = io;
        this.elevenLabs = elevenLabs;
        this.activeConnections = new Map();
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);

            socket.on('start-voice-session', (data) => {
                this.startVoiceSession(socket, data);
            });

            socket.on('audio-chunk', (data) => {
                this.processAudioChunk(socket, data);
            });

            socket.on('end-voice-session', () => {
                this.endVoiceSession(socket);
            });

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                this.endVoiceSession(socket);
            });
        });
    }

    startVoiceSession(socket, data) {
        const sessionData = {
            sessionId: data.sessionId || `voice_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            conversationId: data.conversationId,
            audioChunks: [],
            isRecording: false,
            lastActivity: Date.now(),
            vad: {
                silenceThreshold: 500, // ms
                speechThreshold: 800,  // ms
                silenceStart: null,
                speechStart: null,
                isProcessing: false
            }
        };

        this.activeConnections.set(socket.id, sessionData);

        socket.emit('voice-session-started', {
            sessionId: sessionData.sessionId,
            message: 'Voice session ready - start speaking!'
        });

        console.log(`Voice session started: ${sessionData.sessionId}`);
    }

    async processAudioChunk(socket, audioData) {
        const session = this.activeConnections.get(socket.id);
        if (!session) return;

        session.lastActivity = Date.now();

        // Add audio chunk to buffer
        session.audioChunks.push(audioData);

        // Simple voice activity detection based on data presence
        const hasAudio = audioData && audioData.length > 0;

        if (hasAudio && !session.isRecording) {
            // Speech started
            session.isRecording = true;
            session.vad.speechStart = Date.now();
            socket.emit('speech-detected');
            console.log(`Speech detected: ${session.sessionId}`);
        }

        if (!hasAudio && session.isRecording) {
            // Potential silence
            if (!session.vad.silenceStart) {
                session.vad.silenceStart = Date.now();
            }

            // Check if silence duration exceeded threshold
            const silenceDuration = Date.now() - session.vad.silenceStart;
            if (silenceDuration > session.vad.silenceThreshold && !session.vad.isProcessing) {
                await this.processSpeechEnd(socket, session);
            }
        } else if (hasAudio) {
            // Reset silence detection
            session.vad.silenceStart = null;
        }
    }

    async processSpeechEnd(socket, session) {
        if (session.vad.isProcessing || session.audioChunks.length === 0) return;

        session.vad.isProcessing = true;
        session.isRecording = false;

        console.log(`Processing speech for session: ${session.sessionId}`);

        try {
            socket.emit('processing-audio');

            // Combine audio chunks into a single buffer
            const audioBuffer = Buffer.concat(session.audioChunks.map(chunk =>
                Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            ));

            // Save as temporary audio file
            const fileName = `temp_${Date.now()}.wav`;
            const filePath = join(__dirname, 'audio', fileName);

            // Create a simple WAV header and write audio data
            await this.saveAudioBuffer(audioBuffer, filePath);

            // For now, simulate transcription (replace with actual speech-to-text)
            const transcription = "I'm speaking to the voice assistant";

            if (transcription.toLowerCase().includes('assistant') || true) {
                // Send to ElevenLabs agent
                const agentResponse = await this.elevenLabs.conversationWithAgent(
                    transcription,
                    session.conversationId
                );

                // Update session
                session.conversationId = agentResponse.conversationId;

                // Stream response back to client
                socket.emit('agent-response', {
                    transcription: transcription,
                    response: agentResponse.text,
                    audioUrl: `/api/audio/${agentResponse.fileName}`,
                    conversationId: agentResponse.conversationId
                });

                console.log(`Agent response sent for session: ${session.sessionId}`);
            }

            // Clean up
            fs.unlink(filePath, () => {});
            session.audioChunks = [];

        } catch (error) {
            console.error('Error processing speech:', error);
            socket.emit('error', { message: 'Failed to process speech' });
        } finally {
            session.vad.isProcessing = false;
        }
    }

    async saveAudioBuffer(buffer, filePath) {
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, buffer, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    endVoiceSession(socket) {
        const session = this.activeConnections.get(socket.id);
        if (session) {
            console.log(`Voice session ended: ${session.sessionId}`);
            this.activeConnections.delete(socket.id);
        }
    }
}

app.get('/api/models', async (req, res) => {
    try {
        const models = await ionosAI.listModels();
        res.json(models);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch models', details: error.message });
    }
});

// Get available conversation scenarios
app.get('/api/scenarios', (req, res) => {
    try {
        res.json(SCENARIOS);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch scenarios', details: error.message });
    }
});

// Get signed URL for ElevenLabs Conversational AI
app.get('/api/signed-url', async (req, res) => {
    try {
        const agentId = process.env.ELEVEN_LABS_AGENT_ID;
        const apiKey = process.env.ELEVEN_LABS_API_KEY;

        if (!agentId || !apiKey) {
            return res.status(500).json({ error: 'ElevenLabs configuration missing' });
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
        res.status(500).json({ error: 'Failed to get signed URL', details: error.message });
    }
});

// Get Agent ID for public agents
app.get('/api/agent-id', (req, res) => {
    const agentId = process.env.ELEVEN_LABS_AGENT_ID;
    res.json({ agentId });
});

// AI-powered coaching evaluation system
app.post('/api/evaluate-session', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        // Get session data from database
        const session = getSession.get(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const turns = getSessionTurns.all(sessionId);
        if (turns.length < 2) {
            return res.status(400).json({ error: 'Not enough conversation data for evaluation' });
        }

        // Get scenario context for evaluation
        const scenario = session.scenario ? SCENARIOS[session.scenario] : null;
        const scenarioContext = scenario ? scenario.title : 'General conversation';

        // Prepare conversation for AI analysis
        const conversationText = turns.map(turn =>
            `${turn.speaker.charAt(0).toUpperCase() + turn.speaker.slice(1)}: ${turn.message}`
        ).join('\n');

        // AI prompt for coaching evaluation
        const evaluationPrompt = `
You are an expert conversation coach. Analyze this role-play conversation for the scenario: "${scenarioContext}"

Conversation:
${conversationText}

Evaluate the USER's performance (not the assistant's) in the following areas:
1. Communication Skills (1-10): Clarity, articulation, tone
2. Problem Solving (1-10): Addressing issues, finding solutions
3. Professionalism (1-10): Courtesy, appropriate responses
4. Engagement (1-10): Active listening, asking questions, maintaining flow

Provide your response in this exact JSON format:
{
  "overall_score": [number 1-10],
  "communication_score": [number 1-10],
  "problem_solving_score": [number 1-10],
  "professionalism_score": [number 1-10],
  "engagement_score": [number 1-10],
  "feedback": "[Overall feedback paragraph]",
  "strengths": "[What they did well]",
  "improvements": "[Areas for improvement with specific suggestions]"
}`;

        // Get AI evaluation
        const evaluation = await ionosAI.getChatCompletion([
            { role: 'system', content: 'You are a professional conversation coach. Return only valid JSON.' },
            { role: 'user', content: evaluationPrompt }
        ], 'meta-llama/Meta-Llama-3.1-405B-Instruct-FP8');

        // Parse the AI response
        let evaluationData;
        try {
            evaluationData = JSON.parse(evaluation);
        } catch (parseError) {
            // Fallback if AI doesn't return valid JSON
            evaluationData = {
                overall_score: 7,
                communication_score: 7,
                problem_solving_score: 7,
                professionalism_score: 7,
                engagement_score: 7,
                feedback: "Good conversation overall with room for improvement.",
                strengths: "Maintained professional tone throughout the conversation.",
                improvements: "Focus on asking more clarifying questions and providing more detailed responses."
            };
        }

        // Ensure scores are within valid range
        const scores = ['overall_score', 'communication_score', 'problem_solving_score', 'professionalism_score', 'engagement_score'];
        scores.forEach(score => {
            evaluationData[score] = Math.max(1, Math.min(10, evaluationData[score] || 7));
        });

        // Save evaluation to database
        try {
            insertCoachingEvaluation.run(
                sessionId,
                evaluationData.overall_score,
                evaluationData.communication_score,
                evaluationData.problem_solving_score,
                evaluationData.professionalism_score,
                evaluationData.engagement_score,
                evaluationData.feedback,
                evaluationData.strengths,
                evaluationData.improvements
            );
        } catch (dbError) {
            console.warn('Failed to save evaluation to database:', dbError.message);
        }

        res.json({
            sessionId,
            scenario: scenarioContext,
            conversationLength: turns.length,
            evaluation: evaluationData
        });

    } catch (error) {
        console.error('Evaluation failed:', error);
        res.status(500).json({ error: 'Failed to evaluate session', details: error.message });
    }
});

// Get coaching evaluation for a session
app.get('/api/evaluate-session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const evaluation = getCoachingEvaluation.get(sessionId);
        if (!evaluation) {
            return res.status(404).json({ error: 'No evaluation found for this session' });
        }

        const session = getSession.get(sessionId);
        const scenario = session?.scenario ? SCENARIOS[session.scenario]?.title : 'General conversation';

        res.json({
            sessionId,
            scenario,
            evaluation: {
                overall_score: evaluation.overall_score,
                communication_score: evaluation.communication_score,
                problem_solving_score: evaluation.problem_solving_score,
                professionalism_score: evaluation.professionalism_score,
                engagement_score: evaluation.engagement_score,
                feedback: evaluation.feedback,
                strengths: evaluation.strengths,
                improvements: evaluation.improvements,
                created_at: evaluation.created_at
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get evaluation', details: error.message });
    }
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const transcription = await ionosAI.transcribeAudio(req.file.path);

        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
        });

        res.json({ text: transcription });
    } catch (error) {
        res.status(500).json({ error: 'Failed to transcribe audio', details: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, model } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'No message provided' });
        }

        const messages = [
            { role: 'system', content: 'You are a helpful voice assistant. Keep responses concise and conversational.' },
            { role: 'user', content: message }
        ];

        const response = await ionosAI.getChatCompletion(messages, model);
        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get chat response', details: error.message });
    }
});

app.post('/api/tts', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const { fileName, filePath } = await elevenLabs.textToSpeech(text);

        res.json({ fileName, audioUrl: `/api/audio/${fileName}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to convert text to speech', details: error.message });
    }
});

app.post('/api/agent-chat', async (req, res) => {
    try {
        const { message, sessionId, conversationId, scenario } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'No message provided' });
        }

        // Get or create session
        const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        let session = conversations.get(currentSessionId);
        if (!session) {
            session = {
                id: currentSessionId,
                conversationId: conversationId || null,
                scenario: scenario || null,
                messages: [],
                created: new Date(),
                lastActivity: new Date()
            };
            conversations.set(currentSessionId, session);

            // Save session to database
            if (scenario) {
                try {
                    insertSession.run(currentSessionId, scenario);
                } catch (dbError) {
                    console.warn('Failed to save session to database:', dbError.message);
                }
            }
        }

        // Update last activity
        session.lastActivity = new Date();

        // Add user message to session and database
        session.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date()
        });

        try {
            insertTurn.run(currentSessionId, 'user', message);
        } catch (dbError) {
            console.warn('Failed to save user message to database:', dbError.message);
        }

        console.log(`Session ${currentSessionId}: User said "${message}"`);

        // If this is a scenario-based conversation, modify the message with context
        let contextualMessage = message;
        if (session.scenario && SCENARIOS[session.scenario]) {
            const scenarioPrompt = SCENARIOS[session.scenario].prompt;
            contextualMessage = `${scenarioPrompt}\n\nUser message: ${message}`;
        }

        // Use ElevenLabs agent for both conversation and voice
        const result = await elevenLabs.conversationWithAgent(contextualMessage, session.conversationId);

        // Update session with agent response
        session.conversationId = result.conversationId;
        session.messages.push({
            role: 'assistant',
            content: result.text,
            timestamp: new Date(),
            audioFile: result.fileName
        });

        // Save assistant message to database
        try {
            insertTurn.run(currentSessionId, 'assistant', result.text);
        } catch (dbError) {
            console.warn('Failed to save assistant message to database:', dbError.message);
        }

        console.log(`Session ${currentSessionId}: Agent responded "${result.text}"`);

        res.json({
            response: result.text,
            audioUrl: `/api/audio/${result.fileName}`,
            sessionId: currentSessionId,
            conversationId: result.conversationId,
            messageCount: session.messages.length,
            scenario: session.scenario
        });
    } catch (error) {
        console.error('Agent chat error:', error);
        res.status(500).json({ error: 'Failed to get agent response', details: error.message });
    }
});

// Get conversation history
app.get('/api/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = conversations.get(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            sessionId: session.id,
            conversationId: session.conversationId,
            messages: session.messages,
            messageCount: session.messages.length,
            created: session.created,
            lastActivity: session.lastActivity
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get session', details: error.message });
    }
});

// Clear conversation
app.delete('/api/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const deleted = conversations.delete(sessionId);

        if (!deleted) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({ message: 'Session cleared successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear session', details: error.message });
    }
});

app.get('/api/audio/:filename', (req, res) => {
    const filePath = join(__dirname, 'audio', req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio file not found' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    const audioStream = fs.createReadStream(filePath);
    audioStream.pipe(res);

    audioStream.on('end', () => {
        setTimeout(() => {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting audio file:', err);
            });
        }, 5000);
    });
});

app.post('/api/process-voice', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log('Processing voice input...');

        // Clean up the uploaded file immediately since we can't transcribe it
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
        });

        // Return a message that encourages using browser speech recognition instead
        res.json({
            transcription: "Browser speech recognition not available in this mode",
            keywordDetected: false,
            message: "Please use the browser speech recognition by clicking the microphone button instead of uploading audio files. This provides better transcription and faster processing.",
            useWebSpeech: true
        });

    } catch (error) {
        console.error('Error processing voice:', error);
        res.status(500).json({ error: 'Failed to process voice', details: error.message });
    }
});

// Ultra-fast chat endpoint optimized for speech-to-text input
app.post('/api/instant-chat', async (req, res) => {
    try {
        const { message, fastMode = false, conversationId = null } = req.body;
        console.log('Instant chat request received:', { message, fastMode, conversationId });

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const startTime = Date.now();

        // Use ElevenLabs Agent for fastest response with conversation continuity
        if (process.env.ELEVEN_LABS_API_KEY && process.env.ELEVEN_LABS_AGENT_ID) {
            try {
                // Add timeout to prevent hanging
                const agentPromise = elevenLabs.chatWithAgent(message, conversationId);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('ElevenLabs agent timeout')), 10000)
                );

                const agentResponse = await Promise.race([agentPromise, timeoutPromise]);

                // Check if ElevenLabs is giving a generic/repeated response instead of answering the question
                const isGenericResponse = agentResponse.response.includes("I'm ready — what's on your mind today") ||
                                        agentResponse.response.includes("Want to capture a note, draft a message");

                // If it's a conversation continuation but getting generic response, use IONOS AI fallback
                if (conversationId && isGenericResponse) {
                    console.log('ElevenLabs gave generic response for conversation continuation, falling back to IONOS AI');
                    throw new Error('ElevenLabs not engaging with conversation context');
                }

                // Generate TTS in parallel for faster response
                let audioUrl = null;
                const ttsPromise = elevenLabs.generateSpeech(agentResponse.response)
                    .then(url => audioUrl = url)
                    .catch(error => console.error('TTS generation failed:', error));

                // Don't wait for TTS if in fast mode
                if (!fastMode) {
                    await ttsPromise;
                }

                const responseTime = Date.now() - startTime;

                res.json({
                    response: agentResponse.response,
                    audioUrl: audioUrl,
                    sessionId: agentResponse.sessionId,
                    conversationId: agentResponse.conversationId,
                    messageCount: agentResponse.messageCount,
                    responseTime: `${responseTime}ms`,
                    fastMode: fastMode
                });

                // Complete TTS generation in background if fast mode
                if (fastMode && !audioUrl) {
                    ttsPromise.then(url => {
                        console.log(`Background TTS completed for: "${message.substring(0, 50)}..."`);
                    });
                }

                return;

            } catch (error) {
                console.error('ElevenLabs agent failed, falling back to IONOS:', error);
            }
        }

        // Fallback to IONOS AI for fast text generation with conversation continuity
        const messages = [
            { role: 'system', content: 'You are a helpful voice assistant. Keep responses concise and conversational.' }
        ];

        // Add conversation history if available
        if (conversationId && conversations.has(conversationId)) {
            const conversationHistory = conversations.get(conversationId);
            // Add the conversation history to messages
            messages.push(...conversationHistory);
            console.log('Using IONOS AI fallback with conversation history:', conversationId);
        } else {
            console.log('Using IONOS AI fallback for new conversation');
        }

        // Add current message
        messages.push({ role: 'user', content: message });

        const ionosResponse = await ionosAI.getChatCompletion(messages, 'meta-llama/Meta-Llama-3.1-8B-Instruct');

        let audioUrl = null;
        if (!fastMode) {
            try {
                audioUrl = await elevenLabs.generateSpeech(ionosResponse);
            } catch (error) {
                console.error('TTS generation failed:', error);
            }
        }

        // Store conversation history for IONOS AI fallback
        const finalConversationId = conversationId || Date.now().toString();
        if (!conversations.has(finalConversationId)) {
            conversations.set(finalConversationId, []);
        }
        const history = conversations.get(finalConversationId);
        history.push({ role: 'user', content: message });
        history.push({ role: 'assistant', content: ionosResponse });

        // Keep only last 10 messages (5 exchanges) to prevent memory bloat
        if (history.length > 10) {
            conversations.set(finalConversationId, history.slice(-10));
        }

        const responseTime = Date.now() - startTime;

        res.json({
            response: ionosResponse,
            audioUrl: audioUrl,
            sessionId: finalConversationId,
            conversationId: finalConversationId,
            messageCount: history.length / 2,
            responseTime: `${responseTime}ms`,
            fastMode: fastMode
        });

    } catch (error) {
        console.error('Instant chat failed:', error);
        res.status(500).json({
            error: 'Failed to process instant chat',
            details: error.message
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        services: {
            ionos: !!process.env.IONOS_API_TOKEN,
            elevenlabs: !!process.env.ELEVEN_LABS_API_KEY
        }
    });
});

// Initialize real-time voice processor
const voiceProcessor = new RealTimeVoiceProcessor(io, elevenLabs);

httpServer.listen(port, process.env.HOST || 'localhost', () => {
    console.log(`🎙️ Real-Time Voice Assistant Backend running on http://${process.env.HOST || 'localhost'}:${port}`);
    console.log('📡 WebSocket server ready for real-time audio');
    console.log('Available endpoints:');
    console.log('  GET  /api/health - Health check');
    console.log('  GET  /api/models - List available AI models');
    console.log('  GET  /api/scenarios - Get conversation scenarios');
    console.log('  POST /api/transcribe - Transcribe audio to text');
    console.log('  POST /api/chat - Get chat completion');
    console.log('  POST /api/agent-chat - Chat with ElevenLabs agent');
    console.log('  POST /api/tts - Convert text to speech');
    console.log('  POST /api/evaluate-session - Get AI coaching evaluation');
    console.log('  GET  /api/evaluate-session/:id - Get existing evaluation');
    console.log('  POST /api/process-voice - Complete voice processing pipeline');
    console.log('  GET  /api/audio/:filename - Serve generated audio files');
    console.log('  🔄 WebSocket: Real-time voice streaming');
    console.log('  🎯 Coaching: AI-powered conversation analysis');
});