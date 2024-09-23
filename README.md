# Well Thought Tweets

Welcome to **Well Thought Tweets**, the Chrome extension that uses AI to rank tweets based on how well thought out they are. Because, you know, the internet really needed another way to judge people's thoughts.

## Features

- **Automated Tweet Ranking**: Uses Google's Gemini-1.5-flash to rank tweets on a scale of 1-10 based on their creativity, uniqueness, reflectiveness, thoughtfulness, etc. 

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the directory where you downloaded this repository.
5. Go to the options page and enter your Google AI Studio API key.

## Usage

1. Open Twitter and watch as the extension ranks tweets in real-time.


## Development

### Content Script (`content.js`)

Handles the insertion of ranking elements into tweets and communicates with the background script to fetch rankings. Because injecting JavaScript into web pages is always a good idea.

### Background Script (`background.js`)

Manages the API calls to Google's Gemini and processes the tweet rankings. Because who doesn't love a good background process eating up their CPU?

### Options Page (`options.html`, `options.js`, `options.css`)

Allows users to save their Google AI Studio API key.

### Styles (`styles.css`)

Contains the CSS for the ranking elements. 

## Contributing

Feel free to submit pull requests ~~or open issues.~~

