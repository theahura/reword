import { isValidAnswer, calculateScore, getAnswersForRound, generateShareText, matchTypedToTiles, getSubmitFeedbackType, updateStreakStats, processKeyPress } from './game.js';
import { getAudioContext, initSound } from './sound.js';

const SCRABBLE_POINTS = {
  a:1, b:3, c:3, d:2, e:1, f:4, g:2, h:4, i:1, j:8, k:5, l:1, m:3,
  n:1, o:1, p:3, q:10, r:1, s:1, t:1, u:1, v:4, w:4, x:8, y:4, z:10
};

function createTile(letter, opts = {}) {
  const tile = document.createElement('div');
  tile.className = 'tile' + (opts.className ? ' ' + opts.className : '');
  if (letter) {
    tile.textContent = letter.toUpperCase();
    const points = document.createElement('span');
    points.className = 'points';
    points.textContent = SCRABBLE_POINTS[letter.toLowerCase()] || '';
    tile.appendChild(points);
  }
  if (opts.onClick) tile.addEventListener('click', opts.onClick);
  return tile;
}

export function initUI(puzzle, dateStr) {
  const container = document.getElementById('game-container');
  container.innerHTML = '';

  const state = {
    currentRound: 0,
    completedRounds: [],
    inputLetters: [],
    startTime: null,
    roundStartTime: null,
    timerInterval: null,
    transitioning: false,
  };

  // Sound setup (lazy — initialized on first user interaction)
  let audio = null;
  function ensureAudio() {
    if (audio) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    audio = initSound(ctx);
    const savedMute = localStorage.getItem('anagram-trainer-sound-muted');
    if (savedMute === '1') audio.setMuted(true);
    updateMuteButton();
  }
  function playSound(name) {
    if (!audio) return;
    audio.sounds[name]();
  }

  // Header
  const header = document.createElement('header');
  header.innerHTML = '<h1>Anagram Trainer</h1>';
  container.appendChild(header);

  // Mute toggle button
  const muteBtn = document.createElement('button');
  muteBtn.id = 'mute-btn';
  muteBtn.setAttribute('role', 'switch');
  muteBtn.setAttribute('aria-label', 'Sound');
  const savedMuteState = localStorage.getItem('anagram-trainer-sound-muted') === '1';
  muteBtn.setAttribute('aria-checked', String(!savedMuteState));
  muteBtn.textContent = savedMuteState ? '\u{1F507}' : '\u{1F50A}';
  header.appendChild(muteBtn);

  function updateMuteButton() {
    if (!audio) return;
    const muted = audio.isMuted();
    muteBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
    muteBtn.setAttribute('aria-checked', String(!muted));
  }

  muteBtn.addEventListener('click', () => {
    ensureAudio();
    if (!audio) return;
    audio.setMuted(!audio.isMuted());
    try { localStorage.setItem('anagram-trainer-sound-muted', audio.isMuted() ? '1' : '0'); } catch (e) {}
    updateMuteButton();
  });

  // Game info bar
  const gameInfo = document.createElement('div');
  gameInfo.className = 'game-info';
  gameInfo.innerHTML = `
    <span id="round-indicator">Round 1 of 10</span>
    <span id="letter-score">Letters: 0</span>
    <span id="timer">0:00</span>
  `;
  container.appendChild(gameInfo);

  // Root word section
  const rootLabel = document.createElement('div');
  rootLabel.className = 'section-label';
  rootLabel.textContent = 'Root Word';
  container.appendChild(rootLabel);

  const rootRack = document.createElement('div');
  rootRack.className = 'tile-rack';
  rootRack.id = 'root-rack';
  container.appendChild(rootRack);

  // Offered letters section
  const offeredLabel = document.createElement('div');
  offeredLabel.className = 'section-label';
  offeredLabel.textContent = 'Add Letters';
  container.appendChild(offeredLabel);

  const offeredRack = document.createElement('div');
  offeredRack.className = 'tile-rack';
  offeredRack.id = 'offered-rack';
  container.appendChild(offeredRack);

  // Instructions
  const instructions = document.createElement('div');
  instructions.className = 'instructions';
  instructions.textContent = 'Type a new word using all root letters + one or more offered letters';
  container.appendChild(instructions);

  // Input area
  const inputArea = document.createElement('div');
  inputArea.id = 'input-area';
  container.appendChild(inputArea);

  // Hidden input for keyboard
  const hiddenInput = document.createElement('input');
  hiddenInput.id = 'hidden-input';
  hiddenInput.type = 'text';
  hiddenInput.autocomplete = 'off';
  hiddenInput.autocapitalize = 'off';
  hiddenInput.setAttribute('inputmode', 'text');
  hiddenInput.setAttribute('enterkeyhint', 'go');
  container.appendChild(hiddenInput);

  // Message area
  const message = document.createElement('div');
  message.id = 'message';
  container.appendChild(message);

  // Submit button
  const submitBtn = document.createElement('button');
  submitBtn.id = 'submit-btn';
  submitBtn.textContent = 'Submit';
  container.appendChild(submitBtn);

  // Skip button
  const skipBtn = document.createElement('button');
  skipBtn.id = 'skip-btn';
  skipBtn.textContent = 'Skip';
  container.appendChild(skipBtn);

  // Virtual keyboard for touch devices
  const keyboard = document.createElement('div');
  keyboard.id = 'virtual-keyboard';
  const keyRows = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['Enter','z','x','c','v','b','n','m','Backspace'],
  ];
  for (const row of keyRows) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'keyboard-row';
    for (const key of row) {
      const btn = document.createElement('button');
      btn.className = 'keyboard-key';
      btn.setAttribute('type', 'button');
      if (key === 'Backspace') {
        btn.textContent = '\u232B';
        btn.classList.add('key-wide');
        btn.dataset.key = 'Backspace';
      } else if (key === 'Enter') {
        btn.textContent = '\u23CE';
        btn.classList.add('key-wide');
        btn.dataset.key = 'Enter';
      } else {
        btn.textContent = key.toUpperCase();
        btn.dataset.key = key;
      }
      rowDiv.appendChild(btn);
    }
    keyboard.appendChild(rowDiv);
  }
  container.appendChild(keyboard);

  // Score screen
  const scoreScreen = document.createElement('div');
  scoreScreen.id = 'score-screen';
  container.appendChild(scoreScreen);

  function renderRound() {
    const round = puzzle[state.currentRound];
    document.getElementById('round-indicator').textContent =
      `Round ${state.currentRound + 1} of 10`;

    // Root tiles
    rootRack.innerHTML = '';
    for (const letter of round.root) {
      rootRack.appendChild(createTile(letter));
    }

    // Offered letter tiles
    offeredRack.innerHTML = '';
    for (const letter of round.offeredLetters) {
      offeredRack.appendChild(createTile(letter, { className: 'offered' }));
    }

    // Clear input
    state.inputLetters = [];
    renderInput();
    setMessage('');

    // Focus hidden input
    hiddenInput.value = '';
    hiddenInput.focus();
  }

  function renderInput() {
    inputArea.innerHTML = '';
    const round = puzzle[state.currentRound];
    const minLen = round.root.length + 1;
    const displayLen = Math.max(minLen, state.inputLetters.length);

    const { matched, pool } = matchTypedToTiles(
      state.inputLetters,
      round.root.split(''),
      round.offeredLetters
    );

    for (let i = 0; i < displayLen; i++) {
      if (i < state.inputLetters.length) {
        const cls = matched[i].source === 'invalid' ? 'invalid' : '';
        inputArea.appendChild(createTile(state.inputLetters[i], { className: cls }));
      } else {
        inputArea.appendChild(createTile('', { className: 'empty' }));
      }
    }

    // Update rack tile highlights
    const rootTiles = rootRack.querySelectorAll('.tile');
    rootTiles.forEach((tile, i) => {
      tile.classList.toggle('used', pool[i] && pool[i].used);
    });

    const offeredTiles = offeredRack.querySelectorAll('.tile');
    offeredTiles.forEach((tile, i) => {
      const poolIdx = round.root.length + i;
      tile.classList.toggle('used', pool[poolIdx] && pool[poolIdx].used);
    });
  }

  function setMessage(text, type = '') {
    message.textContent = text;
    message.className = type ? `${type}` : '';
    message.id = 'message';
  }

  function startTimer() {
    if (!state.startTime) {
      state.startTime = Date.now();
    }
    state.roundStartTime = Date.now();

    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      const elapsed = Date.now() - state.startTime;
      const seconds = Math.floor(elapsed / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      document.getElementById('timer').textContent =
        `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 100);
  }

  function updateLetterScore() {
    const total = state.completedRounds.reduce((sum, r) => sum + r.answer.length, 0);
    document.getElementById('letter-score').textContent = `Letters: ${total}`;
  }

  function triggerShake() {
    inputArea.classList.remove('shake');
    void inputArea.offsetWidth;
    inputArea.classList.add('shake');
    inputArea.addEventListener('animationend', () => {
      inputArea.classList.remove('shake');
    }, { once: true });
  }

  function triggerBounce() {
    const tiles = inputArea.querySelectorAll('.tile');
    tiles.forEach((tile, i) => tile.style.setProperty('--tile-index', i));
    inputArea.classList.add('bounce');
    const lastTile = tiles[tiles.length - 1];
    if (lastTile) {
      lastTile.addEventListener('animationend', () => {
        inputArea.classList.remove('bounce');
      }, { once: true });
    }
  }

  function handleSubmit() {
    ensureAudio();
    if (state.transitioning) return;
    if (state.currentRound >= 10) return;
    if (!state.startTime) startTimer();
    const round = puzzle[state.currentRound];
    const answer = state.inputLetters.join('');
    const feedback = getSubmitFeedbackType(answer, round);

    if (feedback === 'invalid-length') {
      const minLen = round.root.length + 1;
      const maxLen = round.root.length + round.offeredLetters.length;
      setMessage(`Word must be ${minLen}-${maxLen} letters`, 'error');
      playSound('playWrong');
      triggerShake();
      return;
    }

    if (feedback === 'wrong') {
      setMessage('Not a valid answer. Try again!', 'error');
      playSound('playWrong');
      triggerShake();
      return;
    }

    const timeMs = Date.now() - state.roundStartTime;
    const possibleAnswers = getAnswersForRound(round);
    state.completedRounds.push({ answer, timeMs, root: round.root, possibleAnswers });
    updateLetterScore();
    setMessage('Correct!', 'success');
    playSound('playCorrect');
    triggerBounce();
    state.transitioning = true;
    setTimeout(() => advanceRound(), 700);
  }

  function handleSkip() {
    ensureAudio();
    if (state.transitioning) return;
    if (state.currentRound >= 10) return;
    if (!state.startTime) startTimer();
    const round = puzzle[state.currentRound];
    const timeMs = Date.now() - state.roundStartTime;
    const possibleAnswers = getAnswersForRound(round);
    state.completedRounds.push({ answer: '', timeMs, root: round.root, possibleAnswers });
    updateLetterScore();
    playSound('playSkip');
    if (possibleAnswers.length > 0) {
      setMessage(`Possible: ${possibleAnswers.slice(0, 3).join(', ')}`, '');
      state.transitioning = true;
      setTimeout(() => advanceRound(), 1200);
    } else {
      setMessage('Skipped', '');
      state.transitioning = true;
      advanceRound();
    }
  }

  function fadeOutGameArea() {
    rootRack.classList.add('fade-out');
    offeredRack.classList.add('fade-out');
    inputArea.classList.add('fade-out');
  }

  function fadeInGameArea() {
    rootRack.classList.remove('fade-out');
    offeredRack.classList.remove('fade-out');
    inputArea.classList.remove('fade-out');
    rootRack.classList.add('fade-in');
    offeredRack.classList.add('fade-in');
    inputArea.classList.add('fade-in');

    const cleanup = () => {
      rootRack.classList.remove('fade-in');
      offeredRack.classList.remove('fade-in');
      inputArea.classList.remove('fade-in');
    };
    rootRack.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 300);
  }

  function advanceRound() {
    state.currentRound++;
    if (state.currentRound >= 10) {
      showScore();
      return;
    }
    fadeOutGameArea();
    setTimeout(() => {
      renderRound();
      fadeInGameArea();
      startTimer();
      state.transitioning = false;
    }, 600);
  }

  function showScore(savedResults) {
    clearInterval(state.timerInterval);

    const results = savedResults || state.completedRounds;
    const totalTimeMs = savedResults
      ? results.reduce((sum, r) => sum + r.timeMs, 0)
      : Date.now() - state.startTime;
    const completed = results.filter(r => r.answer.length > 0);
    const score = calculateScore(completed);

    const mins = Math.floor(totalTimeMs / 1000 / 60);
    const secs = Math.floor(totalTimeMs / 1000) % 60;

    // Hide game elements
    rootRack.parentElement.querySelectorAll('.section-label, .tile-rack, #input-area, #submit-btn, #skip-btn, .instructions, #virtual-keyboard')
      .forEach(el => el.style.display = 'none');

    // Build per-round HTML
    let roundsHtml = '<div class="rounds-summary">';
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const solved = r.answer.length > 0;
      const statusClass = solved ? 'solved' : 'skipped';
      const answerDisplay = solved ? r.answer.toUpperCase() : 'SKIPPED';
      const possibleDisplay = !solved && r.possibleAnswers && r.possibleAnswers.length > 0
        ? `<span class="possible-answers">${r.possibleAnswers.join(', ')}</span>`
        : '';

      roundsHtml += `
        <div class="round-result ${statusClass}">
          <span class="round-num">${i + 1}</span>
          <span class="round-root">${r.root.toUpperCase()}</span>
          <span class="round-arrow">&rarr;</span>
          <span class="round-answer">${answerDisplay}</span>
          ${possibleDisplay}
        </div>`;
    }
    roundsHtml += '</div>';

    if (!savedResults) playSound('playGameComplete');
    scoreScreen.style.display = 'block';
    scoreScreen.innerHTML = `
      <h2>Game Complete!</h2>
      <div class="stats-row">
        <div class="stat">Words Solved<br><span class="stat-value">${score.roundsCompleted} / 10</span></div>
        <div class="stat">Total Letters<br><span class="stat-value">${score.totalLetters}</span></div>
        <div class="stat">Total Time<br><span class="stat-value">${mins}:${secs.toString().padStart(2, '0')}</span></div>
      </div>
      <button id="share-btn">Share Results</button>
      ${roundsHtml}
    `;

    document.getElementById('share-btn').addEventListener('click', async () => {
      const shareText = generateShareText(results, dateStr, totalTimeMs);
      const btn = document.getElementById('share-btn');
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareText);
        } else {
          const ta = document.createElement('textarea');
          ta.value = shareText;
          document.body.appendChild(ta);
          ta.focus({ preventScroll: true });
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        btn.textContent = 'Copied!';
      } catch (e) {
        btn.textContent = 'Could not copy';
      }
      setTimeout(() => { btn.textContent = 'Share Results'; }, 2000);
    });

    // Save to localStorage if this is a fresh game (not loaded from saved)
    if (!savedResults && dateStr) {
      try {
        localStorage.setItem('anagram-trainer-' + dateStr, JSON.stringify({
          results: state.completedRounds,
          totalTimeMs,
        }));
      } catch (e) { /* localStorage might be unavailable */ }

      // Update streak stats
      try {
        const rawStats = localStorage.getItem('anagram-trainer-stats');
        const existingStats = rawStats ? JSON.parse(rawStats) : null;
        const updatedStats = updateStreakStats(existingStats, dateStr);
        localStorage.setItem('anagram-trainer-stats', JSON.stringify(updatedStats));
      } catch (e) { /* localStorage might be unavailable */ }
    }

    // Display streak stats
    try {
      const rawStats = localStorage.getItem('anagram-trainer-stats');
      if (rawStats) {
        const stats = JSON.parse(rawStats);
        const streakHtml = `
          <div class="stats-row streak-stats">
            <div class="stat">Played<br><span class="stat-value">${stats.gamesPlayed}</span></div>
            <div class="stat">Current Streak<br><span class="stat-value">${stats.currentStreak}</span></div>
            <div class="stat">Max Streak<br><span class="stat-value">${stats.maxStreak}</span></div>
          </div>
        `;
        const shareBtn = scoreScreen.querySelector('#share-btn');
        shareBtn.insertAdjacentHTML('beforebegin', streakHtml);
      }
    } catch (e) { /* localStorage might be unavailable */ }
  }

  function handleKeyInput(key) {
    ensureAudio();
    if (state.currentRound >= 10) return;
    if (!state.startTime) startTimer();
    if (key === 'Enter') {
      handleSubmit();
      return;
    }
    const round = puzzle[state.currentRound];
    const maxLen = round.root.length + round.offeredLetters.length;
    const prevLen = state.inputLetters.length;
    state.inputLetters = processKeyPress(state.inputLetters, key, maxLen);
    if (state.inputLetters.length !== prevLen) playSound('playKeyClick');
    hiddenInput.value = state.inputLetters.join('');
    renderInput();
    setMessage('');
  }

  // Physical keyboard handling
  hiddenInput.addEventListener('input', (e) => {
    ensureAudio();
    if (state.currentRound >= 10) return;
    if (!state.startTime) startTimer();
    const round = puzzle[state.currentRound];
    const maxLen = round.root.length + round.offeredLetters.length;
    const val = e.target.value.toLowerCase().replace(/[^a-z]/g, '');
    const prevLen = state.inputLetters.length;
    state.inputLetters = val.slice(0, maxLen).split('');
    if (state.inputLetters.length !== prevLen) playSound('playKeyClick');
    hiddenInput.value = state.inputLetters.join('');
    renderInput();
    setMessage('');
  });

  hiddenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  });

  // Virtual keyboard handling
  keyboard.addEventListener('click', (e) => {
    const btn = e.target.closest('.keyboard-key');
    if (!btn) return;
    handleKeyInput(btn.dataset.key);
  });

  submitBtn.addEventListener('click', handleSubmit);
  skipBtn.addEventListener('click', handleSkip);

  // Keep focus on hidden input (desktop only — avoid triggering native keyboard on touch devices)
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (!isTouchDevice) {
    container.addEventListener('click', () => hiddenInput.focus());
  }

  // Check if today's puzzle was already completed
  if (dateStr) {
    try {
      const saved = localStorage.getItem('anagram-trainer-' + dateStr);
      if (saved) {
        const { results } = JSON.parse(saved);
        showScore(results);
        return;
      }
    } catch (e) { /* localStorage might be unavailable */ }
  }

  // Start
  renderRound();
  hiddenInput.focus();
}
