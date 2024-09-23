function addRankingToTweet(tweetElement, ranking) {
    const actionBar = tweetElement.querySelector('div[role="group"]');
    if (!actionBar) return;

    // Hide tweet if ranking is below 3 and the user has opted in
    chrome.storage.sync.get('hideLowRankTweets', (data) => {
        if (data.hideLowRankTweets && ranking < 3) {
            tweetElement.style.display = 'none';
            return;
        }

        const rankContainer = document.createElement('div');
        rankContainer.className = 'tweet-ranker-container';
        rankContainer.style.display = 'flex';
        rankContainer.style.alignItems = 'center';
        rankContainer.style.marginRight = '16px';
        rankContainer.style.position = 'relative'; // For positioning the tooltip

        const rankText = document.createElement('span');
        rankText.className = 'tweet-ranker-rating';
        rankText.textContent = ranking === null ? '.../ 10' : `${ranking}/10`;
        rankText.style.fontSize = '13px';
        rankText.style.fontWeight = 'bold';
        rankText.style.color = getRankColor(ranking); // Set color based on ranking

        // Add tooltip functionality
        rankContainer.title = 'Well Thought Rank';

        // Create a custom tooltip (optional, for more styling control)
        const tooltip = document.createElement('div');
        tooltip.className = 'tweet-ranker-tooltip';
        tooltip.textContent = 'Well Thought Rank';
        tooltip.style.display = 'none';
        rankContainer.appendChild(tooltip);

        rankContainer.addEventListener('mouseenter', () => {
            tooltip.style.display = 'block';
        });

        rankContainer.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });

        rankContainer.appendChild(rankText);
        rankContainer.appendChild(tooltip);

        actionBar.insertBefore(rankContainer, actionBar.firstChild);
    });
}

function getTweetId(tweetElement) {
    const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
    if (tweetLink) {
        console.log('Full tweet link:', tweetLink.href);
        const urlParts = tweetLink.href.split('/');
        const statusIndex = urlParts.indexOf('status');
        if (statusIndex !== -1 && statusIndex + 1 < urlParts.length) {
            const tweetId = urlParts[statusIndex + 1];
            console.log('Extracted tweet ID:', tweetId);
            return tweetId.toString(); // Ensure ID is a string
        }
    }
    console.log('No valid tweet ID found');
    return null;
}

function processTweets() {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-ranked]):not([data-ranked="pending"]):not([data-testid*="reply"])');
    const tweetsToRank = [];
    console.log('Tweets selected for ranking:', tweets);

    tweets.forEach(tweet => {
        const tweetText = tweet.querySelector('div[data-testid="tweetText"]')?.textContent;
        const tweetId = getTweetId(tweet);
        if (tweetText && tweetId) {
            const storedRanking = localStorage.getItem(`tweet-ranking-${tweetId}`);
            if (storedRanking !== null && tweetId !== '1') {
                addRankingToTweet(tweet, parseInt(storedRanking));
                console.log('Tweet selected already has rank!',tweet, storedRanking, 'FULL-ID:',tweetId);
                tweet.setAttribute('data-ranked', 'true');
            } else {
                tweetsToRank.push({ id: tweetId, text: tweetText });
                tweet.setAttribute('data-ranked', 'pending');
            }
        }
    });

    if (tweetsToRank.length > 0) {
        chrome.runtime.sendMessage({ action: 'rankTweets', tweets: tweetsToRank });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'tweetRatings') {
        console.log('Received tweet ratings:', message.ratings);

        // const tweets = document.querySelectorAll('article[data-testid="tweet"][data-ranked="pending"]:not([data-testid*="reply"])');
        const tweets = document.querySelectorAll('article[data-testid="tweet"]');
        console.log('Current tweets:', tweets);

        const tweetMap = new Map();
        tweets.forEach(tweet => {
            const tweetId = getTweetId(tweet);
            if (tweetId) {
                tweetMap.set(tweetId, tweet);
            }
        });
        console.log('Current tweets id maps:', tweetMap);

        message.ratings.forEach(({ id, rating }) => {
            const tweet = tweetMap.get(id.toString()); // Ensure ID is a string
            if (tweet) {
                addRankingToTweet(tweet, rating);
                tweet.setAttribute('data-ranked', rating === null ? 'pending' : 'true');
                localStorage.setItem(`tweet-ranking-${id.toString()}`, rating); // Ensure ID is a string
            } else {
                console.warn(`Warning: Received rating for tweet ID ${id}, but couldn't find matching tweet element.`);
              }
        });
    }
});

// Run processTweets immediately and then every 5 seconds
processTweets();
setInterval(processTweets, 2000);

// Modify the MutationObserver to only process new, unranked main tweets
const observer = new MutationObserver((mutations) => {
    let newUnrankedTweetFound = false;
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && 
                    node.matches('article[data-testid="tweet"]:not([data-testid*="reply"]):not([data-ranked]):not([data-ranked="pending"])')) {
                    newUnrankedTweetFound = true;
                }
            });
        }
    });
    if (newUnrankedTweetFound) {
        processTweets(); // Process all unranked tweets when a new one is added
    }
});

observer.observe(document.body, { childList: true, subtree: true });

console.log('Tweet Thought Ranker content script loaded');

function getRankColor(ranking) {
  if (ranking >= 8) return '#32CD32';
  if (ranking >= 7) return '#228B22';
  if (ranking >= 5) return '#3CB371';
  if (ranking >= 3) return '#6B8E23';
  if (ranking >= 1) return '#024731';
  return 'rgb(83, 100, 113)'; // Default color for null or invalid ratings
}
