chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXECUTE_PROMPT') {
    handlePrompt(request.task)
      .then(result => sendResponse({ result }))
      .catch(err => sendResponse({ error: err.message }));
      
    // Return true to indicate we will send a response asynchronously
    return true; 
  }
});

async function handlePrompt(task) {
  const isChatGPT = window.location.hostname.includes('chatgpt.com');
  const isDeepSeek = window.location.hostname.includes('deepseek.com');

  if (isChatGPT) {
    return await executeChatGPT(task.prompt);
  } else if (isDeepSeek) {
    return await executeDeepSeek(task.prompt);
  } else {
    throw new Error('Unsupported domain');
  }
}

// ----------------------------------------------------
// ChatGPT Logic
// ----------------------------------------------------
async function executeChatGPT(prompt) {
  // 1. Find the input box
  const textarea = document.querySelector('#prompt-textarea');
  if (!textarea) throw new Error('ChatGPT textarea not found');

  // Focus and insert text using execCommand for reliability with React
  textarea.focus();
  textarea.value = ''; // clear old
  document.execCommand('insertText', false, prompt);
  
  // Alternatively, trigger input event manually
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  await delay(500); // Wait for React to process and button to enable

  // 2. Click the send button
  const sendBtnSelector = 'button[data-testid="send-button"]';
  let sendBtn = document.querySelector(sendBtnSelector);
  
  if (!sendBtn || sendBtn.disabled) {
    throw new Error('Send button not available or disabled');
  }
  sendBtn.click();

  // 3. Wait for generation to finish
  return await waitForChatGPTCompletion();
}

async function waitForChatGPTCompletion() {
  return new Promise((resolve, reject) => {
    let checkInterval = setInterval(() => {
      // Check for "Continue generating"
      const continueBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Continue generating'));
      if (continueBtns.length > 0) {
        continueBtns[0].click();
      }

      // Check if the "Stop generating" button exists. If yes, it means it's still busy.
      // Note: ChatGPT DOM changes frequently, so this relies on checking the send button state as well.
      const stopBtn = document.querySelector('button[aria-label="Stop generating"]');
      const typingIndicator = document.querySelector('.result-streaming'); // Another indicator
      
      const isGenerateButtonBack = document.querySelector('button[data-testid="send-button"]') !== null;
      
      // If we see the send button again and no stop btn, we are probably done
      if (isGenerateButtonBack && !stopBtn) {
        clearInterval(checkInterval);
        
        // Grab the last assistant message
        const messages = document.querySelectorAll('.markdown');
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          resolve(lastMessage.innerText);
        } else {
          resolve("No response generated");
        }
      }
    }, 1000);

    // Timeout fallback (e.g., 2 minutes)
    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error('ChatGPT Generation timeout'));
    }, 120000);
  });
}

// ----------------------------------------------------
// DeepSeek Logic
// ----------------------------------------------------
async function executeDeepSeek(prompt) {
  // 1. Find the input box (DeepSeek uses ID #chat-input or similar)
  const textarea = document.querySelector('#chat-input');
  if (!textarea) throw new Error('DeepSeek textarea not found');

  textarea.focus();
  textarea.value = '';
  document.execCommand('insertText', false, prompt);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  await delay(500);

  // Deepseek send button, might not have clear ID, look for SVG or specific class
  // or simply dispatch ENTER mapped to the textarea.
  const enterEvent = new KeyboardEvent('keydown', {
    bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
  });
  textarea.dispatchEvent(enterEvent);

  // 2. Wait for generation to finish
  return await waitForDeepSeekCompletion();
}

async function waitForDeepSeekCompletion() {
  return new Promise((resolve, reject) => {
    let checkInterval = setInterval(() => {
      // Check for Continue Generating
      const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
      const continueBtn = buttons.find(b => b.innerText.includes('Continue'));
      if (continueBtn && continueBtn.offsetParent !== null) { // visible
        continueBtn.click();
      }

      // DeepSeek shows a Stop button when generating
      const stopBtn = buttons.find(b => b.innerText.includes('Stop generating') || document.querySelector('.ds-icon-stop'));
      
      // Look for the "Send" icon which comes back when done
      const sendIcon = document.querySelector('.ds-icon-send');

      if (!stopBtn && sendIcon) {
        clearInterval(checkInterval);
        
        // Grab the last assistant message string
        // Deepseek usually puts response in ds-markdown container
        const messages = document.querySelectorAll('.ds-markdown');
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          resolve(lastMessage.innerText);
        } else {
          // Fallback if DOM changed
          resolve('Generated, but failed to parse message wrapper. Check selectors.');
        }
      }
    }, 1000);

    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error('DeepSeek Generation timeout'));
    }, 120000);
  });
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}
