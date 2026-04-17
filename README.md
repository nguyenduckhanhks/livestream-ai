# AI Bridge Service (ChatGPT & DeepSeek)

A bridge service that allows you to programmatically prompt ChatGPT and DeepSeek through a local API. The service uses a Node.js server and a Manifest V3 Chrome Extension to safely inject your prompts into the web interface and retrieve the AI's response asynchronously without needing expensive API keys.

## 📁 Architecture
- `/server` - A Node.js Express server that queues incoming queries and polls endpoints.
- `/extension` - A Chrome Extension containing a background worker for polling the server, and a content script that manipulates the AI DOM (finds the input box, types, and sends).

---

## 🚀 Setup Instructions

### 1. Start the Node API Server
Navigate to the server directory and start it up:
```bash
cd server
npm install
npm start
```
*You should see:* `🤖 AI Bridge Server listening on http://localhost:3000`

### 2. Install the Chrome Extension
1. Open Google Chrome.
2. Type `chrome://extensions/` into the URL bar and hit enter.
3. Turn on **Developer mode** (toggle is in the top right corner).
4. Click on **Load unpacked** (button in the top left).
5. Select the `extension` folder located inside this project (`livestream-AI/extension`).

### 3. Prepare the Browser
In your Chrome browser where the extension is running:
1. Open one tab to [ChatGPT](https://chatgpt.com/) and make sure you are logged in.
2. Open another tab to [DeepSeek](https://chat.deepseek.com/) and make sure you are logged in.
*(Keep these tabs open! The extension will use them in the background.)*

---

## 🧪 How to Use

Simply make a POST request to your local server. The server will hand the prompt off to your Chrome extension, which will simulate the typing, hit send, wait for the AI to finish reading, and pass the final text back to your terminal request perfectly mapped.

### Option A: Querying ChatGPT
Send a request using **PowerShell**:
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/generate" -ContentType "application/json" -Body '{"prompt": "Give me a simple helloworld code in python", "target": "chatgpt"}'
```

*(Or using **cURL** in Git Bash / WSL / macOS):*
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Give me a simple helloworld code in python", "target": "chatgpt"}'
```

### Option B: Querying DeepSeek
Change the target to `deepseek`:
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/generate" -ContentType "application/json" -Body '{"prompt": "What is the capital of France? One word answer.", "target": "deepseek"}'
```

## ⚠️ Notes 
- The server will reject concurrent requests with a **429 Too Many Requests** error if it is currently busy fulfilling another prompt. Wait for the first prompt to finish returning before sending the next one.
- If ChatGPT puts up a "Continue generating" button, the extension is designed to auto-click it.
