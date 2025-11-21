// --- src/js/conversational-app.js ---
import { Conversation } from '@elevenlabs/client';

let conversation = null;
let isConnected = false;
let transcript = [];
let isTranscriptOpen = false;

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

    // Initialize transcript functionality
    initializeTranscript();

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
        const response = await fetch('/voice-assistant/api/signed-url');
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
        const response = await fetch('/voice-assistant/api/agent-id');
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
                addToTranscript(message);
            },

            onUserSpeech: (userInput) => {
                console.log('User speech captured:', userInput);
                addToTranscript({
                    type: 'user',
                    content: userInput.text || userInput.transcript || userInput,
                    source: 'user'
                });
            },

            onUserTranscript: (transcript) => {
                console.log('User transcript captured:', transcript);
                addToTranscript({
                    type: 'user',
                    content: transcript,
                    source: 'user'
                });
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

// Transcript functionality
function initializeTranscript() {
    const toggleTranscript = document.getElementById('toggleTranscript');
    const transcriptToggleFab = document.getElementById('transcriptToggleFab');
    const clearTranscript = document.getElementById('clearTranscript');
    const exportTranscript = document.getElementById('exportTranscript');

    if (toggleTranscript) {
        toggleTranscript.addEventListener('click', () => toggleTranscriptPanel());
    }
    if (transcriptToggleFab) {
        transcriptToggleFab.addEventListener('click', () => toggleTranscriptPanel());
    }
    if (clearTranscript) {
        clearTranscript.addEventListener('click', () => clearTranscriptData());
    }
    if (exportTranscript) {
        exportTranscript.addEventListener('click', () => exportTranscriptData());
    }
}

function toggleTranscriptPanel() {
    const panel = document.getElementById('transcriptPanel');
    const fab = document.getElementById('transcriptToggleFab');
    
    if (panel) {
        isTranscriptOpen = !isTranscriptOpen;
        panel.classList.toggle('open', isTranscriptOpen);
        if (fab) {
            fab.classList.toggle('hidden', isTranscriptOpen);
        }
    }
}

function addToTranscript(message) {
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    
    // Log the message for debugging
    console.log('Adding to transcript:', message);
    
    // Determine message type and content with improved detection
    let messageData = {
        timestamp,
        type: 'assistant', // default
        content: message.message || message.text || message.content || 'Message received'
    };

    // Enhanced detection for user messages
    if (
        message.type === 'user_transcript' || 
        message.type === 'user' ||
        message.type === 'user_speech' ||
        message.source === 'user' ||
        message.role === 'user' ||
        message.speaker === 'user' ||
        message.from === 'user' ||
        message.kind === 'user_speech' ||
        message.kind === 'user_transcript' ||
        (message.hasOwnProperty('user_transcript') && message.user_transcript) ||
        (message.hasOwnProperty('transcript') && message.transcript && !message.agent_response) ||
        (message.hasOwnProperty('user_message') && message.user_message) ||
        // ElevenLabs specific message types
        (message.hasOwnProperty('is_user') && message.is_user) ||
        (message.hasOwnProperty('isUser') && message.isUser)
    ) {
        messageData.type = 'user';
        messageData.content = message.user_transcript || message.user_message || message.transcript || message.content || message.text || message.message || 'User spoke';
    } 
    // Enhanced detection for agent messages
    else if (
        message.type === 'agent_response' || 
        message.type === 'agent' ||
        message.type === 'assistant' ||
        message.source === 'agent' ||
        message.source === 'assistant' ||
        message.role === 'assistant' ||
        message.speaker === 'agent' ||
        message.from === 'agent' ||
        message.hasOwnProperty('agent_response')
    ) {
        messageData.type = 'assistant';
        messageData.content = message.agent_response || message.message || message.content || message.text || 'Agent responded';
    }

    transcript.push(messageData);
    updateTranscriptDisplay();
}

function updateTranscriptDisplay() {
    const transcriptContent = document.getElementById('transcriptContent');
    if (!transcriptContent) return;

    // Remove placeholder if exists
    const placeholder = transcriptContent.querySelector('.transcript-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    // Clear and rebuild
    transcriptContent.innerHTML = '';

    transcript.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = `transcript-message ${message.type}`;
        
        messageElement.innerHTML = `
            <div class="transcript-message-header">
                <span>${message.type === 'user' ? 'You' : 'Assistant'}</span>
                <span>${message.timestamp}</span>
            </div>
            <div class="transcript-message-content">${message.content}</div>
        `;
        
        transcriptContent.appendChild(messageElement);
    });

    // Auto-scroll to bottom
    transcriptContent.scrollTop = transcriptContent.scrollHeight;
}

function clearTranscriptData() {
    if (confirm('Are you sure you want to clear the transcript?')) {
        transcript = [];
        const transcriptContent = document.getElementById('transcriptContent');
        if (transcriptContent) {
            transcriptContent.innerHTML = `
                <div class="transcript-placeholder">
                    <p>Start a conversation to see the transcript here.</p>
                </div>
            `;
        }
    }
}

function exportTranscriptData() {
    if (transcript.length === 0) {
        alert('No transcript data to export.');
        return;
    }

    // Create formatted text
    let exportText = 'ElevenLabs Conversational AI Transcript\n';
    exportText += '=====================================\n\n';
    
    transcript.forEach(message => {
        exportText += `[${message.timestamp}] ${message.type === 'user' ? 'You' : 'Assistant'}:\n`;
        exportText += `${message.content}\n\n`;
    });

    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
