document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  chrome.storage.sync.set({ apiKey: apiKey }, () => {
    alert('API key saved');
  });
});

chrome.storage.sync.get('apiKey', (data) => {
  if (data.apiKey) {
    document.getElementById('apiKey').value = data.apiKey;
  }
});