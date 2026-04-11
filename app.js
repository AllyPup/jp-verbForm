const VERB_BANK = [
  { kanji: "食べる", reading: "たべる", type: "ichidan" },
  { kanji: "見る", reading: "みる", type: "ichidan" },
  { kanji: "起きる", reading: "おきる", type: "ichidan" },
  { kanji: "寝る", reading: "ねる", type: "ichidan" },
  { kanji: "開ける", reading: "あける", type: "ichidan" },

  { kanji: "書く", reading: "かく", type: "godan" },
  { kanji: "聞く", reading: "きく", type: "godan" },
  { kanji: "話す", reading: "はなす", type: "godan" },
  { kanji: "待つ", reading: "まつ", type: "godan" },
  { kanji: "読む", reading: "よむ", type: "godan" },
  { kanji: "遊ぶ", reading: "あそぶ", type: "godan" },
  { kanji: "死ぬ", reading: "しぬ", type: "godan" },
  { kanji: "取る", reading: "とる", type: "godan" },
  { kanji: "買う", reading: "かう", type: "godan" },
  { kanji: "泳ぐ", reading: "およぐ", type: "godan" },
  { kanji: "行く", reading: "いく", type: "godan" },

  { kanji: "する", reading: "する", type: "irregular" },
  { kanji: "勉強する", reading: "べんきょうする", type: "suru" },
  { kanji: "来る", reading: "くる", type: "kuru" },
];

const ROUND_SIZE = 18;
const ROUND_TIME_SECONDS = 600;

let currentVerbs = [];
let timerInterval = null;
let furiganaOn = false;
let lastAnswerData = [];

const startBtn = document.getElementById("startBtn");
const checkBtn = document.getElementById("checkBtn");
const toggleFuriganaBtn = document.getElementById("toggleFurigana");
const formSelect = document.getElementById("formSelect");
const timerEl = document.getElementById("timer");
const tbody = document.querySelector("#verbTable tbody");
const resultsEl = document.getElementById("results");
const explanationsEl = document.getElementById("explanations");
const missedOnlyToggle = document.getElementById("missedOnlyToggle");

startBtn.addEventListener("click", startRound);
checkBtn.addEventListener("click", checkAnswers);
toggleFuriganaBtn.addEventListener("click", toggleFurigana);
missedOnlyToggle.addEventListener("change", renderExplanations);

function startRound() {
  clearInterval(timerInterval);
  resultsEl.textContent = "";
  explanationsEl.innerHTML = "";
  missedOnlyToggle.checked = false;
  lastAnswerData = [];

  currentVerbs = shuffle([...VERB_BANK]).slice(0, ROUND_SIZE);
  tbody.innerHTML = "";

  currentVerbs.forEach((verb, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${renderKanjiCell(verb)}</td>
      <td>${verb.reading}</td>
      <td>
        <input type="text" data-index="${index}" autocomplete="off" />
      </td>
    `;
    tbody.appendChild(row);
  });

  timerEl.textContent = formatTime(ROUND_TIME_SECONDS);
  startTimer(ROUND_TIME_SECONDS);
}

function renderKanjiCell(verb) {
  return `
    <ruby>
      ${verb.kanji}
      <rt class="${furiganaOn ? "" : "hidden"}">${verb.reading}</rt>
    </ruby>
  `;
}

function toggleFurigana() {
  furiganaOn = !furiganaOn;
  toggleFuriganaBtn.textContent = `Reading Support: ${furiganaOn ? "On" : "Off"}`;

  const rows = tbody.querySelectorAll("tr");
  rows.forEach((row, index) => {
    row.children[0].innerHTML = renderKanjiCell(currentVerbs[index]);
  });
}

function startTimer(seconds) {
  let timeLeft = seconds;

  timerInterval = setInterval(() => {
    timeLeft -= 1;
    timerEl.textContent = formatTime(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      checkAnswers();
    }
  }, 1000);
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function checkAnswers() {
  clearInterval(timerInterval);

  const targetForm = formSelect.value;
  const inputs = tbody.querySelectorAll("input");
  let correctCount = 0;

  lastAnswerData = currentVerbs.map((verb, index) => {
    const userAnswer = normalizeKana(inputs[index].value);
    const correctAnswer = conjugate(verb, targetForm);
    const isCorrect = userAnswer === correctAnswer;

    if (isCorrect) correctCount += 1;

    return {
      verb,
      userAnswer,
      correctAnswer,
      isCorrect,
      rule: getRule(verb, targetForm),
      pattern: `${verb.reading} → ${correctAnswer}`,
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

  const showMissedOnly = missedOnlyToggle.checked;
  const visibleItems = showMissedOnly
    ? lastAnswerData.filter((item) => !item.isCorrect)
    : lastAnswerData;

  if (!visibleItems.length) {
    explanationsEl.innerHTML = `<div class="muted">Everything was correct for this round.</div>`;
    return;
  }

  explanationsEl.innerHTML = visibleItems
    .map((item) => {
      const userLine = item.userAnswer
        ? item.userAnswer
        : '<span class="muted">(blank)</span>';

      return `
      <div class="explanation-card">
        <div><strong>${item.verb.kanji}</strong> (${item.verb.reading})</div>
        <div>Correct answer: <strong>${item.correctAnswer}</strong></div>
        <div>Your answer: <span class="${item.isCorrect ? "correct" : "incorrect"}">${userLine}</span></div>
        <div class="muted">${item.rule}</div>
        <div class="muted">${item.pattern}</div>
      </div>
    `;
    })
    .join("");
}

function normalizeKana(text) {
  return text.trim();
}

function conjugate(verb, form) {
  const r = verb.reading;

  if (form === "masu") {
    if (verb.type === "ichidan") return r.slice(0, -1) + "ます";
    if (verb.type === "godan") return changeGodanToI(r) + "ます";
    if (verb.type === "irregular" || verb.type === "suru")
      return r.replace(/する$/, "します");
    if (verb.type === "kuru") return "きます";
  }

  if (form === "te") {
    if (verb.type === "ichidan") return r.slice(0, -1) + "て";
    if (verb.type === "irregular" || verb.type === "suru")
      return r.replace(/する$/, "して");
    if (verb.type === "kuru") return "きて";
    return toTeForm(r);
  }

  if (form === "ta") {
    if (verb.type === "ichidan") return r.slice(0, -1) + "た";
    if (verb.type === "irregular" || verb.type === "suru")
      return r.replace(/する$/, "した");
    if (verb.type === "kuru") return "きた";
    return toTaForm(r);
  }

  if (form === "nai") {
    if (verb.type === "ichidan") return r.slice(0, -1) + "ない";
    if (verb.type === "irregular" || verb.type === "suru")
      return r.replace(/する$/, "しない");
    if (verb.type === "kuru") return "こない";
    return toNaiForm(r);
  }

  if (form === "potential") {
    if (verb.type === "ichidan") return r.slice(0, -1) + "られる";
    if (verb.type === "godan") return changeGodanToE(r) + "る";
    if (verb.type === "irregular" || verb.type === "suru")
      return r.replace(/する$/, "できる");
    if (verb.type === "kuru") return "こられる";
  }

  return r;
}

function getRule(verb, form) {
  if (form === "masu") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add ます.";
    if (verb.type === "godan")
      return "Godan: change final sound to い-row and add ます.";
    if (verb.type === "irregular" || verb.type === "suru")
      return "する becomes します.";
    if (verb.type === "kuru") return "くる becomes きます.";
  }

  if (form === "te") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add て.";
    if (verb.type === "godan") return "Godan: use て-form sound change rules.";
    if (verb.type === "irregular" || verb.type === "suru")
      return "する becomes して.";
    if (verb.type === "kuru") return "くる becomes きて.";
  }

  if (form === "ta") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add た.";
    if (verb.type === "godan") return "Godan: use た-form sound change rules.";
    if (verb.type === "irregular" || verb.type === "suru")
      return "する becomes した.";
    if (verb.type === "kuru") return "くる becomes きた.";
  }

  if (form === "nai") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add ない.";
    if (verb.type === "godan")
      return "Godan: change final sound to あ-row and add ない.";
    if (verb.type === "irregular" || verb.type === "suru")
      return "する becomes しない.";
    if (verb.type === "kuru") return "くる becomes こない.";
  }

  if (form === "potential") {
    if (verb.type === "ichidan") return "Ichidan: remove る and add られる.";
    if (verb.type === "godan")
      return "Godan: change final sound to え-row and add る.";
    if (verb.type === "irregular" || verb.type === "suru")
      return "する becomes できる.";
    if (verb.type === "kuru") return "くる becomes こられる.";
  }

  return "";
}

function changeGodanToI(reading) {
  const map = {
    う: "い",
    く: "き",
    ぐ: "ぎ",
    す: "し",
    つ: "ち",
    ぬ: "に",
    ぶ: "び",
    む: "み",
    る: "り",
  };
  const last = reading.slice(-1);
  return reading.slice(0, -1) + map[last];
}

function changeGodanToE(reading) {
  const map = {
    う: "え",
    く: "け",
    ぐ: "げ",
    す: "せ",
    つ: "て",
    ぬ: "ね",
    ぶ: "べ",
    む: "め",
    る: "れ",
  };
  const last = reading.slice(-1);
  return reading.slice(0, -1) + map[last];
}

function toNaiForm(reading) {
  const last = reading.slice(-1);

  if (last === "う") {
    return reading.slice(0, -1) + "わない";
  }

  const map = {
    く: "かない",
    ぐ: "がない",
    す: "さない",
    つ: "たない",
    ぬ: "なない",
    ぶ: "ばない",
    む: "まない",
    る: "らない",
  };

  return reading.slice(0, -1) + map[last];
}

function toTeForm(reading) {
  if (reading === "いく") return "いって";

  const last = reading.slice(-1);

  if (["う", "つ", "る"].includes(last)) return reading.slice(0, -1) + "って";
  if (["む", "ぶ", "ぬ"].includes(last)) return reading.slice(0, -1) + "んで";
  if (last === "く") return reading.slice(0, -1) + "いて";
  if (last === "ぐ") return reading.slice(0, -1) + "いで";
  if (last === "す") return reading.slice(0, -1) + "して";

  return reading;
}

function toTaForm(reading) {
  if (reading === "いく") return "いった";

  const last = reading.slice(-1);

  if (["う", "つ", "る"].includes(last)) return reading.slice(0, -1) + "った";
  if (["む", "ぶ", "ぬ"].includes(last)) return reading.slice(0, -1) + "んだ";
  if (last === "く") return reading.slice(0, -1) + "いた";
  if (last === "ぐ") return reading.slice(0, -1) + "いだ";
  if (last === "す") return reading.slice(0, -1) + "した";

  return reading;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
