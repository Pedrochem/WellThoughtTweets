const saveButton = document.getElementById('save');
const apiKeyInput = document.getElementById('apiKey');
const hideLowRankTweetsSelect = document.getElementById('hideLowRankTweets');
const colorfulRanksCheckbox = document.getElementById('colorfulRanks');
const pauseResumeButton = document.getElementById('pauseResume');

class CriteriaManager {
  constructor() {
    this.criteriaList = document.getElementById('criteria-list');
    this.addButton = document.getElementById('add-criteria');
    this.setupEventListeners();
    this.loadCriteria();
  }

  createCriteriaItem(criterion = { text: '', weight: 3 }) {
    const item = document.createElement('div');
    item.className = 'criteria-item';
    item.innerHTML = `
      <input type="text" class="criteria-input" placeholder="Enter criterion" value="${criterion.text}">
      <div class="weight-control">
        <div class="slider-container">
          <label class="weight-label">Weight</label>
          <span class="weight-value">${criterion.weight}</span>
          <input type="range" 
                 class="weight-slider" 
                 min="1" 
                 max="5" 
                 value="${criterion.weight}" 
                 step="1">
        </div>
      </div>
      <button class="criteria-button delete" title="Remove">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Add slider event handler
    const slider = item.querySelector('.weight-slider');
    const weightValue = item.querySelector('.weight-value');
    
    slider.addEventListener('input', (e) => {
      weightValue.textContent = e.target.value;
      this.enableSaveButton();
    });

    return item;
  }

  setupEventListeners() {
    this.addButton.addEventListener('click', () => this.addCriterion());
    
    // Delegate events for criteria items
    this.criteriaList.addEventListener('click', (e) => {
      const item = e.target.closest('.criteria-item');
      if (!item) return;

      if (e.target.closest('.delete')) {
        item.remove();
        this.enableSaveButton();
      }
    });
  }

  addCriterion() {
    const item = this.createCriteriaItem();
    this.criteriaList.appendChild(item);
    item.querySelector('input[type="text"]').focus();
    this.enableSaveButton();
  }

  getCriteria() {
    return Array.from(this.criteriaList.children).map(item => {
      const text = item.querySelector('.criteria-input').value.trim();
      const weight = parseInt(item.querySelector('.weight-slider').value);
      return { text, weight };
    }).filter(c => c.text !== '');
  }

  loadCriteria() {
    chrome.storage.sync.get(['rankingCriteria'], (data) => {
      const criteria = data.rankingCriteria || [
        { text: 'thoughtful', weight: 5 },
        { text: 'creative', weight: 4 },
        { text: 'unique', weight: 3 },
        { text: 'funny', weight: 2 }
      ];
      
      criteria.forEach(criterion => {
        this.criteriaList.appendChild(this.createCriteriaItem(criterion));
      });
    });
  }
}

// Initialize the criteria manager
const criteriaManager = new CriteriaManager();

function enableSaveButton() {
  saveButton.disabled = false;
  saveButton.textContent = 'Save';
}

function disableSaveButton() {
  saveButton.disabled = true;
  saveButton.textContent = 'Saved';
}

saveButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value;
  const hideLowRankTweets = hideLowRankTweetsSelect.value;
  const colorfulRanks = colorfulRanksCheckbox.checked;
  
  // Get criteria values and filter out empty ones
  const criteria = criteriaManager.getCriteria();

  chrome.storage.sync.set({
    apiKey,
    hideLowRankTweets,
    colorfulRanks,
    rankingCriteria: criteria
  }, () => {
    chrome.runtime.sendMessage({ 
      action: 'updateApiKey', 
      apiKey: apiKey,
      criteria: criteria
    }, () => {
      disableSaveButton();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.reload(tabs[0].id);
      });
    });
  });
});

chrome.storage.sync.get(
  ['apiKey', 'hideLowRankTweets', 'colorfulRanks', 'isPaused', 'rankingCriteria'],
  (data) => {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
    if (data.hideLowRankTweets !== undefined) {
      hideLowRankTweetsSelect.value = data.hideLowRankTweets;
    } else {
      // Set a default value if not found in storage
      hideLowRankTweetsSelect.value = '1';
    }
    if (data.colorfulRanks !== undefined) {
      colorfulRanksCheckbox.checked = data.colorfulRanks;
    } else {
      // Set default to true if not found in storage
      colorfulRanksCheckbox.checked = true;
    }
    // Show the select element after setting the value
    hideLowRankTweetsSelect.style.visibility = 'visible';
    if (data.isPaused) {
      pauseResumeButton.textContent = 'Resume Ranking';
      pauseResumeButton.style.backgroundColor = '#4CAF50';
    } else {
      pauseResumeButton.textContent = 'Pause Ranking';
      pauseResumeButton.style.backgroundColor = '#FF9900';
    }
    disableSaveButton();

    // Set criteria values
    if (data.rankingCriteria && Array.isArray(data.rankingCriteria)) {
      data.rankingCriteria.forEach((criterion, index) => {
        if (criteriaManager.criteriaList.children[index]) {
          criteriaManager.criteriaList.children[index].querySelector('.criteria-input').value = criterion.text;
          criteriaManager.criteriaList.children[index].querySelector('input[type="number"]').value = criterion.weight;
        }
      });
    } else {
      // Set default criteria
      const defaultCriteria = ['thoughtful', 'creative', 'unique', 'funny'];
      defaultCriteria.forEach((criterion, index) => {
        if (criteriaManager.criteriaList.children[index]) {
          criteriaManager.criteriaList.children[index].querySelector('.criteria-input').value = criterion;
          criteriaManager.criteriaList.children[index].querySelector('input[type="number"]').value = 5 - index;
        }
      });
    }
  }
);

pauseResumeButton.addEventListener('click', () => {
  chrome.storage.sync.get(['isPaused'], (data) => {
    const newPausedState = !data.isPaused;
    chrome.storage.sync.set({ isPaused: newPausedState }, () => {
      if (newPausedState) {
        pauseResumeButton.textContent = 'Resume Ranking';
        pauseResumeButton.style.backgroundColor = '#4CAF50';
      } else {
        pauseResumeButton.textContent = 'Pause Ranking';
        pauseResumeButton.style.backgroundColor = '#FF9900';
      }
      chrome.runtime.sendMessage({ action: 'togglePause', isPaused: newPausedState });
    });
  });
});