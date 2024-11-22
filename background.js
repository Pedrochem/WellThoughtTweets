let API_KEY = ''; // Generic API key variable
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

let selectedModel = 'gemini-1.5-flash-latest'; // Default to Gemini
let apiCallCount = 0;
let pendingTweets = [];
let unrankedTweets = [];
let processingTweets = false;
let currentTabId = null;
let retryTimeout = null;
let processedTweetIds = new Set();
let isPaused = false;
let currentCriteria = [];

async function rankTweets(tweets) {
  if (selectedModel.includes('gpt')) {
    return rankTweetsWithOpenAI(tweets);
  } else {
    return rankTweetsWithGemini(tweets);
  }
}

async function rankTweetsWithGemini(tweets) {
  if (!API_KEY) {
    console.log('API key not set.');
    return tweets.map(tweet => ({ id: tweet.id, rating: null }));
  }

  apiCallCount++;
  console.log(`Making Gemini API call #${apiCallCount} | Tweets to rank: ${tweets.length}`);

  const activeCriteria = currentCriteria.filter(c => c.weight > 0);
  const criteriaText = activeCriteria.length > 0 
    ? `You should rank tweets based on the following criteria: ${activeCriteria.map(c => `${c.text}: ${c.weight}`).join(', ')}. Higher weighted criteria should have more impact on the final score. ` 
    : 'You should rank tweets based on how well thought and how well argued out they are. ';

  const requestBody = {
    contents: [{
      parts: [{
        text: `You are a professional tweet rater with great philosophical perspectives. ${criteriaText}Rank tweets on a scale of 1-10. Respond with only the numeric ratings, separated by commas.\n\n${tweets.map((tweet, index) => `Tweet ${index + 1}: "${tweet.text}"`).join('\n\n')}`
      }]
    }]
  };

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log('API Request:', JSON.stringify(requestBody, null, 2));

    if (response.status === 429) {
      console.warn('API quota reached. Retrying in 5 seconds.');
      unrankedTweets.push(...tweets);
      scheduleRetry();
      return tweets.map(tweet => ({ id: tweet.id, rating: null }));
    }

    if (!response.ok) {
      console.error(`API call #${apiCallCount} failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return tweets.map(tweet => ({ id: tweet.id, rating: -10 }));
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
      console.error(`API call #${apiCallCount} returned unexpected data structure:`);
      console.error('Received structure:', JSON.stringify(data, null, 2));
      return tweets.map(tweet => ({ id: tweet.id, rating: -1 }));
    }

    const ratingText = data.candidates[0].content.parts[0].text;
    const ratings = ratingText.split(',').map(r => {
      const rating = parseInt(r.trim());
      return isNaN(rating) ? -100 : rating;
    });

    tweets.forEach((tweet, index) => {
      console.log(`Tweet ID: ${tweet.id}, Rating: ${ratings[index]}`);
    });
    return tweets.map((tweet, index) => ({ id: tweet.id.toString(), rating: ratings[index] }));

  } catch (error) {
    console.error(`Error in API call #${apiCallCount}:`, error);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return tweets.map(tweet => ({ id: tweet.id, rating: -4 }));
  }
}

async function rankTweetsWithOpenAI(tweets) {
  if (!API_KEY) {
    console.log('API key not set.');
    return tweets.map(tweet => ({ id: tweet.id, rating: null }));
  }

  apiCallCount++;
  console.log(`Making OpenAI API call #${apiCallCount} | Tweets to rank: ${tweets.length}`);

  const activeCriteria = currentCriteria.filter(c => c.weight > 0);
  const criteriaText = activeCriteria.length > 0 
    ? `You should rank tweets based on the following criteria: ${activeCriteria.map(c => `${c.text}: ${c.weight}`).join(', ')}. Higher weighted criteria should have more impact on the final score. ` 
    : 'You should rank tweets based on how well thought and how well argued out they are. ';

  const requestBody = {
    model: selectedModel,
    messages: [
      {
        role: "system",
        content: "You are a professional tweet rater with great philosophical perspectives."
      },
      {
        role: "user",
        content: `${criteriaText}Rank the following tweets on a scale of 1-10. Respond with only the numeric ratings, separated by commas.\n\n${tweets.map((tweet, index) => `Tweet ${index + 1}: "${tweet.text}"`).join('\n\n')}`
      }
    ],
    temperature: 0
  };

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error(`OpenAI API call failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return tweets.map(tweet => ({ id: tweet.id, rating: -10 }));
    }

    const data = await response.json();
    const ratings = data.choices[0].message.content.split(',').map(r => {
      const rating = parseInt(r.trim());
      return isNaN(rating) ? -100 : rating;
    });

    return tweets.map((tweet, index) => ({ 
      id: tweet.id.toString(), 
      rating: ratings[index] 
    }));

  } catch (error) {
    console.error('Error in OpenAI API call:', error);
    return tweets.map(tweet => ({ id: tweet.id, rating: -4 }));
  }
}

// Update message listener to handle model selection
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateApiKey') {
    console.log(`Configuration updated`);
    API_KEY = request.apiKey;
    selectedModel = request.selectedModel;
    if (request.criteria) {
      currentCriteria = request.criteria;
    }
    
    sendResponse({ status: 'API key, model, and criteria updated' });
    return true;
  }

  if (request.action === 'rankTweets') {
    if (!isPaused) {
      currentTabId = sender.tab.id;
      request.tweets.forEach(tweet => {
        pendingTweets.push(tweet);
      });
      processTweets();
    }
    return true; // Indicates that the response is sent asynchronously
  }

  if (request.action === 'togglePause') {
    isPaused = request.isPaused;
    if (!isPaused) {
      processTweets(); // Resume processing if there are pending tweets
    }
    return true;
  }
});

async function processTweets() {
  if (isPaused || processingTweets || (pendingTweets.length === 0 && unrankedTweets.length === 0)) return;

  if (!API_KEY) {
    return;
  }

  processingTweets = true;
  const tweetsToProcess = [...unrankedTweets, ...pendingTweets.splice(0, 10 - unrankedTweets.length)];
  unrankedTweets = [];

  try {
    const ratings = await rankTweets(tweetsToProcess);
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

function scheduleRetry() {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
  }
  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    processTweets();
  }, 5000);
}


// Initialize the API key from storage when the script loads
chrome.storage.sync.get(['apiKey', 'isPaused', 'rankingCriteria'], (data) => {
  if (data.apiKey) {
    API_KEY = data.apiKey;
  }
  if (data.rankingCriteria && Array.isArray(data.rankingCriteria)) {
    currentCriteria = data.rankingCriteria;
  } else {
    currentCriteria = [
      { text: 'thoughtfulness', weight: 0 },
      { text: 'creativity', weight: 0 },
      { text: 'uniqueness', weight: 0 },
      { text: 'humor', weight: 0 }
    ];
  }
  isPaused = data.isPaused || false;
});