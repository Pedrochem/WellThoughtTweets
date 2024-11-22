const saveButton = document.getElementById('save');
const apiKeyInput = document.getElementById('apiKey');
const hideLowRankTweetsSelect = document.getElementById('hideLowRankTweets');
const colorfulRanksCheckbox = document.getElementById('colorfulRanks');
const pauseResumeButton = document.getElementById('pauseResume');
const toggleApiVisibility = document.querySelector('.toggle-api-visibility');
const MODEL_CONFIGS = {
  'gemini-1.5-flash-latest': {
    name: 'gemini-1.5-flash (free)',
    placeholder: 'Paste your Google AI Studio API key',
    apiKeyLink: 'https://aistudio.google.com/app/apikey',
    linkText: 'Get your Google AI Studio key',
    description: 'Please ensure you are using a Google AI Studio API key for the Gemini model.'
  },
  'gpt-4o-mini': {
    name: 'gpt-4o-mini',
    placeholder: 'Paste your OpenAI API key',
    apiKeyLink: 'https://platform.openai.com/api-keys',
    linkText: 'Get your OpenAI API key',
    description: 'Please ensure you are using an OpenAI API key for GPT models.'
  },
  'gpt-4o': {
    name: 'gpt-4o',
    placeholder: 'Paste your OpenAI API key',
    apiKeyLink: 'https://platform.openai.com/api-keys',
    linkText: 'Get your OpenAI API key',
    description: 'Please ensure you are using an OpenAI API key for GPT models.'
  }
};
const modelSelect = document.getElementById('modelSelect');
const apiKeyLink = document.getElementById('apiKeyLink');
const apiKeyLinkText = document.getElementById('apiKeyLinkText');

class CriteriaManager {
  constructor() {
    this.criteriaList = document.getElementById('criteria-list');
    this.addButton = document.getElementById('add-criteria');
    this.originalState = null;
    this.setupEventListeners();
    
    // Load initial state and criteria
    this.initializeState();
  }

  // New method to handle initial state loading
  initializeState() {
    chrome.storage.sync.get(
      ['apiKey', 'selectedModel', 'hideLowRankTweets', 'colorfulRanks', 'isPaused', 'rankingCriteria'],
      (data) => {
        // Set default model to Gemini if no model is selected
        const selectedModel = data.selectedModel || 'gemini-1.5-flash-latest';
        modelSelect.value = selectedModel;
        
        // Get config for selected model (will be Gemini by default)
        const config = MODEL_CONFIGS[selectedModel];
        apiKeyInput.placeholder = config.placeholder;
        apiKeyLink.href = config.apiKeyLink;
        apiKeyLinkText.textContent = config.linkText;
        document.getElementById('apiKeyDescription').textContent = config.description;

        if (data.apiKey) {
          apiKeyInput.dataset.fullKey = data.apiKey;
          apiKeyInput.value = maskApiKey(data.apiKey);
          toggleApiVisibility.innerHTML = '<i class="fas fa-eye"></i>';
        }
        
        hideLowRankTweetsSelect.value = data.hideLowRankTweets || '1';
        colorfulRanksCheckbox.checked = data.colorfulRanks !== undefined ? data.colorfulRanks : true;
        
        // Load criteria
        const defaultCriteria = [{ text: 'Thoughtfulness', weight: 1 }];
        const criteria = Array.isArray(data.rankingCriteria) && data.rankingCriteria.length > 0 
          ? data.rankingCriteria 
          : defaultCriteria;

        this.criteriaList.innerHTML = '';
        criteria.forEach((criterion, index) => {
          const validCriterion = {
            text: criterion.text || (index === 0 ? 'Thoughtfulness' : ''),
            weight: criterion.weight !== undefined ? criterion.weight : 1
          };
          this.criteriaList.appendChild(this.createCriteriaItem(validCriterion, index === 0));
        });

        // Set the original state AFTER everything is initialized
        this.originalState = this.getCurrentState();
        
        // Ensure save button is disabled initially
        const saveButton = document.getElementById('save');
        saveButton.disabled = true;
        saveButton.textContent = 'Saved';
      }
    );
  }

  getCurrentState() {
    return {
      apiKey: apiKeyInput.value,
      selectedModel: modelSelect.value,
      hideLowRankTweets: hideLowRankTweetsSelect.value,
      colorfulRanks: colorfulRanksCheckbox.checked,
      criteria: this.getCriteria()
    };
  }

  hasStateChanged() {
    if (!this.originalState) return false;

    const currentState = this.getCurrentState();

    if (currentState.apiKey !== this.originalState.apiKey ||
        currentState.selectedModel !== this.originalState.selectedModel ||
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

  createCriteriaItem(criterion = { text: 'Thoughtfulness', weight: 0 }, isFirst = false) {
    const item = document.createElement('div');
    item.className = 'criteria-item';
    item.setAttribute('data-weight', criterion.weight);
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
          <span class="weight-value">${criterion.weight}</span>
          <input type="range" 
                 class="weight-slider" 
                 min="0" 
                 max="5" 
                 value="${criterion.weight}" 
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
      const item = this.createCriteriaItem({ text: '', weight: 1 }, false);
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

  checkForChanges() {
    const saveButton = document.getElementById('save');
    const hasChanges = this.hasStateChanged();
    const hasEmptyCriteria = Array.from(this.criteriaList.querySelectorAll('.criteria-input'))
      .some(input => input.value.trim() === '');
    
    // Check if at least one criterion has weight > 0
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
  const selectedModel = modelSelect.value;
  const hideLowRankTweets = hideLowRankTweetsSelect.value;
  const colorfulRanks = colorfulRanksCheckbox.checked;
  const criteria = criteriaManager.getCriteria();

  chrome.storage.sync.set({
    apiKey: fullKey,
    selectedModel,
    hideLowRankTweets,
    colorfulRanks,
    rankingCriteria: criteria
  }, () => {
    chrome.runtime.sendMessage({ 
      action: 'updateApiKey', 
      apiKey: fullKey,
      selectedModel,
      criteria: criteria
    }, () => {
      // Send message to clear rankings
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'clearRankings' });
      });

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

modelSelect.addEventListener('change', () => {
  const selectedModel = modelSelect.value;
  const config = MODEL_CONFIGS[selectedModel];
  
  apiKeyInput.placeholder = config.placeholder;
  apiKeyLink.href = config.apiKeyLink;
  apiKeyLinkText.textContent = config.linkText;
  document.getElementById('apiKeyDescription').textContent = config.description;
  
  criteriaManager.checkForChanges();
});