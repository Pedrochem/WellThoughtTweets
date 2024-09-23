document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const hideLowRankTweets = document.getElementById('hideLowRankTweets').value;
  chrome.storage.sync.set({ apiKey: apiKey, hideLowRankTweets: hideLowRankTweets }, () => {
    alert('Settings saved');
  });
});

chrome.storage.sync.get(['apiKey', 'hideLowRankTweets'], (data) => {
  if (data.apiKey) {
    document.getElementById('apiKey').value = data.apiKey;
  }
  if (data.hideLowRankTweets !== undefined) {
    document.getElementById('hideLowRankTweets').value = data.hideLowRankTweets;
  }
});