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
    rankText.textContent = `${ranking}/10`;
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
    const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-ranked])');
    for (const tweet of tweets) {
      await processTweet(tweet);
    }
  }
  
  // Run processTweets immediately and then every 2 seconds
  processTweets();
  setInterval(processTweets, 2000);
  
  // Also use a MutationObserver to catch newly added tweets
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches('article[data-testid="tweet"]')) {
            processTweet(node);
          }
        });
      }
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  console.log('Tweet Thought Ranker content script loaded');