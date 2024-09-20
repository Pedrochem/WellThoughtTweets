function addRankingToTweet(tweetElement, ranking) {
    let rankContainer = tweetElement.querySelector('.tweet-ranker-container');
    
    if (!rankContainer) {
        const actionBar = tweetElement.querySelector('div[role="group"]');
        if (!actionBar) return;

        rankContainer = document.createElement('div');
        rankContainer.className = 'tweet-ranker-container';
        rankContainer.style.display = 'flex';
        rankContainer.style.alignItems = 'center';
        rankContainer.style.marginRight = '16px';
        rankContainer.style.position = 'relative'; // For positioning the tooltip

        const rankText = document.createElement('span');
        rankText.className = 'tweet-ranker-rating';
        rankContainer.appendChild(rankText);

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

        actionBar.insertBefore(rankContainer, actionBar.firstChild);
    }

    const rankText = rankContainer.querySelector('.tweet-ranker-rating');
    rankText.textContent = ranking === null ? '.../ 10' : `${ranking}/10`;
    rankText.style.fontSize = '13px';
    rankText.style.fontWeight = 'bold';
    rankText.style.color = 'rgb(83, 100, 113)';
}

async function processTweet(tweet) {
    if (!tweet.hasAttribute('data-ranked')) {
      const tweetText = tweet.querySelector('div[data-testid="tweetText"]')?.textContent;
      if (tweetText) {
        let ranking;
        try {
          ranking = await getRanking(tweetText);
        } catch (error) {
          console.error('Error getting ranking:', error);
          ranking = -1;
        }
        addRankingToTweet(tweet, ranking);
        tweet.setAttribute('data-ranked', 'true');
      }
    }
}

async function getRanking(tweetText) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'rankTweet', tweetText }, (response) => {
        if (response.rating === -1) {
          reject(new Error('Error ranking tweet'));
        } else {
          resolve(response.rating);
        }
      });
    });
}

async function processTweets() {
    // Use a more specific selector to target only main tweets (posts)
    const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-ranked="true"]):not([data-testid*="reply"])');
    const tweetsToRank = [];

    tweets.forEach(tweet => {
        const tweetText = tweet.querySelector('div[data-testid="tweetText"]')?.textContent;
        if (tweetText) {
            tweetsToRank.push(tweetText);
            if (!tweet.hasAttribute('data-ranked')) {
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
        const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-ranked="true"]):not([data-testid*="reply"])');
        message.ratings.forEach((rating, index) => {
            if (tweets[index]) {
                addRankingToTweet(tweets[index], rating);
                tweets[index].setAttribute('data-ranked', rating === null ? 'pending' : 'true');
            }
        });
    }
});

// Run processTweets immediately and then every 2 seconds
processTweets();
setInterval(processTweets, 2000);

// Modify the MutationObserver to only process main tweets
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && 
                    node.matches('article[data-testid="tweet"]:not([data-testid*="reply"])')) {
                    processTweets(); // Process all unranked tweets when a new one is added
                }
            });
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });

console.log('Tweet Thought Ranker content script loaded');