export class WebAudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
    }

    async initialize() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });
            return true;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            throw new Error('Microphone access denied or not available');
        }
    }

    startRecording() {
        if (!this.stream) {
            throw new Error('Audio stream not initialized. Call initialize() first.');
        }

        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.start();
        this.isRecording = true;

        return new Promise((resolve, reject) => {
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.isRecording = false;
                resolve(audioBlob);
            };

            this.mediaRecorder.onerror = (error) => {
                this.isRecording = false;
                reject(error);
            };
        });
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }
    }

    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
    }
}

export class VoiceActivityDetector {
    constructor(stream, options = {}) {
        this.stream = stream;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.microphone = this.audioContext.createMediaStreamSource(stream);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this.analyser.fftSize = 2048;
        this.microphone.connect(this.analyser);

        this.silenceThreshold = options.silenceThreshold || 30;
        this.silenceDuration = options.silenceDuration || 2000;
        this.minSpeechDuration = options.minSpeechDuration || 500;

        this.isSpeaking = false;
        this.lastSpeechTime = 0;
        this.speechStartTime = 0;
        this.silenceTimer = null;

        this.onSpeechStart = options.onSpeechStart || (() => {});
        this.onSpeechEnd = options.onSpeechEnd || (() => {});
        this.onSilence = options.onSilence || (() => {});
    }

    start() {
        const checkAudio = () => {
            this.analyser.getByteFrequencyData(this.dataArray);

            const sum = this.dataArray.reduce((a, b) => a + b, 0);
            const average = sum / this.dataArray.length;

            const currentTime = Date.now();

            if (average > this.silenceThreshold) {
                if (!this.isSpeaking) {
                    this.isSpeaking = true;
                    this.speechStartTime = currentTime;
                    this.onSpeechStart();

                    if (this.silenceTimer) {
                        clearTimeout(this.silenceTimer);
                        this.silenceTimer = null;
                    }
                }
                this.lastSpeechTime = currentTime;
            } else {
                if (this.isSpeaking && currentTime - this.lastSpeechTime > this.silenceDuration) {
                    const speechDuration = this.lastSpeechTime - this.speechStartTime;

                    if (speechDuration > this.minSpeechDuration) {
                        this.isSpeaking = false;
                        this.onSpeechEnd();

                        this.silenceTimer = setTimeout(() => {
                            this.onSilence();
                        }, 100);
                    } else {
                        this.isSpeaking = false;
                    }
                }
            }

            if (!this.stopped) {
                requestAnimationFrame(checkAudio);
            }
        };

        this.stopped = false;
        checkAudio();
    }

    stop() {
        this.stopped = true;
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}

export class AudioPlayer {
    constructor() {
        this.audio = null;
        this.isPlaying = false;
    }

    async playFromUrl(audioUrl) {
        return new Promise((resolve, reject) => {
            this.audio = new Audio(audioUrl);
            this.isPlaying = true;

            this.audio.onended = () => {
                this.isPlaying = false;
                resolve();
            };

            this.audio.onerror = (error) => {
                this.isPlaying = false;
                reject(error);
            };

            this.audio.play().catch(reject);
        });
    }

    async playFromBlob(audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        try {
            await this.playFromUrl(audioUrl);
        } finally {
            URL.revokeObjectURL(audioUrl);
        }
    }

    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isPlaying = false;
        }
    }

    setVolume(volume) {
        if (this.audio) {
            this.audio.volume = Math.max(0, Math.min(1, volume));
        }
    }
}

export async function convertBlobToWav(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    const channelData = audioBuffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
        view.setInt16(offset, channelData[i] * 0x7fff, true);
        offset += 2;
    }

    await audioContext.close();
    return new Blob([buffer], { type: 'audio/wav' });
}