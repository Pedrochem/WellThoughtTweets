const GEMINI_API_KEY = 'AIzaSyBuHfr0rp1nfagprjSsuuY097QkA0gHsOQ';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

let apiCallCount = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'rankTweet') {
    rankTweetWithGemini(request.tweetText)
      .then(rating => {
        sendResponse({ rating });
        console.log(`Total API calls: ${apiCallCount}`);
      })
      .catch(error => {
        console.error('Error ranking tweet:', error);
        sendResponse({ rating: -1 });
      });
    return true; // Indicates that the response is sent asynchronously
  }
});

async function rankTweetWithGemini(tweetText) {
  apiCallCount++;
  console.log(`Making API call #${apiCallCount}`);
  console.log(`Tweet text: "${tweetText}"`);

  const requestBody = {
    contents: [{
      parts: [{
        text: `Rate the following tweet on a scale of 1-10 based on how well thought out it is. Respond with only the numeric rating.\n\nTweet: "${tweetText}"`
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

    if (!response.ok) {
      console.error(`API call #${apiCallCount} failed with status: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
      console.error(`API call #${apiCallCount} returned unexpected data structure`);
      throw new Error('Unexpected API response structure');
    }

    const ratingText = data.candidates[0].content.parts[0].text;
    const rating = parseInt(ratingText);

    if (isNaN(rating)) {
      console.warn(`API call #${apiCallCount} returned non-numeric rating: "${ratingText}"`);
      return -2; // Default to -2 if we can't parse a number
    }

    const finalRating = Math.min(Math.max(rating, 1), 10);
    console.log(`API call #${apiCallCount} successful. Rating: ${finalRating}`);

    return finalRating;
  } catch (error) {
    console.error(`Error in API call #${apiCallCount}:`, error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

// Log initial API call count
console.log('Tweet Thought Ranker background script loaded. Initial API call count: 0');