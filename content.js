// background.js
// Orchestrates: inject content script -> extract text -> summarize via Claude ->
// synthesize speech via ElevenLabs -> hand audio back to the popup.

const STORAGE_KEYS = {
  anthropicKey: 'anthropicApiKey',
  elevenLabsKey: 'elevenLabsApiKey',
  voiceId: 'elevenLabsVoiceId'
};

// Rachel — a default, widely-available ElevenLabs voice. User can override in settings.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  return {
    anthropicKey: stored[STORAGE_KEYS.anthropicKey] || '',
    elevenLabsKey: stored[STORAGE_KEYS.elevenLabsKey] || '',
    voiceId: stored[STORAGE_KEYS.voiceId] || DEFAULT_VOICE_ID
  };
}

async function extractPageText(tabId) {
  // Ensure content script is present (in case the page loaded before install/reload)
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (err) {
    // Likely already injected, or a restricted page (chrome://, Web Store, etc.)
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error('Could not read this page. It may be a restricted browser page (chrome://, Web Store, etc.) where extensions cannot run.'));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response?.error || 'Failed to extract page text.'));
        return;
      }
      resolve(response);
    });
  });
}

async function summarizeWithClaude(pageText, meta, apiKey) {
  if (!apiKey) throw new Error('Missing Anthropic API key. Add it in settings.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: 'You write spoken-word summaries of web pages. Output plain prose only — no markdown, no bullet points, no headers, no asterisks. Write the way a knowledgeable person would explain the page out loud to a friend in under 45 seconds. Be direct and natural, not robotic.',
      messages: [
        {
          role: 'user',
          content: `Page title: ${meta.title}\nURL: ${meta.url}\n\nPage content:\n${pageText}\n\nSummarize this page in spoken, natural prose.`
        }
      ]
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 401) throw new Error('Anthropic API key was rejected. Check it in settings.');
    if (response.status === 429) throw new Error('Anthropic rate limit hit. Try again shortly.');
    throw new Error(`Claude API error (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claude returned no text content.');
  return textBlock.text.trim();
}

async function synthesizeSpeech(summaryText, apiKey, voiceId) {
  if (!apiKey) throw new Error('Missing ElevenLabs API key. Add it in settings.');

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: summaryText,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 401) throw new Error('ElevenLabs API key was rejected. Check it in settings.');
    if (response.status === 429) throw new Error('ElevenLabs rate limit or quota hit.');
    throw new Error(`ElevenLabs API error (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const audioBuffer = await response.arrayBuffer();
  // Convert to base64 so it can be sent through chrome.runtime messaging to the popup
  const bytes = new Uint8Array(audioBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const base64Audio = btoa(binary);
  return `data:audio/mpeg;base64,${base64Audio}`;
}

async function runPipeline(tabId, onProgress) {
  const settings = await getSettings();

  onProgress('extracting');
  const { text, meta } = await extractPageText(tabId);
  if (!text || text.length < 50) {
    throw new Error('Could not find enough readable text on this page.');
  }

  onProgress('summarizing');
  const summary = await summarizeWithClaude(text, meta, settings.anthropicKey);

  onProgress('synthesizing');
  const audioDataUrl = await synthesizeSpeech(summary, settings.elevenLabsKey, settings.voiceId);

  return { summary, audioDataUrl, meta };
}

// Message handling from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RUN_SUMMARY') {
    (async () => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          const tab = tabs[0];
          if (!tab || !tab.id) {
            sendResponse({ ok: false, error: 'No active tab found.' });
            return;
          }
          try {
            const result = await runPipeline(tab.id, (stage) => {
              chrome.runtime.sendMessage({ type: 'PROGRESS', stage }).catch(() => {});
            });
            sendResponse({ ok: true, ...result });
          } catch (err) {
            sendResponse({ ok: false, error: err.message });
          }
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // async response
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then((settings) => sendResponse({ settings }));
    return true;
  }

  if (message.type === 'SET_SETTINGS') {
    chrome.storage.local.set({
      [STORAGE_KEYS.anthropicKey]: message.payload.anthropicKey,
      [STORAGE_KEYS.elevenLabsKey]: message.payload.elevenLabsKey,
      [STORAGE_KEYS.voiceId]: message.payload.voiceId || DEFAULT_VOICE_ID
    }).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Keyboard shortcut opens the popup by default via _execute_action,
// which Chrome handles natively — no extra code needed for that binding.
