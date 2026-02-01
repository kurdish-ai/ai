const BACKEND_URL = 'http://localhost:3000/api/chat';

const firebaseConfig = {
    apiKey: "AIzaSyDoTAMAuFm8h9RFWk_C4BnqtwEis-RGor4",
    authDomain: "ai-kurdy.firebaseapp.com",
    projectId: "ai-kurdy",
    storageBucket: "ai-kurdy.firebasestorage.app",
    messagingSenderId: "1071066507145",
    appId: "1:1071066507145:web:46e894ecfab03cecf52358"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const messageArea = document.getElementById('message-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const imageUploadInput = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageButton = document.getElementById('remove-image-button');
const uploadButton = document.getElementById('upload-button');

let currentImageBase64 = null; 
let currentImageMime = null;
let chatHistory = []; 

function addMessage(role, text, imageUrl = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`; 
    
    const iconLabel = role === 'ai' ? '🤖' : 'ت';
    
    let contentHtml = text;
    if (imageUrl) {
        contentHtml = `<img src="${imageUrl}" class="message-image" />` + contentHtml;
    }

    contentHtml = contentHtml.replace(/\n/g, '<br>');

    messageDiv.innerHTML = `
        <div class="icon">${iconLabel}</div>
        <div class="${role === 'ai' ? 'ai-bubble-content' : 'text-content'}">
            ${contentHtml}
        </div>
    `;
    
    messageArea.appendChild(messageDiv);
    messageArea.scrollTop = messageArea.scrollHeight; 
}

function addLoadingBubble() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai loading-message'; 
    loadingDiv.id = 'loading-indicator';
    
    loadingDiv.innerHTML = `
        <div class="icon">🤖</div>
        <div class="loading-bubble-chat">
            <div class="pulsating-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
    `;
    
    messageArea.appendChild(loadingDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function removeLoadingBubble() {
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

async function sendMessage() {
    const text = userInput.value.trim();
    
    if (!text && !currentImageBase64) return;

    const displayImage = currentImageBase64 ? `data:${currentImageMime};base64,${currentImageBase64}` : null;
    addMessage('user', text, displayImage);
    
    const userParts = [];
    if (text) userParts.push({ text: text });
    if (currentImageBase64) {
        userParts.push({
            inline_data: {
                mime_type: currentImageMime,
                data: currentImageBase64
            }
        });
    }

    chatHistory.push({ role: "user", parts: userParts });

    userInput.value = '';
    imagePreviewContainer.style.display = 'none';
    currentImageBase64 = null;
    currentImageMime = null;
    imageUploadInput.value = '';

    addLoadingBubble();

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: chatHistory 
            })
        });

        const data = await response.json();
        
        removeLoadingBubble();

        if (data.error) {
             addMessage('ai', "Error: " + JSON.stringify(data.error));
        } else if (data.candidates && data.candidates[0].content) {
            const aiText = data.candidates[0].content.parts[0].text;
            
            chatHistory.push({ role: "model", parts: [{ text: aiText }] });
            
            addMessage('ai', aiText);
        } else {
            addMessage('ai', "ببورە، وەڵامێکی نادیار هات.");
        }

    } catch (error) {
        console.error(error);
        removeLoadingBubble();
        addMessage('ai', "ببورە، کێشەیەک لە پەیوەندی دروست بوو لەگەڵ سێرڤەر.");
    }
}

uploadButton.addEventListener('click', () => imageUploadInput.click());

imageUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        imagePreview.src = event.target.result;
        imagePreviewContainer.style.display = 'flex';
        currentImageMime = file.type;
        currentImageBase64 = event.target.result.split(',')[1]; 
    };
    reader.readAsDataURL(file);
});

removeImageButton.addEventListener('click', () => {
    imageUploadInput.value = '';
    imagePreviewContainer.style.display = 'none';
    currentImageBase64 = null;
    currentImageMime = null;
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        document.getElementById('user-id-display').innerText = 
            user.isAnonymous ? "ناسنامەی بەکارهێنەر: بێناو" : `ناسنامەی بەکارهێنەر: ${user.displayName || user.email}`;
            
        if (messageArea.children.length === 0) {
            addMessage('ai', "بەخێربێیت! من زیرەکی دەستکردی کوردی 🤖، چۆن دەتوانم یارمەتیت بدەم؟");
        }
    } else {
        authContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
        chatHistory = []; 
    }
});

document.getElementById('google-login-btn').addEventListener('click', () => {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(err => document.getElementById('auth-error').innerText = err.message);
});

document.getElementById('anonymous-login-btn').addEventListener('click', () => {
    signInAnonymously(auth).catch(err => document.getElementById('auth-error').innerText = err.message);
});

document.getElementById('logout-button').addEventListener('click', () => {
    signOut(auth).then(() => location.reload());
});

document.getElementById('new-chat-button').addEventListener('click', () => { 
    messageArea.innerHTML = ''; 
    chatHistory = []; 
    addMessage('ai', "چاتی نوێ دەستی پێکرد. فەرموو!");
});

sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => { 
    if(e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
    } 
});

document.getElementById('mode-toggle-button').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});