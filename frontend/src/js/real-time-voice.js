// Real-Time Voice Processing with WebSocket
import { io } from "https://cdn.socket.io/4.7.0/socket.io.esm.min.js";

export class RealTimeVoiceProcessor {
    constructor(apiBaseUrl) {
        this.socket = null;
        this.audioContext = null;
        this.microphone = null;
        this.processor = null;
        this.isConnected = false;
        this.isRecording = false;
        this.sessionId = null;
        this.conversationId = null;

        // Audio settings optimized for low latency
        this.audioConfig = {
            sampleRate: 16000,
            bufferSize: 1024, // Small buffer for low latency
            channels: 1
        };

        this.apiBaseUrl = apiBaseUrl;
        this.callbacks = {
            onConnected: () => {},
            onDisconnected: () => {},
            onSpeechDetected: () => {},
            onProcessing: () => {},
            onResponse: () => {},
            onError: () => {}
        };
    }

    async initialize() {
        try {
            // Initialize WebSocket connection
            this.socket = io(this.apiBaseUrl.replace('/api', ''), {
                transports: ['websocket']
            });

            this.setupSocketListeners();

            // Initialize audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.audioConfig.sampleRate,
                latencyHint: 'interactive' // Optimize for low latency
            });

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.audioConfig.sampleRate,
                    channelCount: this.audioConfig.channels,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    latency: 0 // Request lowest latency
                }
            });

            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // Create processor for real-time audio processing
            this.processor = this.audioContext.createScriptProcessor(
                this.audioConfig.bufferSize,
                this.audioConfig.channels,
                this.audioConfig.channels
            );

            this.processor.onaudioprocess = (event) => {
                if (this.isRecording && this.socket && this.socket.connected) {
                    const inputBuffer = event.inputBuffer.getChannelData(0);

                    // Convert to 16-bit PCM and send in real-time
                    const pcmData = this.convertTo16BitPCM(inputBuffer);
                    this.socket.emit('audio-chunk', pcmData);
                }
            };

            console.log('Real-time voice processor initialized');
            return true;

        } catch (error) {
            console.error('Failed to initialize real-time voice processor:', error);
            this.callbacks.onError(error);
            throw error;
        }
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to voice server');
            this.isConnected = true;
            this.callbacks.onConnected();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from voice server');
            this.isConnected = false;
            this.callbacks.onDisconnected();
        });

        this.socket.on('voice-session-started', (data) => {
            console.log('Voice session started:', data);
            this.sessionId = data.sessionId;
        });

        this.socket.on('speech-detected', () => {
            console.log('Speech detected');
            this.callbacks.onSpeechDetected();
        });

        this.socket.on('processing-audio', () => {
            console.log('Processing audio...');
            this.callbacks.onProcessing();
        });

        this.socket.on('agent-response', (data) => {
            console.log('Agent response received:', data);
            this.conversationId = data.conversationId;
            this.callbacks.onResponse(data);
        });

        this.socket.on('error', (error) => {
            console.error('Voice server error:', error);
            this.callbacks.onError(error);
        });
    }

    async startVoiceSession(conversationId = null) {
        if (!this.socket || !this.socket.connected) {
            throw new Error('Not connected to voice server');
        }

        this.socket.emit('start-voice-session', {
            sessionId: this.sessionId,
            conversationId: conversationId || this.conversationId
        });

        // Start recording and processing
        this.isRecording = true;

        // Connect audio processing chain
        this.microphone.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        console.log('Voice session started');
    }

    stopVoiceSession() {
        this.isRecording = false;

        if (this.processor && this.microphone) {
            this.microphone.disconnect();
            this.processor.disconnect();
        }

        if (this.socket && this.socket.connected) {
            this.socket.emit('end-voice-session');
        }

        console.log('Voice session stopped');
    }

    convertTo16BitPCM(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        let offset = 0;

        for (let i = 0; i < float32Array.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return buffer;
    }

    // Voice Activity Detection helpers
    getAudioLevel(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += Math.abs(buffer[i]);
        }
        return sum / buffer.length;
    }

    // Set callback functions
    onConnected(callback) { this.callbacks.onConnected = callback; }
    onDisconnected(callback) { this.callbacks.onDisconnected = callback; }
    onSpeechDetected(callback) { this.callbacks.onSpeechDetected = callback; }
    onProcessing(callback) { this.callbacks.onProcessing = callback; }
    onResponse(callback) { this.callbacks.onResponse = callback; }
    onError(callback) { this.callbacks.onError = callback; }

    // Cleanup
    disconnect() {
        this.stopVoiceSession();

        if (this.socket) {
            this.socket.disconnect();
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}

// Utility class for optimized audio playback
export class LowLatencyAudioPlayer {
    constructor() {
        this.audioContext = null;
        this.gainNode = null;
        this.volume = 0.8;
    }

    async initialize() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive'
        });

        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = this.volume;
    }

    async playAudioUrl(audioUrl) {
        try {
            if (!this.audioContext) {
                await this.initialize();
            }

            const response = await fetch(audioUrl);
            const audioData = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(audioData);

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.gainNode);

            return new Promise((resolve) => {
                source.onended = resolve;
                source.start(0);
            });

        } catch (error) {
            console.error('Audio playback error:', error);
            throw error;
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
    }
}