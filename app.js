const ROUND_TIME_SECONDS = 600;
const VERB_BANK_PATH = "./verb-bank.json";

let verbBank = [];
let currentVerbs = [];
let timerInterval = null;
let furiganaOn = false;
let lastAnswerData = [];

const startBtn = document.getElementById("startBtn");
const checkBtn = document.getElementById("checkBtn");
const toggleFuriganaBtn = document.getElementById("toggleFurigana");
const formSelect = document.getElementById("formSelect");
const roundSizeSelect = document.getElementById("roundSizeSelect");
const timerEl = document.getElementById("timer");
const tbody = document.querySelector("#verbTable tbody");
const resultsEl = document.getElementById("results");
const explanationsEl = document.getElementById("explanations");
const missedOnlyToggle = document.getElementById("missedOnlyToggle");
const bankStatusEl = document.getElementById("bankStatus");

startBtn.addEventListener("click", startRound);
checkBtn.addEventListener("click", checkAnswers);
toggleFuriganaBtn.addEventListener("click", toggleFurigana);
missedOnlyToggle.addEventListener("change", renderExplanations);

boot();

async function boot() {
  await loadBundledVerbBank();
}

async function loadBundledVerbBank() {
  try {
    const response = await fetch(VERB_BANK_PATH);
    if (!response.ok) {
      throw new Error(`Could not load ${VERB_BANK_PATH}`);
    }

    const data = await response.json();
    const parsed = sanitizeVerbBank(data);

    if (!parsed.length) {
      throw new Error("The bundled verb bank did not contain valid entries.");
    }

    verbBank = parsed;
    bankStatusEl.textContent = `Loaded ${verbBank.length} verbs from verb-bank.json`;
  } catch (error) {
    console.error(error);
    verbBank = getFallbackVerbBank();
    bankStatusEl.innerHTML = `Could not load <strong>verb-bank.json</strong>. Fallback bank loaded instead.`;
  }
}

function sanitizeVerbBank(items) {
  if (!Array.isArray(items)) return [];

  return items.map(item => ({
    kanji: String(item.kanji || "").trim(),
    reading: String(item.reading || "").trim(),
    type: normalizeVerbType(String(item.type || "").trim()),
    level: String(item.level || "").trim()
  })).filter(item => item.kanji && item.reading && item.type);
}

function startRound() {
  if (!verbBank.length) {
    bankStatusEl.textContent = "No verb bank is loaded yet.";
    return;
  }

  clearInterval(timerInterval);
  resultsEl.textContent = "";
  explanationsEl.innerHTML = "";
  missedOnlyToggle.checked = false;
  lastAnswerData = [];

  const roundSize = Number(roundSizeSelect.value);
  currentVerbs = shuffle([...verbBank]).slice(0, Math.min(roundSize, verbBank.length));
  tbody.innerHTML = "";

  currentVerbs.forEach((verb, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${renderVerbCell(verb)}</td>
      <td class="answer-cell">
        <input type="text" data-index="${index}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" placeholder="Type answer here" />
      </td>
    `;
    tbody.appendChild(row);
  });

  timerEl.textContent = formatTime(ROUND_TIME_SECONDS);
  startTimer(ROUND_TIME_SECONDS);
}

function renderVerbCell(verb) {
  return `<div class="verb-display"><ruby>${escapeHtml(verb.kanji)}<rt class="${furiganaOn ? "" : "hidden"}">${escapeHtml(verb.reading)}</rt></ruby></div>`;
}

function toggleFurigana() {
  furiganaOn = !furiganaOn;
  toggleFuriganaBtn.textContent = `Reading Support: ${furiganaOn ? "On" : "Off"}`;
  const rows = tbody.querySelectorAll("tr");
  rows.forEach((row, index) => {
    row.children[0].innerHTML = renderVerbCell(currentVerbs[index]);
  });
}

function startTimer(seconds) {
  let timeLeft = seconds;
  timerEl.textContent = formatTime(timeLeft);
  timerInterval = setInterval(() => {
    timeLeft -= 1;
    timerEl.textContent = formatTime(Math.max(0, timeLeft));
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      checkAnswers();
    }
  }, 1000);
}

function checkAnswers() {
  clearInterval(timerInterval);
  const targetForm = formSelect.value;
  const inputs = tbody.querySelectorAll("input");
  let correctCount = 0;

  lastAnswerData = currentVerbs.map((verb, index) => {
    const rawAnswer = inputs[index].value.trim();
    const normalizedAnswer = normalizeText(rawAnswer);
    const correctKana = conjugateSurface(verb.reading, verb.type, targetForm);
    const correctKanji = conjugateSurface(verb.kanji, verb.type, targetForm);
    const acceptedAnswers = new Set([correctKana, correctKanji].map(normalizeText).filter(Boolean));
    const isCorrect = acceptedAnswers.has(normalizedAnswer);
    if (isCorrect) correctCount += 1;
    return {
      verb,
      userAnswer: rawAnswer,
      correctKana,
      correctKanji,
      isCorrect,
      rule: getRule(verb, targetForm),
      pattern: `${verb.reading} → ${correctKana}`
    };
  });

  resultsEl.textContent = `Score: ${correctCount}/${currentVerbs.length}`;
  renderExplanations();
}

function renderExplanations() {
  if (!lastAnswerData.length) {
    explanationsEl.innerHTML = "";
    return;
  }

  const visibleItems = missedOnlyToggle.checked ? lastAnswerData.filter(item => !item.isCorrect) : lastAnswerData;
  if (!visibleItems.length) {
    explanationsEl.innerHTML = `<div class="small-note">Everything was correct for this round.</div>`;
    return;
  }

  explanationsEl.innerHTML = visibleItems.map(item => {
    const userLine = item.userAnswer ? escapeHtml(item.userAnswer) : '<span class="muted">(blank)</span>';
    const kanjiLine = item.correctKanji !== item.correctKana ? `<div>Accepted kanji answer: <strong>${escapeHtml(item.correctKanji)}</strong></div>` : "";
    return `
      <article class="explanation-card">
        <div><strong>${escapeHtml(item.verb.kanji)}</strong> (${escapeHtml(item.verb.reading)})</div>
        <div>Correct hiragana answer: <strong>${escapeHtml(item.correctKana)}</strong></div>
        ${kanjiLine}
        <div>Your answer: <span class="${item.isCorrect ? "correct" : "incorrect"}">${userLine}</span></div>
        <div class="muted">${escapeHtml(item.rule)}</div>
        <div class="muted">${escapeHtml(item.pattern)}</div>
      </article>`;
  }).join("");
}

function normalizeVerbType(type) {
  const value = type.toLowerCase();
  if (["ichidan", "godan", "suru", "kuru", "irregular"].includes(value)) return value;
  if (value === "する") return "suru";
  if (value === "くる" || value === "来る") return "kuru";
  return "";
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, "").replace(/　/g, "");
}

function conjugateSurface(surface, type, form) {
  if (form === "masu") {
    if (type === "ichidan") return surface.slice(0, -1) + "ます";
    if (type === "godan") return changeGodanEnding(surface, "i") + "ます";
    if (type === "suru" || type === "irregular") return surface.replace(/する$/, "します");
    if (type === "kuru") return surface.replace(/くる$|来る$/, match => match === "来る" ? "来ます" : "きます");
  }
  if (form === "te") {
    if (type === "ichidan") return surface.slice(0, -1) + "て";
    if (type === "suru" || type === "irregular") return surface.replace(/する$/, "して");
    if (type === "kuru") return surface.replace(/くる$|来る$/, match => match === "来る" ? "来て" : "きて");
    return toTeTaSurface(surface, "te");
  }
  if (form === "ta") {
    if (type === "ichidan") return surface.slice(0, -1) + "た";
    if (type === "suru" || type === "irregular") return surface.replace(/する$/, "した");
    if (type === "kuru") return surface.replace(/くる$|来る$/, match => match === "来る" ? "来た" : "きた");
    return toTeTaSurface(surface, "ta");
  }
  if (form === "nai") {
    if (type === "ichidan") return surface.slice(0, -1) + "ない";
    if (type === "suru" || type === "irregular") return surface.replace(/する$/, "しない");
    if (type === "kuru") return surface.replace(/くる$|来る$/, match => match === "来る" ? "来ない" : "こない");
    return toNaiSurface(surface);
  }
  if (form === "potential") {
    if (type === "ichidan") return surface.slice(0, -1) + "られる";
    if (type === "godan") return changeGodanEnding(surface, "e") + "る";
    if (type === "suru" || type === "irregular") return surface.replace(/する$/, "できる");
    if (type === "kuru") return surface.replace(/くる$|来る$/, match => match === "来る" ? "来られる" : "こられる");
  }
  return surface;
}

function changeGodanEnding(surface, row) {
  const last = surface.slice(-1);
  const map = {
    i: { "う": "い", "く": "き", "ぐ": "ぎ", "す": "し", "つ": "ち", "ぬ": "に", "ぶ": "び", "む": "み", "る": "り" },
    e: { "う": "え", "く": "け", "ぐ": "げ", "す": "せ", "つ": "て", "ぬ": "ね", "ぶ": "べ", "む": "め", "る": "れ" }
  };
  return surface.slice(0, -1) + (map[row][last] || last);
}

function toNaiSurface(surface) {
  const last = surface.slice(-1);
  if (last === "う") return surface.slice(0, -1) + "わない";
  const map = { "く": "かない", "ぐ": "がない", "す": "さない", "つ": "たない", "ぬ": "なない", "ぶ": "ばない", "む": "まない", "る": "らない" };
  return surface.slice(0, -1) + (map[last] || "");
}

function toTeTaSurface(surface, formKind) {
  const ending = surface.slice(-1);
  if (surface === "いく" || surface === "行く") return surface.slice(0, -1) + (formKind === "te" ? "って" : "った");
  if (["う", "つ", "る"].includes(ending)) return surface.slice(0, -1) + (formKind === "te" ? "って" : "った");
  if (["む", "ぶ", "ぬ"].includes(ending)) return surface.slice(0, -1) + (formKind === "te" ? "んで" : "んだ");
  if (ending === "く") return surface.slice(0, -1) + (formKind === "te" ? "いて" : "いた");
  if (ending === "ぐ") return surface.slice(0, -1) + (formKind === "te" ? "いで" : "いだ");
  if (ending === "す") return surface.slice(0, -1) + (formKind === "te" ? "して" : "した");
  return surface;
}

function getRule(verb, form) {
  if (form === "masu") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add ます.";
    if (verb.type === "godan") return "Godan: change the final sound to the い-row and add ます.";
    if (verb.type === "suru" || verb.type === "irregular") return "する becomes します.";
    if (verb.type === "kuru") return "くる / 来る becomes きます / 来ます.";
  }
  if (form === "te") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add て.";
    if (verb.type === "godan") return "Godan: use the standard て-form sound change rules.";
    if (verb.type === "suru" || verb.type === "irregular") return "する becomes して.";
    if (verb.type === "kuru") return "くる / 来る becomes きて / 来て.";
  }
  if (form === "ta") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add た.";
    if (verb.type === "godan") return "Godan: use the standard た-form sound change rules.";
    if (verb.type === "suru" || verb.type === "irregular") return "する becomes した.";
    if (verb.type === "kuru") return "くる / 来る becomes きた / 来た.";
  }
  if (form === "nai") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add ない.";
    if (verb.type === "godan") return "Godan: change the final sound to the あ-row and add ない. う becomes わ.";
    if (verb.type === "suru" || verb.type === "irregular") return "する becomes しない.";
    if (verb.type === "kuru") return "くる / 来る becomes こない / 来ない.";
  }
  if (form === "potential") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add られる.";
    if (verb.type === "godan") return "Godan: change the final sound to the え-row and add る.";
    if (verb.type === "suru" || verb.type === "irregular") return "する becomes できる.";
    if (verb.type === "kuru") return "くる / 来る becomes こられる / 来られる.";
  }
  return "";
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getFallbackVerbBank() {
  return [
    { kanji: "食べる", reading: "たべる", type: "ichidan", level: "N5" },
    { kanji: "見る", reading: "みる", type: "ichidan", level: "N5" },
    { kanji: "起きる", reading: "おきる", type: "ichidan", level: "N5" },
    { kanji: "寝る", reading: "ねる", type: "ichidan", level: "N5" },
    { kanji: "開ける", reading: "あける", type: "ichidan", level: "N5" },
    { kanji: "閉める", reading: "しめる", type: "ichidan", level: "N5" },
    { kanji: "教える", reading: "おしえる", type: "ichidan", level: "N4" },
    { kanji: "借りる", reading: "かりる", type: "ichidan", level: "N4" },
    { kanji: "書く", reading: "かく", type: "godan", level: "N5" },
    { kanji: "聞く", reading: "きく", type: "godan", level: "N5" },
    { kanji: "話す", reading: "はなす", type: "godan", level: "N5" },
    { kanji: "待つ", reading: "まつ", type: "godan", level: "N5" },
    { kanji: "読む", reading: "よむ", type: "godan", level: "N5" },
    { kanji: "遊ぶ", reading: "あそぶ", type: "godan", level: "N5" },
    { kanji: "死ぬ", reading: "しぬ", type: "godan", level: "N4" },
    { kanji: "取る", reading: "とる", type: "godan", level: "N5" },
    { kanji: "買う", reading: "かう", type: "godan", level: "N5" },
    { kanji: "泳ぐ", reading: "およぐ", type: "godan", level: "N4" },
    { kanji: "急ぐ", reading: "いそぐ", type: "godan", level: "N4" },
    { kanji: "持つ", reading: "もつ", type: "godan", level: "N5" },
    { kanji: "立つ", reading: "たつ", type: "godan", level: "N5" },
    { kanji: "帰る", reading: "かえる", type: "godan", level: "N5" },
    { kanji: "入る", reading: "はいる", type: "godan", level: "N5" },
    { kanji: "座る", reading: "すわる", type: "godan", level: "N5" },
    { kanji: "行く", reading: "いく", type: "godan", level: "N5" },
    { kanji: "する", reading: "する", type: "suru", level: "N5" },
    { kanji: "勉強する", reading: "べんきょうする", type: "suru", level: "N5" },
    { kanji: "運動する", reading: "うんどうする", type: "suru", level: "N4" },
    { kanji: "来る", reading: "くる", type: "kuru", level: "N5" }
  ];
}
