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

  // Get initial message count to prevent premature resolution
  const initialAssistantMsgCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;

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
  return await waitForChatGPTCompletion(initialAssistantMsgCount);
}

async function waitForChatGPTCompletion(initialCount) {
  return new Promise((resolve, reject) => {
    let hasStartedGenerating = false;

    let checkInterval = setInterval(() => {
      // Check for "Continue generating"
      const continueBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText && b.innerText.includes('Continue generating'));
      if (continueBtns.length > 0) {
        continueBtns[0].click();
      }

      // Check if the "Stop generating" button exists. If yes, it means it's still busy.
      const stopBtn = document.querySelector('button[aria-label="Stop generating"]') || document.querySelector('button[data-testid="stop-button"]');
      const typingIndicator = document.querySelector('.result-streaming'); // Another indicator
      
      const currentCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
      
      // Determine if generation has started
      if (stopBtn || typingIndicator || (currentCount > initialCount)) {
        hasStartedGenerating = true;
      }
      
      // If generation has started, is no longer streaming, we have no stop button, 
      // and the new message actually exists
      if (hasStartedGenerating && !stopBtn && !typingIndicator && currentCount > initialCount) {
        clearInterval(checkInterval);
        
        // Grab the last assistant message
        const messages = document.querySelectorAll('.markdown');
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          resolve(lastMessage.innerText);
        } else {
          // Fallback if markdown class was removed in latest ChatGPT update
          const assistantRoles = document.querySelectorAll('[data-message-author-role="assistant"]');
          if (assistantRoles.length > 0) {
             resolve(assistantRoles[assistantRoles.length - 1].innerText);
          } else {
             resolve("No response generated or could not parse DOM");
          }
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
  // 1. Find the input box (DeepSeek uses ID #chat-input or a generic textarea)
  let textarea = document.querySelector('#chat-input') || document.querySelector('textarea[placeholder*="Message"]') || document.querySelector('textarea') || document.querySelector('div[contenteditable="true"]');
  if (!textarea) throw new Error('DeepSeek textarea not found');

  const initialAssistantMsgCount = document.querySelectorAll('.ds-markdown, .markdown, .chat-message').length;

  textarea.focus();
  textarea.value = '';
  document.execCommand('insertText', false, prompt);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  await delay(500);

  // Send button logic for DeepSeek
  // Deepseek send button can sometimes be clicked via enter
  const enterEvent = new KeyboardEvent('keydown', {
    bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
  });
  textarea.dispatchEvent(enterEvent);
  
  // Also try clicking the actual send button if we can find it
  const sendBtn = document.querySelector('.ds-icon-send')?.closest('div[role="button"]') || document.querySelector('.send-button');
  if (sendBtn) {
    sendBtn.click();
  }

  // 2. Wait for generation to finish
  return await waitForDeepSeekCompletion(initialAssistantMsgCount);
}

async function waitForDeepSeekCompletion(initialCount) {
  return new Promise((resolve, reject) => {
    let hasStartedGenerating = false;
    
    let checkInterval = setInterval(() => {
      // Check for Continue Generating
      const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
      const continueBtn = buttons.find(b => b.innerText && b.innerText.includes('Continue'));
      if (continueBtn && continueBtn.offsetParent !== null) { // visible
        continueBtn.click();
      }

      // DeepSeek shows a Stop button when generating
      const stopBtn = buttons.find(b => b.innerText && b.innerText.includes('Stop')) || document.querySelector('.ds-icon-stop');
      const currentCount = document.querySelectorAll('.ds-markdown, .markdown, .chat-message').length;

      if (stopBtn || (currentCount > initialCount)) {
        hasStartedGenerating = true;
      }

      // We are done if it has started, no stop btn is visible, and message count increased
      if (hasStartedGenerating && !stopBtn && currentCount > initialCount) {
        clearInterval(checkInterval);
        
        // Grab the last assistant message string
        const messages = document.querySelectorAll('.ds-markdown, .markdown, .chat-message');
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
