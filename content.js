//TODO: Review
function addRankingToTweet(tweetElement, ranking) {
    const actionBar = tweetElement.querySelector('div[role="group"]');
    if (!actionBar) return;

    // Check if ranking container already exists
    let rankContainer = tweetElement.querySelector('.tweet-ranker-container');
    if (!rankContainer) {
        rankContainer = document.createElement('div');
        rankContainer.className = 'tweet-ranker-container';
        rankContainer.style.display = 'flex';
        rankContainer.style.alignItems = 'center';
        rankContainer.style.marginRight = '16px';
        rankContainer.style.position = 'relative'; // For positioning the tooltip
        actionBar.insertBefore(rankContainer, actionBar.firstChild);
    }

    chrome.storage.sync.get(['hideLowRankTweets', 'colorfulRanks'], (data) => {
        const hideThreshold = parseInt(data.hideLowRankTweets, 10);
        const colorfulRanks = data.colorfulRanks;

        // Handle hiding low-ranked tweets
        if (hideThreshold && hideThreshold > 0 && ranking !== null && ranking <= hideThreshold) {
            tweetElement.style.display = 'none';
            return;
        }

        // Update or create rank text
        let rankText = rankContainer.querySelector('.tweet-ranker-rating');
        if (!rankText) {
            rankText = document.createElement('span');
            rankText.className = 'tweet-ranker-rating';
            rankContainer.appendChild(rankText);
        }

        // Set rank text content and style
        if (ranking === null) {
            rankText.textContent = 'Pending';
        } else if (ranking === undefined) {
            rankText.textContent = 'Error';
        } else if (ranking === -1) {
            rankText.textContent = 'Unsafe';
        } else if (ranking >= 0 && ranking <= 10) {
            rankText.textContent = `${ranking}/10`;
        } else {
            rankText.textContent = 'Error';
        }
        rankText.style.fontSize = '13px';
        rankText.style.fontWeight = 'bold';
        rankText.style.color = getRankColor(ranking, colorfulRanks);

        // Add or update tooltip
        if (!rankContainer.querySelector('.tweet-ranker-tooltip')) {
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
        }

        // Set title for built-in tooltip
        rankContainer.title = 'Well Thought Rank';
    });
}

function getTweetId(tweetElement) {
    const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
    if (tweetLink) {
        const urlParts = tweetLink.href.split('/');
        const statusIndex = urlParts.indexOf('status');
        if (statusIndex !== -1 && statusIndex + 1 < urlParts.length) {
            const tweetId = urlParts[statusIndex + 1];
            return tweetId.toString(); // Ensure ID is a string
        }
    }
    return null;
}

function processTweets() {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-ranked]):not([data-ranked="pending"]):not([data-testid*="reply"])');
    const tweetsToRank = [];

    tweets.forEach(tweet => {
        const tweetText = tweet.querySelector('div[data-testid="tweetText"]')?.textContent;
        const tweetId = getTweetId(tweet);
        if (tweetId) {
            const storedRanking = localStorage.getItem(`tweet-ranking-${tweetId}`);
            if (storedRanking !== null && parseInt(storedRanking) > 0 && parseInt(storedRanking) <= 10) {
                addRankingToTweet(tweet, parseInt(storedRanking));
                tweet.setAttribute('data-ranked', 'true');
            } else if (hasEmptyText(tweetText, tweetId)) {
                addRankingToTweet(tweet, 0);
                tweet.setAttribute('data-ranked', 'true');
            } else if (tweetText) {
                tweetsToRank.push({ id: tweetId, text: tweetText });
                tweet.setAttribute('data-ranked', 'pending');
            } else {
                // Handle empty tweetText as emoji-only
                addRankingToTweet(tweet, 0);
                tweet.setAttribute('data-ranked', 'true');
            }
        }
    });

    if (tweetsToRank.length > 0) {
        chrome.runtime.sendMessage({ action: 'rankTweets', tweets: tweetsToRank });
    }
}

function hasEmptyText(text, id) {
    if (!text) {
        return true;
    }
    return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'tweetRatings') {
        const tweets = document.querySelectorAll('article[data-testid="tweet"]');
        const tweetMap = new Map();
        tweets.forEach(tweet => {
            const tweetId = getTweetId(tweet);
            if (tweetId) {
                tweetMap.set(tweetId, tweet);
            }
        });

        message.ratings.forEach(({ id, rating }) => {
            const tweet = tweetMap.get(id.toString()); // Ensure ID is a string
            if (tweet) {
                if (rating >= -1 && rating <= 10) {
                    // Valid rating
                    addRankingToTweet(tweet, rating);
                    tweet.setAttribute('data-ranked', 'true');
                    localStorage.setItem(`tweet-ranking-${id.toString()}`, rating);
                } else if (rating === null) {
                    // Pending rating
                    addRankingToTweet(tweet, 'Pending...');
                    tweet.setAttribute('data-ranked', 'pending');
                } else {
                    // Error rating (-2, -3, -4)
                    addRankingToTweet(tweet, 'Error');
                    tweet.removeAttribute('data-ranked'); // Remove the data-ranked attribute to allow reprocessing
                    localStorage.removeItem(`tweet-ranking-${id.toString()}`); // Remove any stored ranking
                }
            } 
        });
    }
    if (message.action === 'clearRankings') {
        console.log('Clearing tweets!!!!');
        let clearedCount = 0;
        for (let key in localStorage) {
            if (key.startsWith('tweet-ranking-')) {
                localStorage.removeItem(key);
                clearedCount++;
            }
        }
        console.log('Cleared', clearedCount, 'items from localStorage');
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



function getRankColor(ranking, colorfulRanks) {
  if (!colorfulRanks) {
    return 'rgb(83, 100, 113)'; // Default color
  }
  if (ranking === null || ranking === undefined) {
    return 'rgb(83, 100, 113)'; // Default color for pending or error states
  }
  if (ranking >= 8) return '#32CD32';
  if (ranking >= 7) return '#228B22';
  if (ranking >= 5) return '#3CB371';
  if (ranking >= 3) return '#6B8E23';
  if (ranking >= 1) return '#024731';
  return 'rgb(83, 100, 113)'; // Default color for any other case
}
