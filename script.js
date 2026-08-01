const SIZE = 15;
// JavaScript's weekday order is Sunday–Saturday. Distance increases through the week.
const dailyChallenges = [
  { level: 'Hardest · Sunday', a: { word: 'BRICK', row: 1, col: 0, dir: 'H' }, b: { word: 'WATER', row: 9, col: 13, dir: 'V' } },
  { level: 'Easiest · Monday', a: { word: 'LIGHT', row: 5, col: 2, dir: 'H' }, b: { word: 'STONE', row: 8, col: 7, dir: 'H' } },
  { level: 'Gentle · Tuesday', a: { word: 'MUSIC', row: 3, col: 4, dir: 'V' }, b: { word: 'DREAM', row: 9, col: 7, dir: 'H' } },
  { level: 'Easy · Wednesday', a: { word: 'RIVER', row: 2, col: 7, dir: 'V' }, b: { word: 'CLOUD', row: 9, col: 3, dir: 'H' } },
  { level: 'Medium · Thursday', a: { word: 'HOUSE', row: 2, col: 1, dir: 'H' }, b: { word: 'PLANT', row: 9, col: 9, dir: 'V' } },
  { level: 'Tricky · Friday', a: { word: 'NORTH', row: 1, col: 2, dir: 'H' }, b: { word: 'SOUND', row: 9, col: 11, dir: 'V' } },
  { level: 'Hard · Saturday', a: { word: 'CLOCK', row: 2, col: 1, dir: 'V' }, b: { word: 'FIELD', row: 12, col: 9, dir: 'H' } }
];

const boardEl = document.querySelector('#board');
const wordInput = document.querySelector('#word-input');
const rowInput = document.querySelector('#row-input');
const colInput = document.querySelector('#col-input');
const message = document.querySelector('#message');
let board, words, score, activeDateKey;
const dictionaryCache = new Map();

async function isEnglishWord(word) {
  if (dictionaryCache.has(word)) return dictionaryCache.get(word);
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
    const valid = response.ok;
    dictionaryCache.set(word, valid);
    return valid;
  } catch {
    return null;
  }
}

function cellsFor(item) {
  return [...item.word].map((letter, i) => ({
    row: item.row + (item.dir === 'V' ? i : 0),
    col: item.col + (item.dir === 'H' ? i : 0), letter
  }));
}

function resetGame() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  words = []; score = 0;
  const now = new Date();
  activeDateKey = now.toDateString();
  const challenge = dailyChallenges[now.getDay()];
  [challenge.a, challenge.b].forEach((item, idx) => {
    const entry = { ...item, id: `start-${idx}`, starter: true };
    words.push(entry);
    cellsFor(entry).forEach(cell => board[cell.row][cell.col] = { letter: cell.letter, wordIds: [entry.id], start: idx });
  });
  document.querySelector('#pair-label').innerHTML = `${challenge.a.word} <i>to</i> ${challenge.b.word}`;
  document.querySelector('#daily-label').textContent = `${now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} edition`;
  document.querySelector('#difficulty-label').textContent = challenge.level;
  wordInput.value = rowInput.value = colInput.value = '';
  setMessage('Select a square or enter a row and column.');
  update();
}

function renderBoard() {
  boardEl.innerHTML = '';
  board.forEach((row, r) => row.forEach((data, c) => {
    const cell = document.createElement('button');
    cell.className = 'cell'; cell.type = 'button';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}${data ? `, ${data.letter}` : ''}`);
    if (data) {
      cell.textContent = data.letter; cell.classList.add('filled');
      if (data.start !== undefined) cell.classList.add('start', data.start === 0 ? 'start-a' : 'start-b');
    }
    if (+rowInput.value === r + 1 && +colInput.value === c + 1) cell.classList.add('selected');
    cell.addEventListener('click', () => { rowInput.value = r + 1; colInput.value = c + 1; renderBoard(); wordInput.focus(); });
    boardEl.appendChild(cell);
  }));
}

function validate(word, row, col, dir) {
  if (!/^[A-Z]{2,15}$/.test(word)) return 'Enter a word of 2–15 letters.';
  if (words.some(entry => entry.word === word)) return `${word} has already been used. Every word may appear only once.`;
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= SIZE || col >= SIZE) return 'Choose a valid row and column.';
  const cells = cellsFor({ word, row, col, dir });
  if (cells.some(c => c.row >= SIZE || c.col >= SIZE)) return 'That word runs beyond the edge of the grid.';
  const crossedIds = new Set(); let shared = 0;
  for (const cell of cells) {
    const existing = board[cell.row][cell.col];
    if (existing) {
      if (existing.letter !== cell.letter) return `The letter at row ${cell.row + 1}, column ${cell.col + 1} does not match.`;
      shared++; existing.wordIds.forEach(id => crossedIds.add(id));
    }
  }
  if (shared < 1 || crossedIds.size < 1) return 'Your word must cross at least one word at a matching letter.';
  const before = dir === 'H' ? board[row]?.[col - 1] : board[row - 1]?.[col];
  const end = cells[cells.length - 1];
  const after = dir === 'H' ? board[end.row]?.[end.col + 1] : board[end.row + 1]?.[end.col];
  if (before || after) return 'Leave an empty square before and after your word.';
  return null;
}

async function placeWord() {
  const word = wordInput.value.trim().toUpperCase();
  const row = Number(rowInput.value) - 1, col = Number(colInput.value) - 1;
  const dir = document.querySelector('[name=direction]:checked').value;
  const error = validate(word, row, col, dir);
  if (error) return setMessage(error, 'error');
  const placeButton = document.querySelector('#place-btn');
  placeButton.disabled = true;
  placeButton.innerHTML = 'Consulting dictionary…';
  const dictionaryResult = await isEnglishWord(word);
  placeButton.disabled = false;
  placeButton.innerHTML = 'Place word <span>→</span>';
  if (dictionaryResult === false) return setMessage(`${word} was not found in the dictionary. Try another word.`, 'error');
  if (dictionaryResult === null) return setMessage('The dictionary could not be reached. Please check your connection and try again.', 'error');
  const id = `word-${words.length}`; const entry = { word, row, col, dir, id, starter: false };
  words.push(entry);
  cellsFor(entry).forEach(cell => {
    const existing = board[cell.row][cell.col];
    if (existing) existing.wordIds.push(id);
    else board[cell.row][cell.col] = { letter: cell.letter, wordIds: [id] };
  });
  score += 10 + word.length;
  wordInput.value = '';
  const connected = startersConnected();
  setMessage(connected ? `Connected! A fine bridge for ${score} points.` : `${word} placed for ${10 + word.length} points.`, 'success');
  update();
  if (connected) highlightBridge();
}

function startersConnected() {
  const graph = new Map(words.map(w => [w.id, new Set()]));
  board.flat().filter(Boolean).forEach(cell => cell.wordIds.forEach(a => cell.wordIds.forEach(b => { if (a !== b) graph.get(a).add(b); })));
  const seen = new Set(['start-0']), queue = ['start-0'];
  while (queue.length) { const cur = queue.shift(); for (const next of graph.get(cur)) if (!seen.has(next)) { seen.add(next); queue.push(next); } }
  return seen.has('start-1');
}

function highlightBridge() {
  board.flat().forEach((data, i) => { if (data && data.wordIds.some(id => !id.startsWith('start'))) boardEl.children[i].classList.add('bridge'); });
}

function setMessage(text, type = '') { message.textContent = text; message.className = `message ${type}`; }
function update() {
  renderBoard();
  const played = words.filter(w => !w.starter);
  const letters = played.reduce((n, w) => n + w.word.length, 0);
  document.querySelector('#score').textContent = score;
  document.querySelector('#word-count').textContent = played.length;
  document.querySelector('#base-cost').textContent = played.length * 10;
  document.querySelector('#letter-cost').textContent = letters;
  document.querySelector('#ledger-total').textContent = score;
}

document.querySelector('#place-btn').addEventListener('click', placeWord);
[wordInput, rowInput, colInput].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') placeWord(); }));
[rowInput, colInput].forEach(el => el.addEventListener('input', renderBoard));
wordInput.addEventListener('input', () => wordInput.value = wordInput.value.replace(/[^a-z]/gi, '').toUpperCase());
resetGame();

function updateCountdown() {
  const now = new Date();
  if (activeDateKey && now.toDateString() !== activeDateKey) resetGame();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const remaining = midnight - now;
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  document.querySelector('#next-puzzle').textContent = `Next edition in ${hours}h ${minutes}m.`;
}
updateCountdown();
setInterval(updateCountdown, 60000);
