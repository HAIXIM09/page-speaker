// popup.js

const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const anthropicKeyInput = document.getElementById('anthropicKey');
const elevenLabsKeyInput = document.getElementById('elevenLabsKey');
const voiceIdInput = document.getElementById('voiceId');
const saveSettingsBtn = document.getElementById('saveSettings');

const runBtn = document.getElementById('runBtn');
const runLabel = document.getElementById('runLabel');

const statusArea = document.getElementById('statusArea');
const statusText = document.getElementById('statusText');
const errorArea = document.getElementById('errorArea');
const errorText = document.getElementById('errorText');
const resultArea = document.getElementById('resultArea');
const summaryTextEl = document.getElementById('summaryText');

const playPauseBtn = document.getElementById('playPauseBtn');
const stopBtn = document.getElementById('stopBtn');
const audioPlayer = document.getElementById('audioPlayer');

const STAGE_LABELS = {
  extracting: 'Reading the page...',
  summarizing: 'Asking Claude to summarize...',
  synthesizing: 'Generating voice...'
};

function showStatus(stage) {
  errorArea.classList.add('hidden');
  resultArea.classList.add('hidden');
  statusArea.classList.remove('hidden');
  statusText.textContent = STAGE_LABELS[stage] || 'Working...';
}

function showError(message) {
  statusArea.classList.add('hidden');
  resultArea.classList.add('hidden');
  errorArea.classList.remove('hidden');
  errorText.textContent = message;
}

function showResult(summary, audioDataUrl) {
  statusArea.classList.add('hidden');
  errorArea.classList.add('hidden');
  resultArea.classList.remove('hidden');
  summaryTextEl.textContent = summary;

  audioPlayer.src = audioDataUrl;
  audioPlayer.play();
  playPauseBtn.textContent = '⏸ Pause';
}

function setRunning(isRunning) {
  runBtn.disabled = isRunning;
  runLabel.textContent = isRunning ? 'Working...' : 'Summarize & speak this page';
}

async function loadSettingsIntoForm() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    const s = (response && response.settings) || {};
    anthropicKeyInput.value = s.anthropicKey || '';
    elevenLabsKeyInput.value = s.elevenLabsKey || '';
    voiceIdInput.value = s.voiceId || '';
  });
}

function settingsAreMissing() {
  return !anthropicKeyInput.value && !elevenLabsKeyInput.value;
}

settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
  const payload = {
    anthropicKey: anthropicKeyInput.value.trim(),
    elevenLabsKey: elevenLabsKeyInput.value.trim(),
    voiceId: voiceIdInput.value.trim()
  };
  chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload }, () => {
    settingsPanel.classList.add('hidden');
  });
});

runBtn.addEventListener('click', () => {
  setRunning(true);
  showStatus('extracting');

  chrome.runtime.sendMessage({ type: 'RUN_SUMMARY' }, (response) => {
    setRunning(false);
    if (!response) {
      showError('No response from the extension background. Try reopening the popup.');
      return;
    }
    if (!response.ok) {
      showError(response.error || 'Something went wrong.');
      return;
    }
    showResult(response.summary, response.audioDataUrl);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PROGRESS') {
    showStatus(message.stage);
  }
});

playPauseBtn.addEventListener('click', () => {
  if (audioPlayer.paused) {
    audioPlayer.play();
    playPauseBtn.textContent = '⏸ Pause';
  } else {
    audioPlayer.pause();
    playPauseBtn.textContent = '▶ Play';
  }
});

stopBtn.addEventListener('click', () => {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  playPauseBtn.textContent = '▶ Play';
});

audioPlayer.addEventListener('ended', () => {
  playPauseBtn.textContent = '▶ Play';
});

// On open: load saved settings, and nudge user to settings if keys are empty
loadSettingsIntoForm();
chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
  const s = (response && response.settings) || {};
  if (!s.anthropicKey || !s.elevenLabsKey) {
    settingsPanel.classList.remove('hidden');
  }
});
