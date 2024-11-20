const saveButton = document.getElementById('save');
const apiKeyInput = document.getElementById('apiKey');
const hideLowRankTweetsSelect = document.getElementById('hideLowRankTweets');
const colorfulRanksCheckbox = document.getElementById('colorfulRanks');
const pauseResumeButton = document.getElementById('pauseResume');
const toggleApiVisibility = document.querySelector('.toggle-api-visibility');

class CriteriaManager {
  constructor() {
    this.criteriaList = document.getElementById('criteria-list');
    this.addButton = document.getElementById('add-criteria');
    this.originalState = null;
    this.setupEventListeners();
    this.loadCriteria();
  }

  getCurrentState() {
    return {
      apiKey: apiKeyInput.value,
      hideLowRankTweets: hideLowRankTweetsSelect.value,
      colorfulRanks: colorfulRanksCheckbox.checked,
      criteria: this.getCriteria()
    };
  }

  hasStateChanged() {
    if (!this.originalState) return false;

    const currentState = this.getCurrentState();

    if (currentState.apiKey !== this.originalState.apiKey ||
        currentState.hideLowRankTweets !== this.originalState.hideLowRankTweets ||
        currentState.colorfulRanks !== this.originalState.colorfulRanks) {
      return true;
    }

    if (currentState.criteria.length !== this.originalState.criteria.length) {
      return true;
    }

    return currentState.criteria.some((criterion, index) => {
      const original = this.originalState.criteria[index];
      return criterion.text !== original.text || criterion.weight !== original.weight;
    });
  }

  createCriteriaItem(criterion = { text: 'Thoughtfulness', weight: 1 }, isFirst = false) {
    const item = document.createElement('div');
    item.className = 'criteria-item';
    item.setAttribute('data-weight', criterion.weight || 1);
    item.innerHTML = `
      <div class="criteria-input-container">
        <input type="text" 
               class="criteria-input" 
               placeholder="${isFirst ? 'Enter main criterion' : 'Enter criterion'}" 
               value="${criterion.text}"
               required>
      </div>
      <div class="weight-control">
        <div class="slider-container">
          <label class="weight-label">Weight</label>
          <span class="weight-value">${criterion.weight || 1}</span>
          <input type="range" 
                 class="weight-slider" 
                 min="0" 
                 max="5" 
                 value="${criterion.weight || 1}" 
                 step="1">
        </div>
      </div>
      <div class="criteria-button-container">
        ${!isFirst ? `
          <button class="criteria-button delete" title="Remove">
            <i class="fas fa-times"></i>
          </button>
        ` : `
          <div class="criteria-button-placeholder"></div>
        `}
      </div>
    `;

    const input = item.querySelector('.criteria-input');
    
    if (!isFirst) {
      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          item.remove();
          this.checkForChanges();
        }
      });
    }

    input.addEventListener('input', (e) => {
      if (e.target.value.trim() === '') {
        e.target.classList.add('invalid');
      } else {
        e.target.classList.remove('invalid');
      }
      this.checkForChanges();
    });

    const slider = item.querySelector('.weight-slider');
    const weightValue = item.querySelector('.weight-value');
    
    slider.addEventListener('input', (e) => {
      const weight = e.target.value;
      weightValue.textContent = weight;
      item.setAttribute('data-weight', weight);
      this.checkForChanges();
    });

    return item;
  }

  setupEventListeners() {
    this.addButton.addEventListener('click', () => {
      const item = this.createCriteriaItem({ text: '', weight: 0 }, false);
      this.criteriaList.appendChild(item);
      const input = item.querySelector('.criteria-input');
      input.focus();
      this.checkForChanges();
    });
    
    this.criteriaList.addEventListener('click', (e) => {
      const item = e.target.closest('.criteria-item');
      if (!item) return;

      if (e.target.closest('.delete')) {
        if (this.criteriaList.children.length > 1) {
          item.remove();
          this.checkForChanges();
        } else {
          const input = item.querySelector('.criteria-input');
          input.value = 'Thoughtfulness';
          const slider = item.querySelector('.weight-slider');
          slider.value = 0;
          const weightValue = item.querySelector('.weight-value');
          weightValue.textContent = '0';
          this.checkForChanges();
        }
      }
    });
  }

  addCriterion() {
    const item = this.createCriteriaItem();
    this.criteriaList.appendChild(item);
    item.querySelector('.criteria-input').focus();
    this.checkForChanges();
  }

  getCriteria() {
    return Array.from(this.criteriaList.children)
      .map(item => {
        const text = item.querySelector('.criteria-input').value.trim();
        const weight = parseInt(item.querySelector('.weight-slider').value);
        return { text, weight };
      })
      .filter(c => c.text !== '');
  }

  loadCriteria() {
    chrome.storage.sync.get(['rankingCriteria'], (data) => {
      const defaultCriteria = [
        { text: 'Thoughtfulness', weight: 1 }
      ];
      
      this.criteriaList.innerHTML = '';
      
      const criteria = Array.isArray(data.rankingCriteria) && data.rankingCriteria.length > 0 
        ? data.rankingCriteria 
        : defaultCriteria;

      criteria.forEach((criterion, index) => {
        const validCriterion = {
          text: criterion.text || (index === 0 ? 'Thoughtfulness' : ''),
          weight: Number.isInteger(criterion.weight) ? criterion.weight : 1
        };
        this.criteriaList.appendChild(this.createCriteriaItem(validCriterion, index === 0));
      });

      this.originalState = this.getCurrentState();
    });
  }

  checkForChanges() {
    const saveButton = document.getElementById('save');
    const hasChanges = this.hasStateChanged();
    const hasEmptyCriteria = Array.from(this.criteriaList.querySelectorAll('.criteria-input'))
      .some(input => input.value.trim() === '');
    
    const hasActiveCriterion = Array.from(this.criteriaList.querySelectorAll('.weight-slider'))
      .some(slider => parseInt(slider.value) > 0);

    const isValid = !hasEmptyCriteria && hasActiveCriterion;
    saveButton.disabled = !hasChanges || !isValid;
    
    if (hasEmptyCriteria) {
      saveButton.textContent = 'Fill all criteria';
    } else if (!hasActiveCriterion) {
      saveButton.textContent = 'At least one active criterion needed';
    } else {
      saveButton.textContent = hasChanges ? 'Save' : 'Saved';
    }
  }
}

const criteriaManager = new CriteriaManager();

function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 8) return key;
  const firstPart = key.slice(0, 4);
  const lastPart = key.slice(-4);
  const middleLength = key.length - 8;
  const middlePart = '*'.repeat(middleLength);
  return `${firstPart}${middlePart}${lastPart}`;
}

// Initialize API key from storage
chrome.storage.sync.get(['apiKey'], (data) => {
  if (data.apiKey) {
    const fullKey = data.apiKey;
    apiKeyInput.dataset.fullKey = fullKey;
    apiKeyInput.value = maskApiKey(fullKey);
    toggleApiVisibility.innerHTML = '<i class="fas fa-eye"></i>';
  }
});

// Handle API key input
apiKeyInput.addEventListener('input', (e) => {
  const value = e.target.value;
  e.target.dataset.fullKey = value;
  criteriaManager.checkForChanges();
});

// Handle visibility toggle
toggleApiVisibility.addEventListener('click', () => {
  const fullKey = apiKeyInput.dataset.fullKey || apiKeyInput.value;
  const isShowingMasked = apiKeyInput.value.includes('*');
  
  if (isShowingMasked) {
    apiKeyInput.value = fullKey;
    toggleApiVisibility.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    apiKeyInput.value = maskApiKey(fullKey);
    toggleApiVisibility.innerHTML = '<i class="fas fa-eye"></i>';
  }
});

// Update save button handler
saveButton.addEventListener('click', () => {
  const fullKey = apiKeyInput.dataset.fullKey || apiKeyInput.value;
  const hideLowRankTweets = hideLowRankTweetsSelect.value;
  const colorfulRanks = colorfulRanksCheckbox.checked;
  const criteria = criteriaManager.getCriteria();

  chrome.storage.sync.set({
    apiKey: fullKey,
    hideLowRankTweets,
    colorfulRanks,
    rankingCriteria: criteria
  }, () => {
    chrome.runtime.sendMessage({ 
      action: 'updateApiKey', 
      apiKey: fullKey,
      criteria: criteria
    }, () => {
      criteriaManager.originalState = criteriaManager.getCurrentState();
      criteriaManager.checkForChanges();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.reload(tabs[0].id);
        window.close();
      });
    });
  });
});

hideLowRankTweetsSelect.addEventListener('change', () => criteriaManager.checkForChanges());
colorfulRanksCheckbox.addEventListener('change', () => criteriaManager.checkForChanges());

chrome.storage.sync.get(
  ['apiKey', 'hideLowRankTweets', 'colorfulRanks', 'isPaused'],
  (data) => {
    if (data.apiKey) {
      const fullKey = data.apiKey;
      apiKeyInput.dataset.fullKey = fullKey;
      apiKeyInput.value = maskApiKey(fullKey);
      toggleApiVisibility.innerHTML = '<i class="fas fa-eye"></i>';
    }
    if (data.hideLowRankTweets !== undefined) {
      hideLowRankTweetsSelect.value = data.hideLowRankTweets;
    } else {
      hideLowRankTweetsSelect.value = '1';
    }
    if (data.colorfulRanks !== undefined) {
      colorfulRanksCheckbox.checked = data.colorfulRanks;
    } else {
      colorfulRanksCheckbox.checked = true;
    }
    
    hideLowRankTweetsSelect.style.visibility = 'visible';
    
    if (data.isPaused) {
      pauseResumeButton.textContent = 'Resume Ranking';
      pauseResumeButton.style.backgroundColor = '#4CAF50';
    } else {
      pauseResumeButton.textContent = 'Pause Ranking';
      pauseResumeButton.style.backgroundColor = '#FF9900';
    }
    
    criteriaManager.checkForChanges();
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