const SERVER_URL = 'http://localhost:3000/api';
let isProcessing = false;

// Poll the server every 2 seconds
setInterval(async () => {
  if (isProcessing) return;

  try {
    const response = await fetch(`${SERVER_URL}/poll`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    if (data.hasTask && data.task) {
      isProcessing = true;
      handleTask(data.task);
    }
  } catch (err) {
    // Silently ignore connection errors to avoid flooding console when server is down
  }
}, 2000);

async function handleTask(task) {
  try {
    const targetUrl = task.target === 'chatgpt' 
      ? 'https://chatgpt.com/*'
      : 'https://chat.deepseek.com/*';
      
    // Find a tab that matches the target
    const tabs = await chrome.tabs.query({ url: targetUrl });
    
    if (tabs.length === 0) {
      throw new Error(`No open tab found for ${task.target}`);
    }
    
    // Choose the first matching tab
    const tabId = tabs[0].id;
    
    // Make sure the tab is active to ensure the DOM is rendering and inputs can work
    // (Optional but highly recommended for reliability)
    await chrome.tabs.update(tabId, { active: true });
    
    // Send message to the content script in that tab
    chrome.tabs.sendMessage(tabId, { action: 'EXECUTE_PROMPT', task }, async (response) => {
      // Content script replies with { result: string } or { error: string }
      if (chrome.runtime.lastError) {
        completeTask({ error: chrome.runtime.lastError.message });
      } else {
        completeTask(response);
      }
    });

  } catch (err) {
    completeTask({ error: err.message });
  }
}

async function completeTask(payload) {
  try {
    await fetch(`${SERVER_URL}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Failed to notify server of completion', err);
  } finally {
    isProcessing = false;
  }
}
