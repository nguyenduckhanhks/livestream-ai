const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// State Manager
let isBusy = false;
let pendingTask = null;
let pendingResolve = null;
let pendingReject = null;

// The main endpoint the user's application hits
app.post('/api/generate', (req, res) => {
  const { prompt, target } = req.body;

  if (!prompt || !target) {
    return res.status(400).json({ error: 'Missing prompt or target (chatgpt|deepseek)' });
  }

  if (isBusy) {
    return res.status(429).json({ error: 'Server is currently busy with another prompt' });
  }

  isBusy = true;
  
  // Create a new task
  pendingTask = {
    id: Date.now().toString(),
    prompt,
    target
  };

  // Keep the HTTP request open until the extension completes.
  // When the extension hits /api/complete, we will call pendingResolve().
  new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    
    // Add a timeout just in case the extension dies or fails
    setTimeout(() => {
      if (pendingTask && pendingTask.id === pendingTask.id) {
        pendingReject(new Error('Extension timeout: did not complete in 120 seconds'));
      }
    }, 120000);
  })
  .then(answer => {
    res.json({ success: true, answer });
  })
  .catch(err => {
    res.status(500).json({ error: err.message });
  })
  .finally(() => {
    // Reset state
    isBusy = false;
    pendingTask = null;
    pendingResolve = null;
    pendingReject = null;
  });
});

// The endpoint the Chrome Extension polls every 2-3 seconds
app.get('/api/poll', (req, res) => {
  if (pendingTask) {
    // We send the task and clear it from the "queue" so we don't send it twice.
    // However, we remain 'busy' until complete.
    const taskToSend = { ...pendingTask };
    pendingTask = null; 
    return res.json({ hasTask: true, task: taskToSend });
  }
  
  return res.json({ hasTask: false });
});

// The endpoint the Chrome Extension hits when it has scraped the final AI answer
app.post('/api/complete', (req, res) => {
  const { result, error } = req.body;

  if (!isBusy) {
    return res.status(400).json({ error: 'No active task to complete' });
  }

  if (error) {
    if (pendingReject) pendingReject(new Error(error));
  } else {
    if (pendingResolve) pendingResolve(result);
  }

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🤖 AI Bridge Server listening on http://localhost:${PORT}`);
});
