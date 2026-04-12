export function letterSignature(word) {
  return word.toLowerCase().split('').sort().join('');
}

// Build a map from signature -> [words] for fast lookup
export function buildSignatureIndex(dictionary) {
  const index = new Map();
  for (const word of dictionary) {
    const sig = letterSignature(word);
    if (!index.has(sig)) index.set(sig, []);
    index.get(sig).push(word.toLowerCase());
  }
  return index;
}

export function findExpansions(root, dictionaryOrIndex, maxExtraLetters = 3) {
  // Accept either an array (original API) or a pre-built index
  const index = dictionaryOrIndex instanceof Map
    ? dictionaryOrIndex
    : buildSignatureIndex(dictionaryOrIndex);

  const rootLower = root.toLowerCase();
  const rootSig = letterSignature(rootLower);
  const expansions = {};

  for (let numExtra = 1; numExtra <= maxExtraLetters; numExtra++) {
    for (const combo of combinationsWithRepetition(numExtra)) {
      let targetSig = rootSig;
      for (const ch of combo) {
        targetSig = insertSorted(targetSig, ch);
      }
      const matches = index.get(targetSig);
      if (matches) {
        const key = combo.join('');
        expansions[key] = [...matches];
      }
    }
  }

  return expansions;
}

function* combinationsWithRepetition(size, start = 0) {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = start; i < 26; i++) {
    for (const rest of combinationsWithRepetition(size - 1, i)) {
      yield [String.fromCharCode(97 + i), ...rest];
    }
  }
}

function insertSorted(sortedStr, char) {
  for (let i = 0; i < sortedStr.length; i++) {
    if (char <= sortedStr[i]) {
      return sortedStr.slice(0, i) + char + sortedStr.slice(i);
    }
  }
  return sortedStr + char;
}

