import mic from 'mic';
import sound from 'sound-play';
import { Writer } from 'wav';
import { Writable } from 'stream';
import fs, { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';
import FormData from 'form-data';
import voice from 'elevenlabs-node';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VoiceAssistant {
    constructor() {
        this.apiToken = process.env.IONOS_API_TOKEN;
        this.baseURL = 'https://openai.inference.de-txl.ionos.com/v1';
        this.elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
        this.voiceId = process.env.ELEVEN_LABS_VOICE_ID;
        this.keyword = process.env.KEYWORD || 'assistant';
        this.silenceDuration = parseInt(process.env.SILENCE_DURATION) || 6;

        this.micInstance = null;
        this.micInputStream = null;
        this.isRecording = false;
        this.audioChunks = [];

        this.headers = {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
        };

        this.audioDir = join(__dirname, 'audio');
        if (!fs.existsSync(this.audioDir)) {
            fs.mkdirSync(this.audioDir, { recursive: true });
        }
    }

    initializeMicrophone() {
        this.micInstance = mic({
            rate: '16000',
            channels: '1',
            debug: false,
            exitOnSilence: this.silenceDuration
        });
        this.micInputStream = this.micInstance.getAudioStream();
    }

    startRecordingProcess() {
        console.log("🎤 Starting voice assistant - say '" + this.keyword + "' to begin...");

        if (this.micInstance) {
            this.micInstance.stop();
            this.micInputStream.unpipe();
        }

        this.initializeMicrophone();
        this.audioChunks = [];
        this.isRecording = true;

        this.micInputStream.pipe(new Writable({
            write: (chunk, _, callback) => {
                if (!this.isRecording) return callback();
                this.audioChunks.push(chunk);
                callback();
            }
        }));

        this.micInputStream.on('silence', () => this.handleSilence());
        this.micInputStream.on('error', (err) => {
            console.error('Microphone error:', err);
            this.startRecordingProcess();
        });

        this.micInstance.start();
    }

    async handleSilence() {
        console.log("🔇 Silence detected, processing audio...");

        if (!this.isRecording) return;

        this.isRecording = false;
        this.micInstance.stop();

        try {
            const audioFilename = await this.saveAudio(this.audioChunks);
            const transcription = await this.transcribeAudio(audioFilename);

            console.log("📝 Transcription:", transcription);

            if (transcription && transcription.toLowerCase().includes(this.keyword.toLowerCase())) {
                console.log("🎯 Keyword detected! Processing request...");

                const response = await this.getChatCompletion(transcription);
                console.log("🤖 AI Response:", response);

                const audioFile = await this.convertTextToSpeech(response);
                console.log("🔊 Playing response...");

                await sound.play(audioFile);
                console.log("✅ Response completed!");
            } else {
                console.log("⏭️  Keyword not detected, continuing to listen...");
            }
        } catch (error) {
            console.error("❌ Error processing audio:", error.message);
        }

        setTimeout(() => this.startRecordingProcess(), 1000);
    }

    async saveAudio(audioChunks) {
        return new Promise((resolve, reject) => {
            console.log("💾 Saving audio...");

            const audioBuffer = Buffer.concat(audioChunks);
            const wavWriter = new Writer({ sampleRate: 16000, channels: 1 });
            const filename = `${Date.now()}.wav`;
            const filePath = join(this.audioDir, filename);

            wavWriter.pipe(createWriteStream(filePath));

            wavWriter.on('finish', () => resolve(filePath));
            wavWriter.on('error', reject);

            wavWriter.end(audioBuffer);
        });
    }

    async transcribeAudio(audioFilePath) {
        try {
            console.log("🎵 Transcribing audio with IONOS AI...");

            const formData = new FormData();
            formData.append('file', fs.createReadStream(audioFilePath));
            formData.append('model', 'whisper-1');

            const response = await axios.post(`${this.baseURL}/audio/transcriptions`, formData, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    ...formData.getHeaders()
                }
            });

            fs.unlink(audioFilePath, (err) => {
                if (err) console.error('Error deleting temp audio file:', err);
            });

            return response.data.text;
        } catch (error) {
            console.error('Transcription error:', error.response?.data || error.message);

            if (error.response?.status === 404) {
                console.log("⚠️  Audio transcription not available on IONOS, using fallback...");
                return "Sorry, transcription is not available right now.";
            }

            throw error;
        }
    }

    async getChatCompletion(message) {
        try {
            console.log("🧠 Getting response from IONOS AI...");

            const response = await axios.post(`${this.baseURL}/chat/completions`, {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful voice assistant. Keep responses concise and conversational, under 100 words.' },
                    { role: 'user', content: message }
                ],
                max_tokens: 150,
                temperature: 0.7
            }, {
                headers: this.headers
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Chat completion error:', error.response?.data || error.message);
            throw error;
        }
    }

    async convertTextToSpeech(text) {
        try {
            console.log("🗣️  Converting text to speech with ElevenLabs...");

            const fileName = `${Date.now()}.mp3`;
            const filePath = join(this.audioDir, fileName);

            const audioStream = await voice.textToSpeechStream(
                this.elevenLabsApiKey,
                this.voiceId,
                text
            );

            const fileWriteStream = fs.createWriteStream(filePath);
            audioStream.pipe(fileWriteStream);

            return new Promise((resolve, reject) => {
                fileWriteStream.on('finish', () => resolve(filePath));
                fileWriteStream.on('error', reject);
                audioStream.on('error', reject);
            });
        } catch (error) {
            console.error('Text-to-speech error:', error);
            throw error;
        }
    }

    async checkServices() {
        console.log("🔍 Checking service availability...");

        try {
            const modelsResponse = await axios.get(`${this.baseURL}/models`, {
                headers: this.headers
            });
            console.log("✅ IONOS AI Model Hub: Connected");
            console.log("📋 Available models:", modelsResponse.data.data.map(m => m.id).join(', '));
        } catch (error) {
            console.error("❌ IONOS AI Model Hub: Connection failed", error.message);
        }

        if (this.elevenLabsApiKey) {
            console.log("✅ ElevenLabs: API key configured");
        } else {
            console.error("❌ ElevenLabs: API key missing");
        }

        console.log(`🎯 Listening for keyword: "${this.keyword}"`);
        console.log(`⏱️  Silence duration: ${this.silenceDuration} seconds`);
    }

    async start() {
        console.log("🚀 Initializing Voice Assistant...");

        await this.checkServices();
        this.startRecordingProcess();

        process.stdin.resume();

        process.on('SIGINT', () => {
            console.log("\n👋 Shutting down Voice Assistant...");
            if (this.micInstance) {
                this.micInstance.stop();
            }
            process.exit(0);
        });
    }
}

const assistant = new VoiceAssistant();
assistant.start().catch(console.error);