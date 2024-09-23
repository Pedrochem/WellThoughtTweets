const saveButton = document.getElementById('save');
const apiKeyInput = document.getElementById('apiKey');
const hideLowRankTweetsSelect = document.getElementById('hideLowRankTweets');
const colorfulRanksCheckbox = document.getElementById('colorfulRanks');

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
  const colorfulRanks = colorfulRanksCheckbox.checked;
  console.log('Saving settings:', { apiKey, hideLowRankTweets, colorfulRanks });
  chrome.storage.sync.set({ apiKey: apiKey, hideLowRankTweets: hideLowRankTweets, colorfulRanks: colorfulRanks }, () => {
    console.log('Settings saved');
    // Send a message to the background script to update the API key
    chrome.runtime.sendMessage({ action: 'updateApiKey', apiKey: apiKey }, (response) => {
      console.log(response.status);
    });
    disableSaveButton();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.reload(tabs[0].id);
    });
  });
});

chrome.storage.sync.get(['apiKey', 'hideLowRankTweets', 'colorfulRanks'], (data) => {
  console.log('Retrieved settings:', data);
  if (data.apiKey) {
    apiKeyInput.value = data.apiKey;
  }
  if (data.hideLowRankTweets !== undefined) {
    hideLowRankTweetsSelect.value = data.hideLowRankTweets;
  } else {
    // Set a default value if not found in storage
    hideLowRankTweetsSelect.value = '1';
  }
  if (data.colorfulRanks !== undefined) {
    colorfulRanksCheckbox.checked = data.colorfulRanks;
  } else {
    // Set default to true if not found in storage
    colorfulRanksCheckbox.checked = true;
  }
  // Show the select element after setting the value
  hideLowRankTweetsSelect.style.visibility = 'visible';
  disableSaveButton();
});

apiKeyInput.addEventListener('input', enableSaveButton);
hideLowRankTweetsSelect.addEventListener('change', enableSaveButton);
colorfulRanksCheckbox.addEventListener('change', enableSaveButton);