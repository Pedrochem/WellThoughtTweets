function addRankingToTweet(tweetElement, ranking) {
    const actionBar = tweetElement.querySelector('div[role="group"]');
    if (!actionBar) return;
  
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
    rankText.style.color = 'rgb(83, 100, 113)';
    
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
}

// async function processTweet(tweet) {
//     if (!tweet.hasAttribute('data-ranked')) {
//       const tweetText = tweet.querySelector('div[data-testid="tweetText"]')?.textContent;
//       if (tweetText) {
//         let ranking;
//         try {
//           ranking = await getRanking(tweetText);
//         } catch (error) {
//           console.error('Error getting ranking:', error);
//           ranking = -1;
//         }
//         addRankingToTweet(tweet, ranking);
//         tweet.setAttribute('data-ranked', 'true');
//       }
//     }
// }

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

function processTweets() {
    // Only select tweets that haven't been ranked or are not pending
    const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-ranked]):not([data-ranked="pending"]):not([data-testid*="reply"])');
    const tweetsToRank = [];
    console.log('Tweets selected for ranking:', tweets);

    tweets.forEach(tweet => {
        const tweetText = tweet.querySelector('div[data-testid="tweetText"]')?.textContent;
        if (tweetText) {
            tweetsToRank.push(tweetText);
            tweet.setAttribute('data-ranked', 'pending');
        }
    });

    if (tweetsToRank.length > 0) {
        console.log('Hey');
        chrome.runtime.sendMessage({ action: 'rankTweets', tweets: tweetsToRank });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'tweetRatings') {
        const tweets = document.querySelectorAll('article[data-testid="tweet"][data-ranked="pending"]:not([data-testid*="reply"])');
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
setInterval(processTweets, 5000);

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