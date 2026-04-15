import { getDailyRng, seededShuffle, seededPick } from './prng.js';

const TRIVIAL_SUFFIXES = ['s', 'ed', 'er'];

export function isTrivialSuffix(answer, root) {
  const answerLower = answer.toLowerCase();
  const rootLower = root.toLowerCase();
  return TRIVIAL_SUFFIXES.some(suffix => answerLower === rootLower + suffix);
}

export function isValidAnswer(answer, round) {
  if (isTrivialSuffix(answer, round.root)) return false;

  const answerLower = answer.toLowerCase();
  const offered = round.offeredLetters || [];
  for (const [key, words] of Object.entries(round.expansions)) {
    if (!isKeySubsetOfOffered(key, offered)) continue;
    if (words.some(w => w.toLowerCase() === answerLower)) return true;
  }
  return false;
}

function isKeySubsetOfOffered(key, offeredLetters) {
  const available = [...offeredLetters];
  for (const ch of key) {
    const idx = available.indexOf(ch);
    if (idx === -1) return false;
    available.splice(idx, 1);
  }
  return true;
}

export function getAnswersForRound(round) {
  const results = [];
  const offered = round.offeredLetters || [];
  for (const [key, words] of Object.entries(round.expansions)) {
    if (!isKeySubsetOfOffered(key, offered)) continue;
    for (const w of words) {
      if (!isTrivialSuffix(w, round.root)) results.push(w);
    }
  }
  const commonSet = new Set(round.commonWords || []);
  if (commonSet.size === 0) return results;
  const common = [];
  const rest = [];
  for (const w of results) {
    (commonSet.has(w) ? common : rest).push(w);
  }
  return [...common, ...rest];
}

export function selectDailyPuzzle(puzzleData, dateStr) {
  const rng = getDailyRng(dateStr);
  const rounds = [];

  const pick = (pool, count) => {
    const shuffled = seededShuffle([...pool], rng);
    // If pool is smaller than count, cycle through it
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(shuffled[i % shuffled.length]);
    }
    return result;
  };

  rounds.push(...pick(puzzleData[3], 2));
  rounds.push(...pick(puzzleData[4], 3));
  rounds.push(...pick(puzzleData[5], 3));
  rounds.push(...pick(puzzleData[6], 1));

  // 7+ letter words: combine all pools of length 7+
  const sevenPlus = [];
  for (const [len, entries] of Object.entries(puzzleData)) {
    if (Number(len) >= 7) sevenPlus.push(...entries);
  }
  rounds.push(...pick(sevenPlus, 1));

  return rounds.map(entry => ({
    ...entry,
    offeredLetters: getOfferedLetters(entry, rng),
  }));
}

export function getOfferedLetters(puzzleEntry, rng) {
  // Extract unique individual letters from expansion keys (which may be multi-char like "el")
  const validLetters = [...new Set(Object.keys(puzzleEntry.expansions).join('').split(''))];
  const letters = new Set();

  // Prefer a letter that leads to a common word (top 50k)
  const commonKeys = puzzleEntry.commonKeys || [];
  const commonSingleKeys = commonKeys.filter(k => k.length === 1);
  if (commonSingleKeys.length > 0) {
    letters.add(seededPick(commonSingleKeys, rng));
  } else if (commonKeys.length > 0) {
    const commonLetters = [...new Set(commonKeys.join('').split(''))];
    letters.add(seededPick(commonLetters, rng));
  } else {
    // Fallback for data without commonKeys
    const singleLetterKeys = Object.keys(puzzleEntry.expansions).filter(k => k.length === 1);
    if (singleLetterKeys.length > 0) {
      letters.add(seededPick(singleLetterKeys, rng));
    } else {
      letters.add(seededPick(validLetters, rng));
    }
  }

  // Build pool of remaining candidates: other valid letters + alphabet
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const pool = [...new Set([...validLetters, ...alphabet])];
  const shuffled = seededShuffle([...pool], rng);

  for (const candidate of shuffled) {
    if (letters.size >= 3) break;
    if (!letters.has(candidate)) {
      letters.add(candidate);
    }
  }

  return seededShuffle([...letters], rng);
}

export function getHintLetter(round) {
  const offered = round.offeredLetters || [];
  const commonKeys = round.commonKeys || [];
  const commonWords = new Set(round.commonWords || []);
  const expansions = round.expansions || {};

  // Find offered letters that are single-char commonKeys
  const commonMatches = offered.filter(l => commonKeys.includes(l));

  if (commonMatches.length > 0) {
    // Pick the one with the most common word answers
    let best = commonMatches[0];
    let bestCount = 0;
    for (const l of commonMatches) {
      const words = expansions[l] || [];
      const count = words.filter(w => commonWords.has(w)).length;
      if (count > bestCount) {
        bestCount = count;
        best = l;
      }
    }
    return best;
  }

  // Fallback: offered letter with the most total answers
  let best = null;
  let bestCount = 0;
  for (const l of offered) {
    const words = expansions[l] || [];
    if (words.length > bestCount) {
      bestCount = words.length;
      best = l;
    }
  }
  return best;
}

export function generateShareText(results, dateStr, totalTimeMs, timerDisabled) {
  const emojis = results.map(r => {
    if (r.answer.length === 0) return '⬜';
    if (r.hinted) return '🟡';
    return '🟩';
  }).join('');
  const solved = results.filter(r => r.answer.length > 0).length;
  if (timerDisabled) {
    return `Reword ${dateStr}\n${emojis}\n${solved}/${results.length}\nrewordgame.xyz`;
  }
  const mins = Math.floor(totalTimeMs / 1000 / 60);
  const secs = Math.floor(totalTimeMs / 1000) % 60;
  return `Reword ${dateStr}\n${emojis}\n${solved}/${results.length} | ${mins}:${secs.toString().padStart(2, '0')}\nrewordgame.xyz`;
}

export function matchTypedToTiles(typedLetters, rootLetters, offeredLetters) {
  const pool = [
    ...rootLetters.map((ch, i) => ({ letter: ch.toLowerCase(), source: 'root', index: i, used: false })),
    ...offeredLetters.map((ch, i) => ({ letter: ch.toLowerCase(), source: 'offered', index: i, used: false })),
  ];

  const matched = [];
  for (const typed of typedLetters) {
    const ch = typed.toLowerCase();
    const candidate =
      pool.find(t => !t.used && t.letter === ch && t.source === 'root') ||
      pool.find(t => !t.used && t.letter === ch && t.source === 'offered');
    if (candidate) {
      candidate.used = true;
      matched.push({ letter: ch, source: candidate.source, index: candidate.index, used: true });
    } else {
      matched.push({ letter: ch, source: 'invalid', index: -1, used: true });
    }
  }

  return { matched, pool };
}

export function getSubmitFeedbackType(answer, round) {
  const minLen = round.root.length + 1;
  const maxLen = round.root.length + (round.offeredLetters ? round.offeredLetters.length : 0);
  if (answer.length < minLen || answer.length > maxLen) return 'invalid-length';
  if (isValidAnswer(answer, round)) return 'correct';
  if (isTrivialSuffix(answer, round.root)) return 'trivial-suffix';
  return 'wrong';
}

export function isConsecutiveDay(todayStr, previousStr) {
  const today = new Date(todayStr + 'T00:00:00Z');
  const previous = new Date(previousStr + 'T00:00:00Z');
  return today.getTime() - previous.getTime() === 86400000;
}

export function updateStreakStats(existingStats, todayDateStr) {
  if (!existingStats) {
    return { currentStreak: 1, maxStreak: 1, lastPlayedDate: todayDateStr, gamesPlayed: 1 };
  }
  if (existingStats.lastPlayedDate === todayDateStr) {
    return existingStats;
  }
  const consecutive = isConsecutiveDay(todayDateStr, existingStats.lastPlayedDate);
  const currentStreak = consecutive ? existingStats.currentStreak + 1 : 1;
  const maxStreak = Math.max(currentStreak, existingStats.maxStreak);
  return {
    currentStreak,
    maxStreak,
    lastPlayedDate: todayDateStr,
    gamesPlayed: existingStats.gamesPlayed + 1,
  };
}

export function removeLetterAt(letters, index) {
  return [...letters.slice(0, index), ...letters.slice(index + 1)];
}

export function processKeyPress(currentLetters, key, maxLen) {
  if (key === 'Backspace') return currentLetters.slice(0, -1);
  if (key.length === 1 && /^[a-z]$/i.test(key)) {
    if (currentLetters.length >= maxLen) return currentLetters;
    return [...currentLetters, key.toLowerCase()];
  }
  return currentLetters;
}

export function isAllSolved(results) {
  return results.length === 10 && results.every(r => r.answer.length > 0);
}

export function calculateScore(completedRounds) {
  return {
    totalLetters: completedRounds.reduce((sum, r) => sum + r.answer.length, 0),
    totalTimeMs: completedRounds.reduce((sum, r) => sum + r.timeMs, 0),
    roundsCompleted: completedRounds.length,
  };
}

export function updateLifetimeStats(existingStats, completedRounds, totalTimeMs, timerDisabled) {
  const solvedRounds = completedRounds.filter(r => r.answer.length > 0);
  const gameLetters = solvedRounds.reduce((sum, r) => sum + r.answer.length, 0);
  const gameWords = solvedRounds.length;
  const gameSkips = completedRounds.filter(r => r.answer.length === 0).length;
  const gameHints = completedRounds.filter(r => r.hinted).length;
  const gameLongestWord = solvedRounds.reduce(
    (longest, r) => r.answer.length > longest.length ? r.answer : longest, ''
  );
  const isPerfect = completedRounds.length === 10 && gameSkips === 0 && gameHints === 0 && !timerDisabled;

  if (!existingStats) {
    return {
      totalLetters: gameLetters,
      totalWords: gameWords,
      fastestTimeMs: isPerfect ? totalTimeMs : null,
      totalTimeMs,
      gamesPlayed: 1,
      bestLetterScore: gameLetters,
      longestWord: gameLongestWord,
      totalSkips: gameSkips,
      totalHints: gameHints,
      perfectGamesPlayed: isPerfect ? 1 : 0,
      perfectGamesTotalTimeMs: isPerfect ? totalTimeMs : 0,
    };
  }

  const prevFastest = existingStats.fastestTimeMs;
  let newFastest;
  if (!isPerfect) {
    newFastest = prevFastest;
  } else if (prevFastest === null) {
    newFastest = totalTimeMs;
  } else {
    newFastest = Math.min(prevFastest, totalTimeMs);
  }

  return {
    totalLetters: existingStats.totalLetters + gameLetters,
    totalWords: existingStats.totalWords + gameWords,
    fastestTimeMs: newFastest,
    totalTimeMs: existingStats.totalTimeMs + totalTimeMs,
    gamesPlayed: existingStats.gamesPlayed + 1,
    bestLetterScore: Math.max(existingStats.bestLetterScore, gameLetters),
    longestWord: gameLongestWord.length > existingStats.longestWord.length
      ? gameLongestWord : existingStats.longestWord,
    totalSkips: existingStats.totalSkips + gameSkips,
    totalHints: (existingStats.totalHints || 0) + gameHints,
    perfectGamesPlayed: (existingStats.perfectGamesPlayed || 0) + (isPerfect ? 1 : 0),
    perfectGamesTotalTimeMs: (existingStats.perfectGamesTotalTimeMs || 0) + (isPerfect ? totalTimeMs : 0),
  };
}

export function formatCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getTimeUntilMidnightUTC() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.getTime() - now.getTime();
}
