// ------------------ IMAGE ASSETS (Google "G" Logo SVG) ------------------
const defaultGoogleLogoSvg = `
    <svg class="google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3">
        <path fill="#4285f4" d="M533.5 272.2c0-18.7-1.4-37.1-4.7-55H272.2v104.9h148.4c-6.2 33.7-25.5 63.8-53.1 82.3v68.1h87.7c51.5-47.5 81.6-118.1 81.6-200.3z"/>
        <path fill="#34a853" d="M272.2 544.3c73.7 0 135.5-24.5 180.6-66.8l-87.7-68.1c-24.6 16.5-56.1 26.6-92.9 26.6-71.1 0-131.2-48.4-153-113.8H20v68.1c44.8 88 136.2 149.8 252.2 149.8z"/>
        <path fill="#fbbc05" d="M119.2 328.7c-5.1-15.4-7.9-32.3-7.9-49.8s2.8-34.4 7.9-49.8V161H20c-15.6 31.8-24.3 67.4-24.3 107.9s8.7 76.1 24.3 107.9h99.2z"/>
        <path fill="#ea4335" d="M272.2 107.9c40.3 0 76.5 13.8 105 40.7l77.7-77.7C407.2 24.5 345.4 0 272.2 0 156.2 0 64.8 61.8 20 149.8l99.2 68.1c21.8-65.4 81.9-113.8 153-113.8z"/>
    </svg>
`;
const emptyLogoHtml = defaultGoogleLogoSvg; 

// ------------------ FIREBASE CONFIGURATION (Mock values used if environment variables aren't defined) ------------------
const userFirebaseConfig = {
    apiKey: "AIzaSyDoTAMAuFm8h9RFWk_C4BnqtwEis-RGor4",
    authDomain: "ai-kurdy.firebaseapp.com",
    projectId: "ai-kurdy",
    storageBucket: "ai-kurdy.firebasestorage.app",
    messagingSenderId: "1071066507145",
    appId: "1:1071066507145:web:46e894ecfab03cecf52358",
    measurementId: "G-044ZEW6C0G"
};

// ------------------ FIREBASE IMPORTS ------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    linkWithPopup, 
    signInWithCredential,
    fetchSignInMethodsForEmail 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, addDoc, where, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ------------------ GLOBAL VARIABLES FROM ENVIRONMENT ------------------
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-ai-kurdy-app-id'; 
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 

let app, auth, db;
let userId = null;

// State for Image Upload
let currentImageBase64 = null;
let currentImageMimeType = null;

// --- API & SIZE CONSTANTS ---
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for single image file
const MAX_PAYLOAD_SIZE_BYTES = 7 * 1024 * 1024; // Setting a conservative 7MB limit for the entire JSON payload

// --- GEMINI MODEL CONSTANTS (FIXED FOR MULTIPLE TASKS) ---
const GEMINI_CHAT_MODEL = "gemini-2.5-flash"; 
const GEMINI_MULTIMODAL_MODEL = "gemini-2.5-flash-image-preview"; // Multimodal Analysis/Editing
const GEMINI_IMAGE_GEN_MODEL = "imagen-3.0-generate-002"; 

// ** IMPORTANT: GEMINI API KEY DEFINITION **
const geminiApiKey = "AIzaSyC8Th7GK_MNcOKqayrnpKe7jgA-WrvJBGI"; // <--- REPLACE "" WITH YOUR ACTUAL GEMINI API KEY IF NOT USING CANVAS

// --- WELCOME MESSAGE ---
const WELCOME_MESSAGE_TEXT = 'بەخێربێیت! من زیرەکی دەستکردی کوردیم، چۆن دەتوانم یارمەتیت بدەم؟';
// -----------------------

// System Instruction for standard chat (uses GEMINI_CHAT_MODEL)
const CHAT_SYSTEM_INSTRUCTION = "You are a helpful, conversational AI assistant. Your primary function is to communicate effectively in the user's language. If the user writes in Sorani Kurdish, respond in fluent Sorani Kurdish. If they write in another language, respond in that language. You can analyze images provided by the user and respond to image-related commands (e.g., describe, identify) with text. Maintain a polite, supportive, and knowledgeable tone.";

// System Instruction for image tasks (uses GEMINI_MULTIMODAL_MODEL)
const IMAGE_TASK_SYSTEM_INSTRUCTION = "You are an AI specialized in analyzing images. If the user provides an image and a request (editing, analysis), process it. Your response MUST be text-only, describing or analyzing the image based on the prompt. If the request is for pure image creation (text-to-image), you should advise the user to simply use the text prompt and ensure no image is uploaded. Avoid greetings.";

// ------------------ UI ELEMENTS ------------------
const chatContainer = document.getElementById('chat-container');
const authContainer = document.getElementById('auth-container');
const messageArea = document.getElementById('message-area');
const inputField = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const userIdDisplay = document.getElementById('user-id-display');
const loadHistoryButton = document.getElementById('load-history-button');
const newChatButton = document.getElementById('new-chat-button');
const logoutButton = document.getElementById('logout-button');
const upgradeButton = document.getElementById('upgrade-button');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageButton = document.getElementById('remove-image-button');
const modeToggleBtn = document.getElementById('mode-toggle-button');

// ------------------ CORE UTILITY FUNCTIONS ------------------

/**
 * Calculates the byte size of a string.
 */
function getByteSize(str) {
    // New TextEncoder is the most accurate way to get byte size for API limits
    return new TextEncoder().encode(str).length; 
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function pcmToWav(pcm16, sampleRate = 24000) {
    const numChannels = 1;
    const bytesPerSample = 2; 
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataLength = pcm16.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataLength);
    const dataView = new DataView(buffer);

    // RIFF chunk
    writeString(dataView, 0, 'RIFF');
    dataView.setUint32(4, 36 + dataLength, true); 
    writeString(dataView, 8, 'WAVE');

    // FMT sub-chunk
    writeString(dataView, 12, 'fmt ');
    dataView.setUint32(16, 16, true);  
    dataView.setUint16(20, 1, true);    
    dataView.setUint16(22, numChannels, true);
    dataView.setUint32(24, sampleRate, true);
    dataView.setUint32(28, byteRate, true);
    dataView.setUint16(32, blockAlign, true);
    dataView.setUint16(34, 16, true);  

    // Data sub-chunk
    writeString(dataView, 36, 'data');
    dataView.setUint32(40, dataLength, true);

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < pcm16.length; i++, offset += 2) {
        dataView.setInt16(offset, pcm16[i], true); 
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Dynamically adjusts the height of the input textarea based on its content.
 */
function autoResizeInput() {
    inputField.style.height = 'auto'; 
    inputField.style.height = inputField.scrollHeight + 'px';
}


// Custom function to replace alert()
function alertMessage(title, message, type = 'info') {
    const existingAlert = document.getElementById('custom-alert');
    if (existingAlert) existingAlert.remove();

    const alertDiv = document.createElement('div');
    alertDiv.id = 'custom-alert';
    alertDiv.className = 'custom-alert';
    
    // Set the class on the alert-content div to apply button styling
    const contentClass = `alert-content ${type}`; 
    
    alertDiv.innerHTML = `
        <div class="${contentClass}">
            <div class="alert-title ${type}">${title}</div>
            <p>${message}</p>
            <button onclick="document.getElementById('custom-alert').remove()">باشە</button>
        </div>
    `;
    document.body.appendChild(alertDiv);
}

/**
 * Checks if the prompt indicates an intention to generate a new image.
 */
function isImageGenerationPrompt(prompt) {
    // Combined keywords for image generation in Kurdish, English, and Arabic
    const keywords = [
        'generate image', 'create image', 'draw image', 'make an image', 
        'create an', 'draw an', 'ai art', 'image generation', 'nano banana', 'generate a',
        
        'دروستکردنی وێنە', 'وێنە دروست بکە', 'کێشانی وێنە', 'وێنەیەک بکێشە', 
        'دروستکردن', 'کێشان', 'گرافیک دروست بکە', 'بۆم بکێشە', 'وێنە', 'وێنەیەک',
        
        'انشاء صورة', 'توليد صورة', 'ارسم لي', 'صمم لي', 'إنشاء', 'رسم', 
        'صورة بالذكاء الاصطناعي', 'اعمل صورة',
    ];
    const lowerPrompt = prompt.toLowerCase();
    return keywords.some(k => lowerPrompt.includes(k));
}


// ------------------ IMAGE UPLOAD LOGIC ------------------

imageUpload.addEventListener('change', handleImageUpload);
removeImageButton.addEventListener('click', removeImage);

/**
 * Converts uploaded file to Base64 and updates preview, with size check.
 */
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alertMessage('هەڵەی وێنە', 'تەنها دەتوانیت فایلی وێنە (وەکوو PNG, JPEG) بار بکەیت.', 'error');
        imageUpload.value = '';
        return;
    }
    
    // Check file size (Guardrail for 400 errors due to large payloads)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        alertMessage('هەڵەی قەبارە', 'قەبارەی وێنەکە نابێت لە ٥ مێگابایت تێپەڕێت.', 'error');
        imageUpload.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        // e.target.result is the Base64 data URL
        const base64Data = e.target.result;
        
        // Store Base64 data (remove prefix for API payload)
        const parts = base64Data.split(',');
        currentImageBase64 = parts.length > 1 ? parts[1] : base64Data;
        currentImageMimeType = file.type;

        // Update UI preview
        imagePreview.src = base64Data;
        imagePreviewContainer.style.display = 'flex';
        
        // Clear file input to allow uploading the same file again if needed
        imageUpload.value = '';
        
        // Focus on input to write the prompt
        inputField.focus(); 
    };
    reader.readAsDataURL(file);
}

/**
 * Clears the current image state and hides the preview.
 */
function removeImage() {
    currentImageBase64 = null;
    currentImageMimeType = null;
    imagePreview.src = '';
    imagePreviewContainer.style.display = 'none';
}

// ------------------ LLM TTS FEATURE ------------------

window.playTTS = async (text, ttsButton) => {
    // Check for API Key
    if (!geminiApiKey || geminiApiKey.length < 30) {
        alertMessage('هەڵەی کلیل', 'پێویستە کلیلی (API Key) جێمینی بەکار بهێنیت بۆ دەنگ (TTS).', 'error');
        return;
    }

    const originalIcon = ttsButton.innerHTML;
    ttsButton.innerHTML = '<i class="material-icons rotating-icon">sync</i> loading...';
    ttsButton.disabled = true;

    const voiceName = "en-US-Standard-H"; 

    const payload = {
        contents: [{
            parts: [{ text: `Say this text, using the appropriate language and tone: ${text}` }] 
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName }
                }
            }
        },
    };
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    try {
        let response = null;
        let delay = 1000;
        for (let i = 0; i < 3; i++) {
            try {
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) break;
            } catch (e) {
                // console.warn(`TTS fetch failed (attempt ${i + 1}). Retrying in ${delay / 1000}s...`, e);
            }
            if (i < 2) await new Promise(resolve => setTimeout(resolve, delay *= 2));
        }
        
        if (!response || !response.ok) throw new Error("TTS API call failed after retries.");

        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (audioData && mimeType && mimeType.startsWith("audio/L16")) {
            const rateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
            
            const pcmDataBuffer = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmDataBuffer);
            const wavBlob = pcmToWav(pcm16, sampleRate);
            const audioUrl = URL.createObjectURL(wavBlob);
            
            const audio = new Audio(audioUrl);
            audio.play();

            audio.onended = () => {
                URL.revokeObjectURL(audioUrl); 
                ttsButton.innerHTML = originalIcon;
                ttsButton.disabled = false;
            };

            audio.onerror = (e) => {
                console.error("Audio playback error:", e);
                alertMessage('هەڵەی لێدانی دەنگ', 'ناتوانرێت دەنگەکە لێبدرێت. ڕەنگە فۆرماتەکە کێشەی هەبێت.', 'error');
                ttsButton.innerHTML = originalIcon;
                ttsButton.disabled = false;
            };
            
        } else {
            console.error("Invalid TTS response structure or missing audio data.", result);
            alertMessage('هەڵەی دەنگ', 'هیچ دەنگێک نەدۆزرایەوە یان فۆرماتەکە هەڵەیە.', 'error');
        }
    } catch (error) {
        console.error("TTS generation error:", error);
        alertMessage('هەڵەی گشتی', 'کێشەیەک لە دروستکردنی دەنگەکە ڕوویدا. هۆکار: ' + error.message, 'error');
    } finally {
        if (ttsButton.disabled && ttsButton.innerHTML.includes('sync')) {
            ttsButton.innerHTML = originalIcon;
            ttsButton.disabled = false;
        }
    }
};


// ------------------ FIREBASE INITIALIZATION & AUTH ------------------
function initializeFirebase() {
    if (!firebaseConfig.apiKey) {
        console.error("Firebase config is missing or incomplete. Authentication will not work.");
        document.getElementById('auth-error').textContent = "هەڵە: ڕێکخستنەکانی فایەربەیس نادروستن.";
        return;
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Start the auth flow
    handleInitialAuth();
}

/**
 * Handles initial sign-in: either with the custom environment token 
 * or automatically falls back to anonymous sign-in for external hosting (like GitHub Pages).
 */
async function handleInitialAuth() {
    // Set up the listener immediately. It will handle the UI switch.
    setupAuthListener();

    // 1. Try to sign in with the Canvas environment's custom token (if available)
    if (initialAuthToken) {
        try {
            console.log("Attempting sign-in with custom token...");
            await signInWithCustomToken(auth, initialAuthToken);
            return; // Authentication successful, stop here.
        } catch (error) {
            console.error("Custom token sign-in failed:", error);
            // If custom token fails, proceed to anonymous sign-in fallback.
        }
    }
    
    // 2. Fallback: If no custom token or sign-in failed, attempt anonymous sign-in.
    try {
        console.log("Custom token missing or failed. Attempting anonymous sign-in fallback...");
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Automatic anonymous sign-in failed:", error);
        // The auth listener will be notified of the failed state, leaving the choice screen visible.
    }
}

// ------------------ AUTHENTICATION METHODS ------------------

window.logout = async () => {
    try {
        window.chatHistory = [];
        messageArea.innerHTML = '';
        removeImage();
        await signOut(auth);
        alertMessage('چوونەدەرەوە سەرکەوتوو بوو', 'بە سەرکەوتوویی لە هەژمارەکەت چوویتە دەرەوە. دەتوانیت دوبارە بچیتە ژوورەوە یان وەک بێناو بەردەوام بیت.', 'info');
    } catch (error) {
        console.error("Logout failed:", error);
        alertMessage('هەڵەی چوونەدەرەوە', `نەتوانرا لە هەژمارەکە بچیتە دەرەوە: ${error.message}`, 'error');
    }
};

/**
 * Handles Google Sign-In (Log In) and Sign-Up (Registration).
 * FIX: Added logout of anonymous user before sign-in to prevent 'credential-already-in-use' errors 
 * when the Google account is already registered elsewhere.
 */
window.signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    
    // FIX: Log out the current anonymous user to force a clean sign-in and avoid linking conflicts
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        await signOut(auth);
        console.log("Logged out anonymous user to proceed with Google Sign-In.");
    }
    
    try {
        const result = await signInWithPopup(auth, provider); 
        
        // Check if the user is new (Sign Up) or existing (Sign In)
        const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;

        if (isNewUser) {
            alertMessage('چوونەژوورەوە و تۆمارکردن سەرکەوتوو بوو', 'بەخێربێیت بۆ ئیئایی کوردی! هەژماری نوێت دروستکرا و چوویتە ژوورەوە. ئێستا دەتوانیت مێژووی چات پاشەکەوت بکەیت.', 'info');
        } else {
            alertMessage('چوونەژوورەوە سەرکەوتوو بوو', 'بە سەرکەوتوویی چوویتە ژوورەوە. بەردەوام بە لە چاتکردن!', 'info');
        }

    } catch (error) {
        
        // This 'credential-already-in-use' should now only fire if there was a race condition 
        // or if a non-anonymous user tried to sign in with a conflicting method (which is rare).
        if (error.code === 'auth/credential-already-in-use' && error.credential) {
            
            const credential = error.credential;
            
            try {
                // Attempt to sign in directly with the conflicting credential (switching to the old account)
                const result = await signInWithCredential(auth, credential);

                // If successful, they are now signed into the pre-existing account
                alertMessage('چوونەژوورەوە سەرکەوتوو بوو', `ئەم ئەکاونتەی گووگڵ پێشتر بەستراوەتەوە بە هەژمارێکی تر. ئێستا بە سەرکەوتوویی چوویتە ژوورەوە بۆ هەژماری (${result.user.email}).`, 'info');

            } catch(e) {
                console.error("Failed to sign in with conflicting credential:", e);
                alertMessage('هەڵەی چوونەژوورەوە', `هەڵەی چوونەژوورەوەی گووگڵ: ئەم ئەکاونتە بەستراوەتەوە بە ڕێگایەکی تری چوونەژوورەوە و نەتوانرا بگۆڕدرێت. تکایە بە ڕێگای کۆنەکە بچۆرە ژوورەوە.`, 'error');
            }

        } else {
            console.error("Google Sign-In failed:", error);
            alertMessage('هەڵەی چوونەژوورەوە', `هەڵەی چوونەژوورەوەی گووگڵ: ${error.message}`, 'error');
        }
    }
};

window.signInAnonymouslyUser = async () => {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Anonymous Sign-In failed:", error);
        alertMessage('هەڵەی چوونەژوورەوە', `هەڵەی چوونەژوورەوەی بێناو: ${error.message}`, 'error');
    }
};

/**
 * Upgrades an anonymous user to a Google account.
 * Note: This function is primarily used when the user *wants* to keep their anonymous session history
 * and link a Google account that is NOT already in use.
 */
window.upgradeToGoogle = async () => {
    if (!auth.currentUser || !auth.currentUser.isAnonymous) {
        alertMessage('هەڵە', 'تەنها بەکارهێنەرانی بێناو دەتوانن ئەکاونتیان بەرز بکەنەوە.', 'error');
        return;
    }

    try {
        const provider = new GoogleAuthProvider();
        await linkWithPopup(auth.currentUser, provider);
        alertMessage('بەستنەوە سەرکەوتوو بوو', 'هەژماری بێناوی ئێستات بە سەرکەوتوویی بەستراوەتەوە بە گووگڵ. ئێستا مێژووی چاتەکەت دەپارێزرێت!', 'info');
        
    } catch (error) {
         // Handle the 'auth/credential-already-in-use' during linking: 
        if (error.code === 'auth/credential-already-in-use' && error.credential) {
            console.error("Linking failed because credential is in use:", error);
            
            // In this linking scenario, we must tell the user to sign out and use the other account.
            alertMessage('هەڵەی بەستنەوە', 'ئەم ئەکاونتی گووگڵە پێشتر بەکار هاتووە بۆ ئەکاونتێکی تر. ناتوانرێت بە بێناویەکەی ئێستات ببەسترێتەوە. تکایە **چووە دەرەوە (Logout) و پاشان بە هەژماری گووگڵەکە راستەوخۆ بچۆرە ژوورەوە**.', 'error');
        } else {
            console.error("Account upgrade failed:", error);
            alertMessage('هەڵەی بەستنەوە', `نەتوانرا ئەکاونتی گووگڵ ببەسترێتەوە: ${error.message}`, 'error');
        }
    }
};

function isPersistentUser(user) {
    return user && !user.isAnonymous;
}

// ------------------ AUTH STATE LISTENER & UI MANAGEMENT ------------------
function setupAuthListener() {

    onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            showAuthScreen(false); 
            
            const isAnonymous = user.isAnonymous;
            const isPersistent = isPersistentUser(user);
            
            if (isPersistent && user.email) {
                userIdDisplay.textContent = `چوونەژوورەوە بە: ${user.email} (بەردەوام)`;
            } else if (isAnonymous) {
                userIdDisplay.textContent = `ناسنامەی بەکارهێنەر: ${userId} (بێناو - بێ پاشەکەوت)`;
            } else {
                userIdDisplay.textContent = `ناسنامەی بەکارهێنەر: ${userId} (بەردەوام)`;
            }

            logoutButton.style.display = 'flex'; 
            newChatButton.style.display = 'flex'; 

            if (isPersistent) {
                upgradeButton.style.display = 'none';
                loadHistoryButton.style.display = 'flex'; 
            } else { 
                upgradeButton.style.display = 'flex'; 
                loadHistoryButton.style.display = 'none'; 
            }

            setupChatSession(user);

        } else {
            // User is not authenticated, show the choice screen
            userId = null;
            userIdDisplay.textContent = 'ناسنامەی بەکارهێنەر: بێناو';
            showAuthScreen(true); 
            
            if(logoutButton) logoutButton.style.display = 'none';
            if(upgradeButton) upgradeButton.style.display = 'none';
            if(loadHistoryButton) loadHistoryButton.style.display = 'none'; 
            if(newChatButton) newChatButton.style.display = 'none';
        }
    });
}

function showAuthScreen(show) {
    authContainer.style.display = show ? 'flex' : 'none';
    chatContainer.style.display = show ? 'none' : 'flex';
}

// ------------------ FIRESTORE HISTORY LOGIC ------------------

function getChatCollectionRef() {
    const collectionName = 'chat_history';
    // Using the public path for simplicity in chat history sharing/storage
    const publicPath = `/artifacts/${appId}/public/data/${collectionName}`; 
    return collection(db, publicPath);
}

async function loadChatHistory() {
    if (!isPersistentUser(auth.currentUser) || !userId) {
        alertMessage('نەتوانرا مێژوو بار بکرێت', 'تەنها بەکارهێنەرانی بەردەوام (گووگڵ) دەتوانن مێژووی چات بار بکەن.', 'error');
        return;
    }
    
    // Temporarily disable the button
    loadHistoryButton.disabled = true;
    loadHistoryButton.innerHTML = '<i class="material-icons rotating-icon">sync</i> بارکردن...';

    try {
        const q = query(
            getChatCollectionRef(),
            where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(q);
        setupChatSession(auth.currentUser, true); 

        let chatMessages = [];
        let newChatHistory = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // NOTE: We only care about text for history, as images are not stored in Firestore due to the 1MB limit.
            if (data.timestamp && data.text && data.text !== WELCOME_MESSAGE_TEXT) {
                 chatMessages.push({ ...data, id: doc.id });
            }
        });
        
        chatMessages.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));

        chatMessages.forEach(msg => {
            // Reconstruct history without image data. Note: History is not used for image tasks.
            appendMessage(msg.role, msg.text, false, null); 
            
            const apiRole = msg.role === 'ai' ? 'model' : 'user';
            
            const parts = [{ text: msg.text }];
            newChatHistory.push({ role: apiRole, parts: parts });
        });

        window.chatHistory = newChatHistory; 

        messageArea.scrollTop = messageArea.scrollHeight;
        alertMessage('مێژوو بارکرا', `بە سەرکەوتوویی ${chatMessages.length} نامە بارکرا.`, 'info');
        
    } catch (error) {
        console.error("Error loading chat history:", error);
        alertMessage('هەڵەی بارکردن', `کێشەیەک لە بارکردنی مێژووی چاتی ڕوویدا: ${error.message}`, 'error');
    } finally {
        loadHistoryButton.disabled = false;
        loadHistoryButton.innerHTML = '<i class="material-icons">history</i> بارکردنی مێژوو';
    }
}


// ------------------ GEMINI CHAT LOGIC ------------------

function setupChatSession(user, clearUI = true) {
    
    window.chatHistory = []; 
    if (clearUI) {
        messageArea.innerHTML = '';
    }
    removeImage(); // Clear any existing image preview
    appendMessage('ai', WELCOME_MESSAGE_TEXT, false, null); // Ensure null is passed for imageUrl

    inputField.disabled = false;
    sendButton.disabled = false;
    inputField.value = '';
    autoResizeInput(); 
    inputField.focus();

    sendButton.onclick = sendMessage;
    inputField.onkeypress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            sendMessage();
        }
    };
    inputField.addEventListener('input', autoResizeInput); 

    if (db && isPersistentUser(user)) {
        loadHistoryButton.onclick = loadChatHistory; 
    }
    newChatButton.onclick = startNewChat;
}

window.startNewChat = () => {
    if (auth.currentUser) {
        setupChatSession(auth.currentUser, true); 
        alertMessage('چاتی نوێ', 'چاتێکی نوێ دەستیپێکرد. مێژووی چاتی پێشوو (ئەگەر هەبێت) لە فایەربەیس پارێزراوە.', 'info');
    }
};


/**
 * Function to create and append a new message to the chat.
 * @param {string} sender 'user' or 'ai'
 * @param {string} text The message text
 * @param {boolean} scroll Whether to scroll to the bottom
 * @param {string|null} imageUrl Optional Base64 image URL to display
 */
function appendMessage(sender, text, scroll = true, imageUrl = null) {
    
    // Allow empty text if an image is present (e.g., pure image generation)
    if (text === "" && !imageUrl) return; 
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    
    const iconHTML = sender === 'ai' ? '<div class="icon">🤖</div>' : '<div class="icon">ت</div>';
    
    const contentDiv = document.createElement('div');
    const isAiBubble = sender === 'ai';
    contentDiv.classList.add(isAiBubble ? 'ai-bubble-content' : 'text-content');
    
    // --- IMAGE DISPLAY LOGIC (FOR AI AND USER) ---
    if (imageUrl) {
         const img = document.createElement('img');
         img.src = imageUrl;
         img.alt = isAiBubble ? 'وێنەی دروستکراو' : 'وێنەی بارکراو';
         img.classList.add('message-image');
         
         // If AI, add the image first so it's above the text/TTS button
         // If User, add the image first so it's above the text.
         contentDiv.appendChild(img);
    }
    
    // Only add text node if there is actual text to display
    if (text && text.trim().length > 0) {
        const textNode = document.createElement('p');
        textNode.innerHTML = text;
        contentDiv.appendChild(textNode);
    }
    // ---------------------------------------------
    

    if (isAiBubble) {
        // TTS button should only show for AI text, and only if there's actual text content
        const shouldShowTTS = text.trim().length > 0 && text !== WELCOME_MESSAGE_TEXT; 
        
        // Add TTS button
        if (shouldShowTTS) {
            const ttsButton = document.createElement('button');
            ttsButton.classList.add('tts-button');
            ttsButton.innerHTML = '<i class="material-icons">volume_up</i> ✨گوێگرتن';
            ttsButton.title = 'گوێگرتن بە دەنگی جێمینی';

            // Ensure text passed to TTS function is clean
            ttsButton.onclick = () => window.playTTS(text.replace(/<[^>]*>?/gm, ''), ttsButton);
            
            contentDiv.appendChild(ttsButton);
        }

        messageDiv.innerHTML = iconHTML;
        messageDiv.appendChild(contentDiv);
        messageDiv.style.alignSelf = 'flex-start'; 
        
    } else {
         // For user messages, the contentDiv is 'text-content'
         messageDiv.innerHTML = contentDiv.outerHTML + iconHTML;
         messageDiv.style.flexDirection = 'row-reverse';
         messageDiv.style.alignSelf = 'flex-end';
    }
    
    messageArea.appendChild(messageDiv);
    if (scroll) {
        messageArea.scrollTop = messageArea.scrollHeight;
    }
    return messageDiv; // Return the full message div
}

/**
 * Creates and appends the inline loading bubble.
 * @param {string} statusText The text to display (e.g., "دروستکردنی وێنە...")
 * @param {boolean} isImageGen If true, use the dark, minimal style with dots.
 * @returns {HTMLElement} The created message div element.
 */
function appendLoadingBubble(statusText, isImageGen = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'ai');
    messageDiv.style.alignSelf = 'flex-start'; 

    const iconHTML = '<div class="icon">🤖</div>';
    const contentDiv = document.createElement('div');

    const dotsHTML = `
        <div class="pulsating-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    
    let contentHTML = '';

    if (isImageGen) {
        // Use the dark style for image generation/editing
        contentDiv.classList.add('loading-bubble-image-gen');
        contentHTML = `${statusText} ${dotsHTML}`;
    } else {
        // Standard Chat/Analysis Style with Pulsating Dots (light background)
        contentDiv.classList.add('loading-bubble-chat');
        contentHTML = `${statusText} ${dotsHTML}`;
    }

    contentDiv.innerHTML = contentHTML;

    messageDiv.innerHTML = iconHTML;
    messageDiv.appendChild(contentDiv);
    
    messageArea.appendChild(messageDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
    
    return messageDiv; // Return the full message div for later removal
}

async function sendMessage() {
    const prompt = inputField.value.trim();
    const hasImage = !!currentImageBase64;
    
    if (prompt === "" && !hasImage) return; 
    
    // --- CRITICAL API KEY CHECK ---
    if (!geminiApiKey || geminiApiKey.length < 30) {
         alertMessage('هەڵەی کلیل', 'تکایە کلیلی (API Key) جێمینی زیاد بکە بۆ بەردەوامبوون لە چات/دروستکردنی وێنە.', 'error');
         inputField.disabled = false; // Re-enable input if key is missing
         sendButton.disabled = false;
         return;
    }

    const isPersistent = isPersistentUser(auth.currentUser);
    
    // --- REFINED MODEL SELECTION LOGIC ---
    // If user explicitly asks for image generation AND has NOT uploaded an image, it's a Text-to-Image task.
    const isTextToImageTask = isImageGenerationPrompt(prompt) && !hasImage;
    // If user HAS uploaded an image, it's a Multimodal Analysis/Editing task.
    const isMultimodalTask = hasImage; 
    
    let model = GEMINI_CHAT_MODEL;
    let apiEndpoint = 'generateContent'; // Default for chat and multimodal
    
    if (isTextToImageTask) {
        // Task 1: Pure Image Generation (Text -> Image)
        model = GEMINI_IMAGE_GEN_MODEL; // **imagen-3.0-generate-002**
        apiEndpoint = 'generateImages'; 
    } else if (isMultimodalTask) {
        // Task 2: Multimodal (Image Analysis or Image Editing)
        model = GEMINI_MULTIMODAL_MODEL; // gemini-2.5-flash-image-preview
    }
    // ------------------------------------------

    // 1. Construct user message parts
    const userParts = [{ text: prompt }];
    let imageSourceUrl = null;

    if (hasImage) {
        imageSourceUrl = `data:${currentImageMimeType};base64,${currentImageBase64}`;
        userParts.push({
            inlineData: {
                mimeType: currentImageMimeType,
                data: currentImageBase64
            }
        });
    }
    
    // 2. Add user message to the UI
    appendMessage('user', prompt, true, imageSourceUrl);
    
    // 3. Update local history
    if (model === GEMINI_CHAT_MODEL) {
        // For chat model, maintain history. (Only text history, no image data)
        window.chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    } else {
        // For image models, clear history to force focus on the current turn.
        window.chatHistory = []; 
        // We add the current turn to a temporary history object for the API call
        window.chatHistory.push({ role: 'user', parts: userParts });
    }
    
    // 4. Clean up input/image state and disable input
    inputField.value = '';
    autoResizeInput();
    removeImage(); 
    inputField.disabled = true;
    sendButton.disabled = true;

    // --- START INLINE LOADING BUBBLE ---
    let loadingMessage = "بیرکردنەوە و دروستکردنی وەڵام...";
    
    if (isTextToImageTask) {
        loadingMessage = "دروستکردنی وێنە...";
    } else if (isMultimodalTask) {
         loadingMessage = "شیکردنەوەی وێنە...";
    }
    
    const aiLoadingElement = appendLoadingBubble(loadingMessage, isTextToImageTask || isMultimodalTask);
    // -----------------------------------
    
    // 5. SAVE USER MESSAGE TEXT TO FIRESTORE (IMAGE DATA IS OMITTED DUE TO 1MB LIMIT)
    if (userId && db && isPersistent) {
         const firestoreData = {
             userId: userId,
             role: 'user',
             text: prompt,
             timestamp: serverTimestamp()
         };
         try {
             if (firestoreData.text) {
                await addDoc(getChatCollectionRef(), firestoreData);
             }
         } catch (e) {
             console.error("Error adding user message to history (text only):", e);
         }
    }
    
    let aiResponseText = '';
    let aiResponseImage = null; // Object to store AI image data
    let aiImageSourceUrl = null; // String URL for appendMessage

    try {
        // --- PAYLOAD CONSTRUCTION ---
        let payload = {};
        let apiUrl = ''; 

        if (isTextToImageTask) {
            // --- Text-to-Image Payload (Uses the 'generateImages' endpoint) ---
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${apiEndpoint}?key=${geminiApiKey}`;
            payload = {
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: '1:1' // Can be changed
                }
            };
        } 
        else if (isMultimodalTask) {
            // --- Multimodal Payload (Uses 'generateContent' endpoint) ---
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${apiEndpoint}?key=${geminiApiKey}`;
            payload = {
                // Multimodal model only processes the current turn
                contents: [{ parts: userParts }], 
                generationConfig: {
                    responseModalities: ['TEXT'] // We only expect text analysis from the multimodal model
                },
                systemInstruction: {
                    parts: [{ text: IMAGE_TASK_SYSTEM_INSTRUCTION }] 
                }
            };
        } 
        else {
            // --- Standard Chat Payload (Uses 'generateContent' endpoint) ---
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${apiEndpoint}?key=${geminiApiKey}`;
            payload = {
                contents: window.chatHistory, 
                systemInstruction: { parts: [{ text: CHAT_SYSTEM_INSTRUCTION }] },
                tools: [{ google_search: {} }],
            };
        }
        
        // 6. Build Payload for direct fetch
        const payloadString = JSON.stringify(payload);
        const payloadSize = getByteSize(payloadString);

        // --- CRITICAL DEBUGGING STEP: Check Payload Size ---
        if (payloadSize > MAX_PAYLOAD_SIZE_BYTES) {
            alertMessage('قەبارەی زۆر زۆر', `کۆی قەبارەی نامەکان و وێنەکە (بە نزیکەیی ${Math.round(payloadSize / (1024 * 1024))} مێگابایت) لە سنووری سەرووی ${Math.round(MAX_PAYLOAD_SIZE_BYTES / (1024 * 1024))} مێگابایت تێپەڕیوە. تکایە چاتێکی نوێ دەستپێبکە (New Chat).`, 'error');
            throw new Error("Payload size exceeded limit. Aborting.");
        }

        // 7. API Fetch with Exponential Backoff
        let response = null;
        let delay = 1000;
        for (let i = 0; i < 3; i++) {
            try {
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payloadString 
                });
                if (response.ok) break;
            } catch (e) {
                // console.warn(`Gemini fetch failed (attempt ${i + 1}). Retrying in ${delay / 1000}s...`, e);
            }
            if (i < 2) await new Promise(resolve => setTimeout(resolve, delay *= 2));
        }

        if (!response || !response.ok) {
            const errorText = await response.text();
            console.error("API Response Text (for 400 error):", errorText);
            throw new Error(`HTTP error! status: ${response.status}. Details: ${errorText}.`);
        }
        const result = await response.json();
        
        
        // 8. Extract generated content (Handling Imagen/GenerateContent response format)
        
        // --- SAFETY/BLOCKED CONTENT CHECK ---
        if (result.promptFeedback?.blockReason || result.candidates?.[0]?.finishReason === 'SAFETY') {
            const safetyRatings = result.candidates?.[0]?.safetyRatings || result.promptFeedback?.safetyRatings;
            const blockReason = result.promptFeedback?.blockReason || 'SAFETY';
            let blockedMessage = `ببورە، وەڵامەکە یان پرسیارەکەت ڕاگیرا. هۆکار: ${blockReason}.`;
            
            if (safetyRatings) {
                const blockedCategory = safetyRatings.find(r => r.probability !== 'NEGLIGIBLE' && r.blocked)?.category || 'نادیار';
                blockedMessage += ` (پۆلێن: ${blockedCategory})`;
            }
            aiResponseText = blockedMessage;
            aiResponseImage = null; 
            window.chatHistory.pop(); // Remove user message if blocked
            
        } else if (isTextToImageTask) {
            // --- Handle Text-to-Image (generateImages) Response ---
            const generatedImage = result?.generatedImages?.[0]?.image;
            
            if (generatedImage) {
                aiResponseImage = {
                    data: generatedImage.imageBytes,
                    mimeType: generatedImage.mimeType,
                };
                aiImageSourceUrl = `data:${generatedImage.mimeType};base64,${generatedImage.imageBytes}`;
                // Use a fixed caption for pure image generation
                aiResponseText = 'وێنەکەت بە سەرکەوتوویی دروستکرا.'; 
            } else {
                aiResponseText = 'نەتوانرا هیچ وێنەیەک دروست بکرێت. تکایە فەرمانەکەت ڕوونتر بنووسە.';
            }
        } else {
            // --- Handle Chat or Multimodal (generateContent) Response ---
            const candidate = result.candidates?.[0];
            const parts = candidate?.content?.parts;
            
            if (parts && parts.length > 0) {
                // CRITICAL FIX: Find the first part that DEFINITELY has a text property AND the text property is not null
                const textPart = parts.find(p => p && p.text !== null && p.text !== undefined); 
                
                if (textPart) {
                    aiResponseText = textPart.text; 
                } 
                
                // Check for image data from multimodal or chat model (rare, but possible)
                const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image'));
                if (imagePart) {
                    aiImageSourceUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                    aiResponseImage = {
                        data: imagePart.inlineData.data,
                        mimeType: imagePart.inlineData.mimeType,
                    };
                    // If it's a pure image response with no text, provide a fallback caption
                    if (aiResponseText.length === 0) {
                        aiResponseText = 'وێنەکەت بە سەرکەوتوویی پرۆسێس کرا.';
                    }
                }
                
                // Fallback for non-text parts, null text, or empty content
                if (aiResponseText.length === 0 && !aiImageSourceUrl) {
                    aiResponseText = 'هیچ وه‌ڵامێكی نووسراو نه‌دۆزرایه‌وه‌. ڕه‌نگه‌ مۆدێله‌كه‌ به‌تاڵ بووبێت.';
                }
                
            } else {
                // Final fallback if result.candidates or content.parts are missing (e.g., API blocked the prompt silently)
                aiResponseText = 'هیچ وەڵامێک نەدراوەتەوە. ڕەنگە پرسیارەکە ڕاگیرابێت.';
            }
        }


        
        // 9. Add AI response to local history (Only if using the chat model AND not blocked)
        if (model === GEMINI_CHAT_MODEL) {
            const aiParts = [{ text: aiResponseText }];
            window.chatHistory.push({ role: 'model', parts: aiParts });
        }


        // 10. Update UI (Remove loading, add final content)
        if (aiLoadingElement) {
            aiLoadingElement.remove(); 
            
            // Pass aiImageSourceUrl to appendMessage for AI messages
            appendMessage('ai', aiResponseText, true, aiImageSourceUrl);
        }
        
        // 11. SAVE AI MESSAGE TEXT TO FIRESTORE (IMAGE DATA IS OMITTED DUE TO 1MB LIMIT)
        if (userId && db && isPersistent) {
              const firestoreData = {
                  userId: userId,
                  role: 'ai', 
                  text: aiResponseText,
                  timestamp: serverTimestamp()
              };
              try {
                  if (firestoreData.text) {
                    await addDoc(getChatCollectionRef(), firestoreData);
                  }
              } catch (e) {
                  console.error("Error adding AI message to history (text only):", e);
              }
        }

    } catch (error) {
        console.error("Gemini API Error:", error);
        
        let errorMessage = `هه‌ڵه‌: ببوره‌، په‌یوه‌ندی له‌گه‌ڵ جێمینی پچڕا. هۆکار: ${error.message}`;
        
        // Remove the loading element and show the error message in an alert
        if (aiLoadingElement) {
           aiLoadingElement.remove(); 
           appendMessage('ai', errorMessage, true, null);
        }
        alertMessage('هەڵەی گەورە', errorMessage, 'error');
    } finally {
        // 12. Re-enable input
        inputField.disabled = false;
        sendButton.disabled = false;
        inputField.focus();
        messageArea.scrollTop = messageArea.scrollHeight;
    }
}

// Start the application after the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const placeholder = document.getElementById('google-icon-placeholder');
    if (placeholder) {
        placeholder.innerHTML = emptyLogoHtml;
    }
    initializeFirebase();

    // --- DARK/LIGHT MODE TOGGLE LOGIC ---
    if (modeToggleBtn) {
        const body = document.body;

        function updateThemeIcon() {
            // If body has dark-mode, we are in dark mode -> Show Sun (to switch to light)
            // If body is light, we are in light mode -> Show Moon (to switch to dark)
            if (body.classList.contains('dark-mode')) {
                modeToggleBtn.innerHTML = '<i class="material-icons">brightness_7</i>'; // Sun icon
            } else {
                modeToggleBtn.innerHTML = '<i class="material-icons">brightness_4</i>'; // Moon icon
            }
        }

        // 1. Initialize from Local Storage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            body.classList.add('dark-mode');
        }
        updateThemeIcon();

        // 2. Click Handler
        modeToggleBtn.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon();
        });
    }
});