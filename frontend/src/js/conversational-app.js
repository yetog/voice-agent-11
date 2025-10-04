// --- src/js/conversational-app.js ---
import { Conversation } from '@elevenlabs/client';

let conversation = null;
let isConnected = false;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    const startButton = document.getElementById('startButton');
    const endButton = document.getElementById('endButton');

    if (startButton) {
        startButton.addEventListener('click', startConversation);
    }
    if (endButton) {
        endButton.addEventListener('click', endConversation);
    }

    // Update initial status
    updateStatus(false);
    updateSpeakingStatus({ mode: 'listening' });
}

async function requestMicrophonePermission() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        return false;
    }
}

async function getSignedUrl() {
    try {
        const response = await fetch('/api/signed-url');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get signed URL');
        }
        const data = await response.json();
        return data.signedUrl;
    } catch (error) {
        console.error('Error getting signed URL:', error);
        throw error;
    }
}

async function getAgentId() {
    try {
        const response = await fetch('/api/agent-id');
        const { agentId } = await response.json();
        return agentId;
    } catch (error) {
        console.error('Error getting agent ID:', error);
        throw error;
    }
}

function updateStatus(connected) {
    isConnected = connected;
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = connected ? 'Connected' : 'Disconnected';
        statusElement.classList.toggle('connected', connected);
    }

    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (statusDot && statusText) {
        if (connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Disconnected';
        }
    }
}

function updateSpeakingStatus(modeData) {
    const statusElement = document.getElementById('speakingStatus');
    const voiceCircle = document.getElementById('voiceCircle');

    const isSpeaking = modeData.mode === 'speaking';

    if (statusElement) {
        statusElement.textContent = isSpeaking ? 'Agent Speaking' : 'Agent Listening';
        statusElement.classList.toggle('speaking', isSpeaking);
    }

    if (voiceCircle) {
        if (isSpeaking) {
            voiceCircle.classList.add('speaking');
            voiceCircle.classList.remove('listening');
        } else {
            voiceCircle.classList.add('listening');
            voiceCircle.classList.remove('speaking');
        }
    }

    console.log('Mode changed:', modeData);
}

function showLoadingState(show, message = 'Connecting...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    if (loadingText) {
        loadingText.textContent = message;
    }
}

function showError(message) {
    const errorToast = document.getElementById('errorToast');
    const errorMessage = document.getElementById('errorMessage');

    if (errorMessage) {
        errorMessage.textContent = message;
    }
    if (errorToast) {
        errorToast.classList.add('show');
        setTimeout(() => {
            errorToast.classList.remove('show');
        }, 5000);
    }

    console.error('Error:', message);
}

async function startConversation() {
    const startButton = document.getElementById('startButton');
    const endButton = document.getElementById('endButton');

    try {
        showLoadingState(true, 'Requesting microphone access...');

        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
            showError('Microphone permission is required for the conversation.');
            showLoadingState(false);
            return;
        }

        showLoadingState(true, 'Connecting to ElevenLabs...');

        const signedUrl = await getSignedUrl();
        // Alternatively, you can use agentId for public agents:
        // const agentId = await getAgentId();

        console.log('Starting conversation with signed URL...');

        conversation = await Conversation.startSession({
            signedUrl: signedUrl,
            // agentId: agentId, // Use this for public agents instead of signedUrl

            onConnect: () => {
                console.log('Connected to ElevenLabs Conversational AI');
                updateStatus(true);
                if (startButton) startButton.disabled = true;
                if (endButton) endButton.disabled = false;
                showLoadingState(false);
            },

            onDisconnect: () => {
                console.log('Disconnected from ElevenLabs');
                updateStatus(false);
                if (startButton) startButton.disabled = false;
                if (endButton) endButton.disabled = true;
                updateSpeakingStatus({ mode: 'listening' });
            },

            onError: (error) => {
                console.error('Conversation error:', error);
                showError(`An error occurred: ${error.message || 'Unknown error'}`);
                showLoadingState(false);
            },

            onModeChange: (mode) => {
                console.log('Mode changed:', mode);
                updateSpeakingStatus(mode);
            },

            onMessage: (message) => {
                console.log('Message received:', message);
                // You can add transcript display here if needed
            }
        });

    } catch (error) {
        console.error('Error starting conversation:', error);
        showError(`Failed to start conversation: ${error.message}`);
        showLoadingState(false);
        if (startButton) startButton.disabled = false;
        if (endButton) endButton.disabled = true;
    }
}

async function endConversation() {
    const startButton = document.getElementById('startButton');
    const endButton = document.getElementById('endButton');

    try {
        if (conversation) {
            showLoadingState(true, 'Ending conversation...');
            await conversation.endSession();
            conversation = null;
            showLoadingState(false);
        }
    } catch (error) {
        console.error('Error ending conversation:', error);
        showError('Failed to end conversation properly');
        showLoadingState(false);
        // Still reset the UI
        updateStatus(false);
        if (startButton) startButton.disabled = false;
        if (endButton) endButton.disabled = true;
    }
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (conversation) {
        conversation.endSession();
    }
});

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
});
