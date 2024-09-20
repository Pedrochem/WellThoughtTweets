const GEMINI_API_KEY = 'AIzaSyBuHfr0rp1nfagprjSsuuY097QkA0gHsOQ';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'rankTweet') {
    rankTweetWithGemini(request.tweetText)
      .then(rating => sendResponse({ rating }))
      .catch(error => {
        console.error('Error ranking tweet:', error);
        sendResponse({ rating: -1 });
      });
    return true; // Indicates that the response is sent asynchronously
  }
});

async function rankTweetWithGemini(tweetText) {
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Rate the following tweet on a scale of 1-10 based on how well thought out it is. Respond with only the numeric rating.\n\nTweet: "${tweetText}"`
        }]
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const ratingText = data.candidates[0].content.parts[0].text;
  const rating = parseInt(ratingText);

  return isNaN(rating) ? 5 : Math.min(Math.max(rating, 1), 10);
}