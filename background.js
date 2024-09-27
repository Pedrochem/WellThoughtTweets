let GEMINI_API_KEY = ''; // Initialize the API key variable
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

let apiCallCount = 0;
let pendingTweets = [];
let unrankedTweets = [];
let processingTweets = false;
let currentTabId = null;
let retryTimeout = null;
let processedTweetIds = new Set();

// Listen for messages from the popup to update the API key
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateApiKey') {
    GEMINI_API_KEY = request.apiKey;
    console.log('API key updated:', GEMINI_API_KEY); // Log the full API key
    sendResponse({ status: 'API key updated' });
    return true;
  }

  if (request.action === 'rankTweets') {
    currentTabId = sender.tab.id;
    request.tweets.forEach(tweet => {
      pendingTweets.push(tweet);
    });
    processTweets();
    return true; // Indicates that the response is sent asynchronously
  }
});

async function processTweets() {
  if (processingTweets || (pendingTweets.length === 0 && unrankedTweets.length === 0)) return;

  if (!GEMINI_API_KEY) {
    console.log('API key not set. Skipping tweet processing.');
    return;
  }

  processingTweets = true;
  const tweetsToProcess = [...unrankedTweets, ...pendingTweets.splice(0, 10 - unrankedTweets.length)];
  unrankedTweets = [];

  try {
    const ratings = await rankTweetsWithGemini(tweetsToProcess);
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { action: 'tweetRatings', ratings });
    }
  } catch (error) {
    console.error('Error ranking tweets:', error);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error))); // Log full error details
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { action: 'tweetRatings', ratings: tweetsToProcess.map(tweet => ({ id: tweet.id, rating: null })) });
    }
  }

  processingTweets = false;
  if (pendingTweets.length > 0 || unrankedTweets.length > 0) {
    processTweets(); // Process next batch if there are more tweets
  }
}

async function rankTweetsWithGemini(tweets) {
  if (!GEMINI_API_KEY) {
    console.log('API key not set. Cannot rank tweets.');
    return tweets.map(tweet => ({ id: tweet.id, rating: null }));
  }

  apiCallCount++;
  console.log(`Making API call #${apiCallCount}`);
  console.log(`Tweets to rank: ${tweets.length}`);
  console.log('Using API key:', GEMINI_API_KEY); // Log the full API key

  const requestBody = {
    contents: [{
      parts: [{
        text: `You are a professional tweet rater with great philsophical perspectives. You should rank tweets on a scale of 1-10 based on how well thought and how well argued out they are. You should value aspects of a post such as creativity, uniqueness, reflectiveness, consciousness, thoughtfulness, deep meaning, and intelligence. Respond with only the numeric ratings, separated by commas.\n\n${tweets.map((tweet, index) => `Tweet ${index + 1}: "${tweet.text}"`).join('\n\n')}`
      }]
    }]
  };

  console.log('API Request:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`API Response Status: ${response.status} ${response.statusText}`);

    if (response.status === 429) {
      console.warn('API quota reached. Retrying in 5 seconds.');
      unrankedTweets.push(...tweets);
      scheduleRetry();
      return tweets.map(tweet => ({ id: tweet.id, rating: null }));
    }

    if (!response.ok) {
      // Error response
      console.error(`API call #${apiCallCount} failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText); // Log the full error response
      return tweets.map(tweet => ({ id: tweet.id, rating: -10})); // Return -10 if the response is not valid
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
      // API call returned unexpected data structure (Unsafe)
      console.error(`API call #${apiCallCount} returned unexpected data structure:`);
      console.error('Received structure:', JSON.stringify(data, null, 2));
      return tweets.map(tweet => ({ id: tweet.id, rating: -1 })); // Return -1 if the response is not valid
    }

    const ratingText = data.candidates[0].content.parts[0].text;
    const ratings = ratingText.split(',').map(r => {
      const rating = parseInt(r.trim());
      return isNaN(rating) ? -100 : rating; // Return -100 if the rating is not a number
    });

    tweets.forEach((tweet, index) => {
      console.log(`Tweet ID: ${tweet.id}, Rating: ${ratings[index]}`);
    });
    return tweets.map((tweet, index) => ({ id: tweet.id.toString(), rating: ratings[index] })); // Ensure ID is a string

  } catch (error) {
    console.error(`Error in API call #${apiCallCount}:`, error);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error))); // Log full error details
    return tweets.map(tweet => ({ id: tweet.id, rating: -4 }));
  }
}

function scheduleRetry() {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
  }
  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    processTweets();
  }, 5000);
}

console.log('Tweet Thought Ranker background script loaded. Initial API call count: 0');

// Initialize the API key from storage when the script loads
chrome.storage.sync.get(['apiKey'], (data) => {
  if (data.apiKey) {
    GEMINI_API_KEY = data.apiKey;
    console.log('API key loaded from storage');
  } else {
    console.log('No API key found in storage');
  }
});