const saveButton = document.getElementById('save');
const apiKeyInput = document.getElementById('apiKey');
const hideLowRankTweetsSelect = document.getElementById('hideLowRankTweets');
const reminder = document.getElementById('reminder');
const refreshLink = document.getElementById('refreshLink');

function enableSaveButton() {
  saveButton.disabled = false;
  saveButton.textContent = 'Save';
}

function disableSaveButton() {
  saveButton.disabled = true;
  saveButton.textContent = 'Saved';
}

saveButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value;
  const hideLowRankTweets = hideLowRankTweetsSelect.value;
  chrome.storage.sync.set({ apiKey: apiKey, hideLowRankTweets: hideLowRankTweets }, () => {
    disableSaveButton();
    reminder.style.display = 'block';
  });
});

chrome.storage.sync.get(['apiKey', 'hideLowRankTweets'], (data) => {
  if (data.apiKey) {
    apiKeyInput.value = data.apiKey;
  }
  if (data.hideLowRankTweets !== undefined) {
    hideLowRankTweetsSelect.value = data.hideLowRankTweets;
  } else {
    // Set a default value if not found in storage
    hideLowRankTweetsSelect.value = '1';
  }
  // Show the select element after setting the value
  hideLowRankTweetsSelect.style.visibility = 'visible';
  disableSaveButton();
});

apiKeyInput.addEventListener('input', enableSaveButton);
hideLowRankTweetsSelect.addEventListener('change', enableSaveButton);

refreshLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.reload(tabs[0].id);
  });
});