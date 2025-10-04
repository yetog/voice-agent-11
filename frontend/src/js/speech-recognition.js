// Browser-based Speech Recognition for ultra-fast audio processing
export class FastSpeechRecognition {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.callbacks = {
            onResult: () => {},
            onError: () => {},
            onStart: () => {},
            onEnd: () => {}
        };

        // Check browser support
        this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

        if (this.isSupported) {
            this.initializeRecognition();
        }
    }

    initializeRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        // Optimize for speed and accuracy
        this.recognition.continuous = false; // Single utterance for faster response
        this.recognition.interimResults = true; // Get partial results immediately
        this.recognition.maxAlternatives = 1; // Only best result for speed
        this.recognition.lang = 'en-US';

        // Event handlers
        this.recognition.onstart = () => {
            this.isListening = true;
            this.callbacks.onStart();
            console.log('Speech recognition started');
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Return results immediately for ultra-low latency
            if (finalTranscript) {
                this.callbacks.onResult(finalTranscript.trim(), true);
            } else if (interimTranscript) {
                this.callbacks.onResult(interimTranscript.trim(), false);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.callbacks.onError(event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.callbacks.onEnd();
            console.log('Speech recognition ended');
        };
    }

    startListening() {
        if (!this.isSupported) {
            throw new Error('Speech recognition not supported in this browser');
        }

        if (!this.isListening) {
            this.recognition.start();
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    // Set callback functions for ultra-fast processing
    onResult(callback) { this.callbacks.onResult = callback; }
    onError(callback) { this.callbacks.onError = callback; }
    onStart(callback) { this.callbacks.onStart = callback; }
    onEnd(callback) { this.callbacks.onEnd = callback; }
}

// Optimized audio processing for real-time conversation
export class InstantVoiceProcessor {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.speechRecognition = new FastSpeechRecognition();
        this.isProcessing = false;

        // Conversation continuity
        this.conversationId = null;

        // Cache for faster responses
        this.responseCache = new Map();

        this.callbacks = {
            onTranscription: () => {},
            onResponse: () => {},
            onError: () => {}
        };

        this.setupSpeechRecognition();
    }

    setupSpeechRecognition() {
        this.speechRecognition.onResult((transcript, isFinal) => {
            if (isFinal && transcript.length > 0) {
                // Process immediately when speech is final
                this.processTranscriptInstantly(transcript);
            }

            // Show interim results for immediate feedback
            this.callbacks.onTranscription(transcript, isFinal);
        });

        this.speechRecognition.onError((error) => {
            this.callbacks.onError('Speech recognition error: ' + error);
        });
    }

    async processTranscriptInstantly(transcript) {
        if (this.isProcessing) return;

        this.isProcessing = true;

        try {
            // Check cache first for instant responses
            const cacheKey = transcript.toLowerCase().trim();
            if (this.responseCache.has(cacheKey)) {
                const cachedResponse = this.responseCache.get(cacheKey);
                this.callbacks.onResponse(cachedResponse);
                this.isProcessing = false;
                return;
            }

            // Send to backend with optimized payload
            const startTime = Date.now();

            const response = await fetch(`${this.apiBaseUrl}/instant-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: transcript,
                    fastMode: true, // Signal backend for speed optimization
                    conversationId: this.conversationId
                })
            });

            if (!response.ok) {
                throw new Error(`Chat request failed: ${response.status}`);
            }

            const result = await response.json();
            const responseTime = Date.now() - startTime;

            console.log(`Response time: ${responseTime}ms`);

            // Store conversation ID for continuity
            if (result.conversationId) {
                this.conversationId = result.conversationId;
            }

            // Cache response for future instant replies
            this.responseCache.set(cacheKey, result);

            // Limit cache size to prevent memory issues
            if (this.responseCache.size > 100) {
                const firstKey = this.responseCache.keys().next().value;
                this.responseCache.delete(firstKey);
            }

            this.callbacks.onResponse(result);

        } catch (error) {
            console.error('Instant processing failed:', error);
            this.callbacks.onError('Processing failed: ' + error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    startListening() {
        if (!this.speechRecognition.isSupported) {
            this.callbacks.onError('Speech recognition not supported. Please use text input.');
            return false;
        }

        this.speechRecognition.startListening();
        return true;
    }

    stopListening() {
        this.speechRecognition.stopListening();
    }

    // Set callback functions
    onTranscription(callback) { this.callbacks.onTranscription = callback; }
    onResponse(callback) { this.callbacks.onResponse = callback; }
    onError(callback) { this.callbacks.onError = callback; }
}