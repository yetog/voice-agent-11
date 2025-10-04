// Voice Assistant Frontend Application
import { WebAudioRecorder, VoiceActivityDetector, AudioPlayer, convertBlobToWav } from './web-audio-utils.js';
import { RealTimeVoiceProcessor, LowLatencyAudioPlayer } from './real-time-voice.js';
import { InstantVoiceProcessor } from './speech-recognition.js';

class VoiceAssistantApp {
    constructor() {
        this.isInitialized = false;
        this.isRecording = false;
        this.isProcessing = false;
        this.audioRecorder = null;
        this.voiceDetector = null;
        this.audioPlayer = new AudioPlayer();
        this.realTimeVoice = null;
        this.lowLatencyPlayer = null;
        this.instantVoice = null;
        this.conversationHistory = [];
        this.isRealTimeMode = false;

        // Configuration
        this.config = {
            apiBaseUrl: 'http://localhost:5001/api',
            keyword: 'assistant',
            model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
            continuousMode: false,
            keywordRequired: true,
            useElevenLabsAgent: true,
            useRealTimeVoice: false,
            useInstantVoice: true, // Ultra-fast browser speech recognition
            volume: 0.8
        };

        // Session management
        this.sessionId = null;
        this.conversationId = null;
        this.selectedScenario = null;
        this.scenarios = {};

        // DOM elements
        this.elements = {};

        this.bindElements();
        this.bindEvents();
        this.loadSettings();
        this.initialize();
    }

    bindElements() {
        this.elements = {
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            voiceButton: document.getElementById('voiceButton'),
            voiceCircle: document.getElementById('voiceCircle'),
            micIcon: document.getElementById('micIcon'),
            stopIcon: document.getElementById('stopIcon'),
            recordingPulse: document.getElementById('recordingPulse'),
            voiceWaves: document.getElementById('voiceWaves'),
            messageDisplay: document.getElementById('messageDisplay'),
            conversationHistory: document.getElementById('conversationHistory'),
            historyContent: document.getElementById('historyContent'),
            textInput: document.getElementById('textInput'),
            sendButton: document.getElementById('sendButton'),
            clearButton: document.getElementById('clearButton'),
            settingsButton: document.getElementById('settingsButton'),
            volumeSlider: document.getElementById('volumeSlider'),
            settingsModal: document.getElementById('settingsModal'),
            closeSettings: document.getElementById('closeSettings'),
            keywordInput: document.getElementById('keywordInput'),
            modelSelect: document.getElementById('modelSelect'),
            continuousMode: document.getElementById('continuousMode'),
            keywordRequired: document.getElementById('keywordRequired'),
            useElevenLabsAgent: document.getElementById('useElevenLabsAgent'),
            useRealTimeVoice: document.getElementById('useRealTimeVoice'),
            saveSettings: document.getElementById('saveSettings'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            errorToast: document.getElementById('errorToast'),
            errorMessage: document.getElementById('errorMessage'),
            scenarioSelect: document.getElementById('scenarioSelect')
        };
    }

    bindEvents() {
        // Voice button
        this.elements.voiceButton.addEventListener('click', () => this.toggleRecording());

        // Text input
        this.elements.sendButton.addEventListener('click', () => this.sendTextMessage());
        this.elements.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendTextMessage();
            }
        });

        // Control buttons
        this.elements.clearButton.addEventListener('click', () => this.clearConversation());
        this.elements.settingsButton.addEventListener('click', () => this.showSettings());

        // Add evaluate button functionality (if it exists)
        const evaluateButton = document.getElementById('evaluateButton');
        if (evaluateButton) {
            evaluateButton.addEventListener('click', () => this.evaluateSession());
        }
        this.elements.closeSettings.addEventListener('click', () => this.hideSettings());
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings());

        // Volume control
        this.elements.volumeSlider.addEventListener('input', (e) => {
            this.config.volume = e.target.value / 100;
            this.audioPlayer.setVolume(this.config.volume);
        });

        // Scenario selector
        this.elements.scenarioSelect.addEventListener('change', (e) => {
            this.selectedScenario = e.target.value || null;
            this.clearConversation(); // Start fresh when changing scenarios
            this.updateScenarioDisplay();
        });

        // Settings modal
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.hideSettings();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('input, textarea, select')) {
                e.preventDefault();
                this.toggleRecording();
            }
            if (e.key === 'Escape') {
                this.hideSettings();
                if (this.isRecording) {
                    this.stopRecording();
                }
            }
        });
    }

    async initialize() {
        try {
            this.updateStatus('Initializing...', false);

            // Check API health
            await this.checkApiHealth();

            // Load available scenarios
            await this.loadScenarios();

            // Initialize audio systems
            this.audioRecorder = new WebAudioRecorder();
            await this.audioRecorder.initialize();

            // Initialize voice processors based on configuration
            if (this.config.useRealTimeVoice) {
                await this.initializeRealTimeVoice();
            } else if (this.config.useInstantVoice) {
                await this.initializeInstantVoice();
            }

            this.isInitialized = true;
            this.updateStatus('Ready', true);
            this.showWelcomeMessage();

        } catch (error) {
            console.error('Initialization failed:', error);
            this.updateStatus('Initialization failed', false);
            this.showError('Failed to initialize: ' + error.message);
        }
    }

    async checkApiHealth() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/health`);
            if (!response.ok) {
                throw new Error(`API health check failed: ${response.status}`);
            }
            const health = await response.json();
            console.log('API Health:', health);
            return health;
        } catch (error) {
            throw new Error('Backend API is not available. Please start the backend server.');
        }
    }

    updateStatus(text, connected) {
        this.elements.statusText.textContent = text;
        this.elements.statusDot.classList.toggle('connected', connected);
    }

    showWelcomeMessage() {
        const agentMode = this.config.useElevenLabsAgent ? 'ElevenLabs Agent' : 'IONOS AI + TTS';
        let voiceMode = 'Traditional';
        let modeDescription = '';

        if (this.config.useRealTimeVoice) {
            voiceMode = 'Real-Time WebSocket';
            modeDescription = '<p><strong>🎙️ Real-Time Mode:</strong> Ultra-low latency streaming audio processing!</p>';
        } else if (this.config.useInstantVoice) {
            voiceMode = 'Instant Speech Recognition';
            modeDescription = '<p><strong>⚡ Instant Mode:</strong> Browser-based speech recognition - fastest possible response!</p>';
        } else {
            modeDescription = this.config.useElevenLabsAgent ?
                '<p><strong>✨ Agent Mode:</strong> Conversations will be continuous and contextual!</p>' :
                '<p><strong>Note:</strong> Audio transcription is simulated for now - use text input for best results.</p>';
        }

        const welcomeHTML = `
            <div class="welcome-message">
                <h2>Welcome to IONOS Voice Assistant</h2>
                <p>Click the microphone or type your message below.</p>
                <p><strong>AI Mode:</strong> ${agentMode}</p>
                <p><strong>Voice Mode:</strong> ${voiceMode}</p>
                ${modeDescription}
            </div>
        `;
        this.elements.messageDisplay.innerHTML = welcomeHTML;
    }

    async initializeRealTimeVoice() {
        try {
            this.realTimeVoice = new RealTimeVoiceProcessor(this.config.apiBaseUrl);
            this.lowLatencyPlayer = new LowLatencyAudioPlayer();

            await this.realTimeVoice.initialize();
            await this.lowLatencyPlayer.initialize();

            // Set up real-time voice callbacks
            this.realTimeVoice.onConnected(() => {
                this.updateStatus('Real-time voice connected', true);
            });

            this.realTimeVoice.onSpeechDetected(() => {
                this.updateRecordingUI(true);
                this.updateStatus('Listening...', true);
            });

            this.realTimeVoice.onProcessing(() => {
                this.updateRecordingUI(false);
                this.updateStatus('Processing...', true);
            });

            this.realTimeVoice.onResponse(async (data) => {
                // Update conversation ID
                this.conversationId = data.conversationId;

                // Show transcription and response
                this.addMessage(data.transcription, 'transcription');
                this.addMessage(data.response, 'assistant');

                // Play audio with low latency
                if (data.audioUrl) {
                    const fullAudioUrl = `${this.config.apiBaseUrl.replace('/api', '')}${data.audioUrl}`;
                    await this.lowLatencyPlayer.playAudioUrl(fullAudioUrl);
                }

                this.updateStatus('Ready for next input', true);
            });

            this.realTimeVoice.onError((error) => {
                this.showError('Real-time voice error: ' + error.message);
                this.updateStatus('Ready', true);
            });

            this.isRealTimeMode = true;
            console.log('Real-time voice processor initialized');

        } catch (error) {
            console.error('Failed to initialize real-time voice:', error);
            this.config.useRealTimeVoice = false;
            this.isRealTimeMode = false;
            throw error;
        }
    }

    async initializeInstantVoice() {
        try {
            this.instantVoice = new InstantVoiceProcessor(this.config.apiBaseUrl);

            // Set up ultra-fast voice callbacks
            this.instantVoice.onTranscription((transcript, isFinal) => {
                if (isFinal) {
                    this.addMessage(transcript, 'transcription');
                    this.showLoading('Processing message...');
                } else {
                    // Show interim results for immediate feedback
                    this.updateStatus(`Listening: "${transcript}"`, true);
                }
            });

            this.instantVoice.onResponse(async (data) => {
                // Hide loading overlay
                this.hideLoading();

                // Update conversation tracking
                this.sessionId = data.sessionId;
                this.conversationId = data.conversationId;

                // Show AI response immediately
                this.addMessage(data.response, 'assistant');

                // Add to conversation history
                const lastTranscription = document.querySelector('.message-bubble.transcription:last-child')?.textContent || '';
                this.addToHistory(lastTranscription, data.response);

                // Play audio if available
                if (data.audioUrl) {
                    const fullAudioUrl = `${this.config.apiBaseUrl.replace('/api', '')}${data.audioUrl}`;
                    await this.audioPlayer.playFromUrl(fullAudioUrl);
                }

                this.updateStatus(`Ready - Response time: ${data.responseTime}`, true);
            });

            this.instantVoice.onError((error) => {
                this.hideLoading();
                this.showError(error);
                this.updateStatus('Ready', true);
            });

            console.log('Instant voice processor initialized');

        } catch (error) {
            console.error('Failed to initialize instant voice:', error);
            this.config.useInstantVoice = false;
            throw error;
        }
    }

    async sendTextMessage() {
        const message = this.elements.textInput.value.trim();
        if (!message) return;

        try {
            this.isProcessing = true;
            this.elements.sendButton.disabled = true;
            this.showLoading('Processing message...');

            // Show user message
            this.addMessage(message, 'user');

            // Clear input
            this.elements.textInput.value = '';

            let result;

            if (this.config.useElevenLabsAgent) {
                // Use ElevenLabs agent for complete conversation with session continuity
                const requestBody = {
                    message: message
                };

                // Include session info for conversation continuity
                if (this.sessionId) {
                    requestBody.sessionId = this.sessionId;
                }
                if (this.conversationId) {
                    requestBody.conversationId = this.conversationId;
                }

                // Include scenario for role-play
                if (this.selectedScenario) {
                    requestBody.scenario = this.selectedScenario;
                }

                console.log('Sending to agent with session:', requestBody);

                const response = await fetch(`${this.config.apiBaseUrl}/agent-chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    throw new Error(`Agent chat request failed: ${response.status}`);
                }

                result = await response.json();

                // Update session info for conversation continuity
                this.sessionId = result.sessionId;
                this.conversationId = result.conversationId;

                console.log('Agent response with session:', result);

                // Show AI response
                this.addMessage(result.response, 'assistant');

                // Update status to show conversation is active
                this.updateStatus(`Conversation active (${result.messageCount} messages)`, true);

                // Play agent audio directly
                if (result.audioUrl) {
                    const fullAudioUrl = `${this.config.apiBaseUrl.replace('/api', '')}${result.audioUrl}`;
                    await this.audioPlayer.playFromUrl(fullAudioUrl);
                }
            } else {
                // Use IONOS AI + ElevenLabs TTS
                const response = await fetch(`${this.config.apiBaseUrl}/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: message,
                        model: this.config.model
                    })
                });

                if (!response.ok) {
                    throw new Error(`Chat request failed: ${response.status}`);
                }

                result = await response.json();

                // Show AI response
                this.addMessage(result.response, 'assistant');

                // Convert to speech and play
                if (result.response) {
                    try {
                        const ttsResponse = await fetch(`${this.config.apiBaseUrl}/tts`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                text: result.response
                            })
                        });

                        if (ttsResponse.ok) {
                            const ttsResult = await ttsResponse.json();
                            const fullAudioUrl = `${this.config.apiBaseUrl.replace('/api', '')}${ttsResult.audioUrl}`;
                            await this.audioPlayer.playFromUrl(fullAudioUrl);
                        }
                    } catch (error) {
                        console.error('Text-to-speech failed:', error);
                    }
                }
            }

            // Add to conversation history
            this.addToHistory(message, result.response);

        } catch (error) {
            console.error('Text message failed:', error);
            this.showError('Failed to send message: ' + error.message);
        } finally {
            this.isProcessing = false;
            this.elements.sendButton.disabled = false;
            this.hideLoading();
        }
    }

    async toggleRecording() {
        if (!this.isInitialized) {
            this.showError('Assistant not initialized yet');
            return;
        }

        if (this.isProcessing) {
            this.showError('Please wait for current request to complete');
            return;
        }

        // Handle different voice modes
        if (this.config.useRealTimeVoice && this.isRealTimeMode) {
            // Real-time WebSocket voice mode
            if (this.isRecording) {
                await this.stopRealTimeVoice();
            } else {
                await this.startRealTimeVoice();
            }
        } else if (this.config.useInstantVoice && this.instantVoice) {
            // Ultra-fast browser speech recognition mode
            if (this.isRecording) {
                await this.stopInstantVoice();
            } else {
                await this.startInstantVoice();
            }
        } else {
            // Traditional voice mode
            if (this.isRecording) {
                await this.stopRecording();
            } else {
                await this.startRecording();
            }
        }
    }

    async startRecording() {
        try {
            this.isRecording = true;
            this.updateRecordingUI(true);
            this.updateStatus('Listening...', true);

            // Start recording
            const recordingPromise = this.audioRecorder.startRecording();

            // Setup voice activity detection
            this.setupVoiceDetection();

            // Wait for recording to complete
            const audioBlob = await recordingPromise;
            await this.processAudio(audioBlob);

        } catch (error) {
            console.error('Recording failed:', error);
            this.showError('Recording failed: ' + error.message);
        } finally {
            this.isRecording = false;
            this.updateRecordingUI(false);
            this.updateStatus('Ready', true);
        }
    }

    async startRealTimeVoice() {
        try {
            this.isRecording = true;
            this.updateRecordingUI(true);
            this.updateStatus('Starting real-time session...', true);

            await this.realTimeVoice.startVoiceSession(this.conversationId);

        } catch (error) {
            console.error('Real-time voice start failed:', error);
            this.showError('Real-time voice failed: ' + error.message);
            this.isRecording = false;
            this.updateRecordingUI(false);
        }
    }

    async stopRealTimeVoice() {
        try {
            this.realTimeVoice.stopVoiceSession();
            this.isRecording = false;
            this.updateRecordingUI(false);
            this.updateStatus('Ready', true);

        } catch (error) {
            console.error('Real-time voice stop failed:', error);
            this.showError('Failed to stop real-time voice');
        }
    }

    async startInstantVoice() {
        try {
            const started = this.instantVoice.startListening();
            if (started) {
                this.isRecording = true;
                this.updateRecordingUI(true);
                this.updateStatus('Listening...', true);
            } else {
                this.showError('Speech recognition not supported in this browser');
            }

        } catch (error) {
            console.error('Instant voice start failed:', error);
            this.showError('Instant voice failed: ' + error.message);
            this.isRecording = false;
            this.updateRecordingUI(false);
        }
    }

    async stopInstantVoice() {
        try {
            this.instantVoice.stopListening();
            this.isRecording = false;
            this.updateRecordingUI(false);
            this.updateStatus('Ready', true);

        } catch (error) {
            console.error('Instant voice stop failed:', error);
            this.showError('Failed to stop instant voice');
        }
    }

    async stopRecording() {
        if (this.audioRecorder && this.isRecording) {
            this.audioRecorder.stopRecording();
        }
        if (this.voiceDetector) {
            this.voiceDetector.stop();
            this.voiceDetector = null;
        }
    }

    setupVoiceDetection() {
        if (this.audioRecorder.stream) {
            this.voiceDetector = new VoiceActivityDetector(this.audioRecorder.stream, {
                silenceThreshold: 30,
                silenceDuration: 2000,
                minSpeechDuration: 500,
                onSpeechStart: () => {
                    this.elements.voiceWaves.classList.add('active');
                },
                onSpeechEnd: () => {
                    this.elements.voiceWaves.classList.remove('active');
                },
                onSilence: () => {
                    if (this.isRecording) {
                        this.stopRecording();
                    }
                }
            });
            this.voiceDetector.start();
        }
    }

    updateRecordingUI(recording) {
        this.elements.voiceButton.classList.toggle('recording', recording);
        this.elements.micIcon.classList.toggle('hidden', recording);
        this.elements.stopIcon.classList.toggle('hidden', !recording);

        if (recording) {
            this.elements.voiceCircle.style.animation = 'recordingPulse 1.5s infinite';
        } else {
            this.elements.voiceCircle.style.animation = '';
            this.elements.voiceWaves.classList.remove('active');
        }
    }

    async processAudio(audioBlob) {
        try {
            this.isProcessing = true;
            this.showLoading('Processing audio...');

            // Convert to WAV format
            const wavBlob = await convertBlobToWav(audioBlob);

            // Create form data
            const formData = new FormData();
            formData.append('audio', wavBlob, 'recording.wav');

            // Send to backend for processing
            const response = await fetch(`${this.config.apiBaseUrl}/process-voice`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Processing failed: ${response.status}`);
            }

            const result = await response.json();
            await this.handleProcessingResult(result);

        } catch (error) {
            console.error('Audio processing failed:', error);
            this.showError('Audio processing failed: ' + error.message);
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    async handleProcessingResult(result) {
        const { transcription, keywordDetected, response, audioUrl } = result;

        // Show transcription
        this.addMessage(transcription, 'transcription');

        if (!keywordDetected && this.config.keywordRequired) {
            this.addMessage(`Keyword "${this.config.keyword}" not detected. Please try again.`, 'system');
            return;
        }

        if (response) {
            // Show AI response
            this.addMessage(response, 'assistant');

            // Add to conversation history
            this.addToHistory(transcription, response);

            // Play audio response
            if (audioUrl) {
                try {
                    this.showLoading('Playing response...');
                    const fullAudioUrl = `${this.config.apiBaseUrl.replace('/api', '')}${audioUrl}`;
                    await this.audioPlayer.playFromUrl(fullAudioUrl);
                } catch (error) {
                    console.error('Audio playback failed:', error);
                    this.showError('Audio playback failed');
                } finally {
                    this.hideLoading();
                }
            }
        }
    }

    addMessage(content, type) {
        const messageHTML = `
            <div class="message-bubble ${type}">
                ${content}
            </div>
        `;

        if (this.elements.messageDisplay.querySelector('.welcome-message')) {
            this.elements.messageDisplay.innerHTML = '';
        }

        this.elements.messageDisplay.insertAdjacentHTML('beforeend', messageHTML);
        this.elements.messageDisplay.scrollTop = this.elements.messageDisplay.scrollHeight;
    }

    addToHistory(userMessage, assistantResponse) {
        const timestamp = new Date().toLocaleTimeString();
        const historyItem = {
            timestamp,
            userMessage,
            assistantResponse
        };

        this.conversationHistory.unshift(historyItem);

        const historyHTML = `
            <div class="history-item">
                <div class="timestamp">${timestamp}</div>
                <div class="content">
                    <strong>You:</strong> ${userMessage}<br>
                    <strong>Assistant:</strong> ${assistantResponse}
                </div>
            </div>
        `;

        this.elements.historyContent.insertAdjacentHTML('afterbegin', historyHTML);
    }

    async clearConversation() {
        // Clear session on backend if using ElevenLabs agent
        if (this.sessionId && this.config.useElevenLabsAgent) {
            try {
                await fetch(`${this.config.apiBaseUrl}/sessions/${this.sessionId}`, {
                    method: 'DELETE'
                });
                console.log('Session cleared on backend');
            } catch (error) {
                console.error('Failed to clear session on backend:', error);
            }
        }

        // Reset local state
        this.sessionId = null;
        this.conversationId = null;
        this.elements.messageDisplay.innerHTML = '';
        this.elements.historyContent.innerHTML = '';
        this.conversationHistory = [];
        this.updateStatus('Ready', true);
        this.showWelcomeMessage();
    }

    showSettings() {
        this.elements.keywordInput.value = this.config.keyword;
        this.elements.modelSelect.value = this.config.model;
        this.elements.continuousMode.checked = this.config.continuousMode;
        this.elements.keywordRequired.checked = this.config.keywordRequired;
        this.elements.useElevenLabsAgent.checked = this.config.useElevenLabsAgent;
        this.elements.useRealTimeVoice.checked = this.config.useRealTimeVoice;
        this.elements.settingsModal.classList.remove('hidden');
    }

    hideSettings() {
        this.elements.settingsModal.classList.add('hidden');
    }

    async saveSettings() {
        const previousRealTimeMode = this.config.useRealTimeVoice;

        this.config.keyword = this.elements.keywordInput.value.trim() || 'assistant';
        this.config.model = this.elements.modelSelect.value;
        this.config.continuousMode = this.elements.continuousMode.checked;
        this.config.keywordRequired = this.elements.keywordRequired.checked;
        this.config.useElevenLabsAgent = this.elements.useElevenLabsAgent.checked;
        this.config.useRealTimeVoice = this.elements.useRealTimeVoice.checked;

        // Handle real-time voice mode changes
        if (this.config.useRealTimeVoice && !previousRealTimeMode) {
            // Switching to real-time mode
            try {
                await this.initializeRealTimeVoice();
                this.showSuccess('Real-time voice mode enabled');
            } catch (error) {
                console.error('Failed to enable real-time mode:', error);
                this.config.useRealTimeVoice = false;
                this.elements.useRealTimeVoice.checked = false;
                this.showError('Failed to enable real-time mode: ' + error.message);
                return;
            }
        } else if (!this.config.useRealTimeVoice && previousRealTimeMode) {
            // Switching to traditional mode
            if (this.realTimeVoice) {
                this.realTimeVoice.disconnect();
                this.realTimeVoice = null;
            }
            this.isRealTimeMode = false;
            this.showSuccess('Traditional voice mode enabled');
        }

        // Save to localStorage
        localStorage.setItem('voiceAssistantConfig', JSON.stringify(this.config));

        this.hideSettings();
        this.showWelcomeMessage();
        this.showSuccess('Settings saved successfully');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('voiceAssistantConfig');
            if (saved) {
                const savedConfig = JSON.parse(saved);
                this.config = { ...this.config, ...savedConfig };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }

        // Apply volume setting
        this.elements.volumeSlider.value = this.config.volume * 100;
        this.audioPlayer.setVolume(this.config.volume);
    }

    showLoading(text = 'Processing...') {
        this.elements.loadingText.textContent = text;
        this.elements.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorToast.classList.remove('hidden');
        setTimeout(() => {
            this.elements.errorToast.classList.add('hidden');
        }, 5000);
    }

    showSuccess(message) {
        // Create temporary success toast
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.style.background = 'var(--secondary-green)';
        toast.innerHTML = `
            <div class="toast-content">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M16.667 5L7.5 14.167 3.333 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Load available scenarios from backend
    async loadScenarios() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/scenarios`);
            if (!response.ok) {
                throw new Error(`Failed to load scenarios: ${response.status}`);
            }

            this.scenarios = await response.json();
            this.populateScenarioSelect();
        } catch (error) {
            console.error('Failed to load scenarios:', error);
            // Continue without scenarios if loading fails
        }
    }

    // Populate the scenario selector dropdown
    populateScenarioSelect() {
        const select = this.elements.scenarioSelect;

        // Clear existing options except the first one
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        // Add scenario options
        for (const [key, scenario] of Object.entries(this.scenarios)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = scenario.title;
            select.appendChild(option);
        }
    }

    // Update scenario display in the UI
    updateScenarioDisplay() {
        const messageDisplay = this.elements.messageDisplay;

        if (this.selectedScenario && this.scenarios[this.selectedScenario]) {
            const scenario = this.scenarios[this.selectedScenario];

            // Clear existing messages and show scenario info
            messageDisplay.innerHTML = `
                <div class="scenario-info">
                    <h3>🎭 Practice Scenario: ${scenario.title}</h3>
                    <p class="scenario-description">${scenario.prompt}</p>
                    <p class="scenario-instruction">Start the conversation now. The AI will role-play according to this scenario.</p>
                </div>
            `;
        } else {
            // Show welcome message when no scenario is selected
            this.showWelcomeMessage();
        }
    }

    // Evaluate current session using AI coaching
    async evaluateSession() {
        if (!this.sessionId) {
            this.showError('No conversation session to evaluate. Please have a conversation first.');
            return;
        }

        try {
            this.showLoading('Evaluating your conversation performance...');

            const response = await fetch(`${this.config.apiBaseUrl}/evaluate-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`Evaluation failed: ${response.status}`);
            }

            const result = await response.json();
            this.displayEvaluationResults(result);

        } catch (error) {
            console.error('Evaluation failed:', error);
            this.showError('Failed to evaluate session: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // Display coaching evaluation results
    displayEvaluationResults(result) {
        const evaluation = result.evaluation;

        // Create evaluation display HTML
        const evaluationHTML = `
            <div class="evaluation-results">
                <h3>🎯 Coaching Evaluation: ${result.scenario}</h3>

                <div class="scores-grid">
                    <div class="score-item">
                        <span class="score-label">Overall</span>
                        <span class="score-value ${this.getScoreClass(evaluation.overall_score)}">${evaluation.overall_score}/10</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Communication</span>
                        <span class="score-value ${this.getScoreClass(evaluation.communication_score)}">${evaluation.communication_score}/10</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Problem Solving</span>
                        <span class="score-value ${this.getScoreClass(evaluation.problem_solving_score)}">${evaluation.problem_solving_score}/10</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Professionalism</span>
                        <span class="score-value ${this.getScoreClass(evaluation.professionalism_score)}">${evaluation.professionalism_score}/10</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Engagement</span>
                        <span class="score-value ${this.getScoreClass(evaluation.engagement_score)}">${evaluation.engagement_score}/10</span>
                    </div>
                </div>

                <div class="feedback-section">
                    <h4>📝 Overall Feedback</h4>
                    <p>${evaluation.feedback}</p>
                </div>

                <div class="strengths-section">
                    <h4>💪 Strengths</h4>
                    <p>${evaluation.strengths}</p>
                </div>

                <div class="improvements-section">
                    <h4>📈 Areas for Improvement</h4>
                    <p>${evaluation.improvements}</p>
                </div>

                <div class="evaluation-actions">
                    <button class="action-button" onclick="voiceAssistant.clearConversation()">Start New Practice</button>
                    <button class="action-button secondary" onclick="voiceAssistant.hideEvaluation()">Continue Conversation</button>
                </div>
            </div>
        `;

        // Show evaluation in message display
        this.elements.messageDisplay.innerHTML = evaluationHTML;
        this.elements.messageDisplay.scrollTop = 0;
    }

    // Get CSS class for score styling
    getScoreClass(score) {
        if (score >= 8) return 'score-excellent';
        if (score >= 6) return 'score-good';
        if (score >= 4) return 'score-average';
        return 'score-poor';
    }

    // Hide evaluation and return to conversation
    hideEvaluation() {
        if (this.selectedScenario) {
            this.updateScenarioDisplay();
        } else {
            this.showWelcomeMessage();
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.voiceAssistant = new VoiceAssistantApp();
});

// Handle page visibility for cleanup
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.voiceAssistant) {
        if (window.voiceAssistant.isRecording) {
            window.voiceAssistant.stopRecording();
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.voiceAssistant && window.voiceAssistant.audioRecorder) {
        window.voiceAssistant.audioRecorder.cleanup();
    }
});