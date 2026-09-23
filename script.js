const state = {
  nums: [],
  solutions: [],
  score: 0,
  streak: 0,
  revealed: false,
};

const $ = (sel) => document.querySelector(sel);

// ---------- 24 点求解器 ----------
function solve24(nums) {
  const results = [];
  const items = nums.map((n, i) => ({ val: n, str: String(n), ids: [i] }));

  function rec(list) {
    if (list.length === 1) {
      if (Math.abs(list[0].val - 24) < 1e-6) results.push(list[0].str);
      return;
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const rest = list.filter((_, k) => k !== i && k !== j);
        const a = list[i];
        const b = list[j];
        const combos = [
          { val: a.val + b.val, str: `(${a.str}+${b.str})` },
          { val: a.val - b.val, str: `(${a.str}-${b.str})` },
          { val: b.val - a.val, str: `(${b.str}-${a.str})` },
          { val: a.val * b.val, str: `(${a.str}×${b.str})` },
        ];
        if (Math.abs(b.val) > 1e-9) combos.push({ val: a.val / b.val, str: `(${a.str}÷${b.str})` });
        if (Math.abs(a.val) > 1e-9) combos.push({ val: b.val / a.val, str: `(${b.str}÷${a.str})` });
        for (const c of combos) rec([...rest, c]);
      }
    }
  }

  rec(items);
  return results;
}

function generatePuzzle() {
  for (let i = 0; i < 5000; i++) {
    const nums = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 13));
    const sols = solve24(nums);
    if (sols.length > 0) return { nums, sols };
  }
  return { nums: [3, 3, 8, 8], sols: solve24([3, 3, 8, 8]) };
}

// ---------- 词法分析：把输入字符串转成 token ----------
function tokenize(str) {
  const s = String(str)
    .replace(/×/g, "*").replace(/÷/g, "/")
    .replace(/−/g, "-").replace(/—/g, "-")
    .replace(/＋/g, "+").replace(/（/g, "(").replace(/）/g, ")")
    .replace(/\s+/g, "");
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9]/.test(s[i])) { num += s[i]; i++; }
      tokens.push({ type: "num", value: parseInt(num, 10) });
      continue;
    }
    if ("+-*/".includes(ch)) {
      const map = { "+": "+", "-": "-", "*": "×", "/": "÷" };
      tokens.push({ type: "op", value: map[ch] });
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }
    throw new Error("含有无法识别的字符：" + ch);
  }
  return tokens;
}

// ---------- 表达式求值（递归下降） ----------
function evalTokens(tokens) {
  let pos = 0;
  function peek() { return tokens[pos]; }
  function next() { return tokens[pos++]; }

  function parseExpression() {
    let v = parseTerm();
    while (pos < tokens.length && (peek().value === "+" || peek().value === "-")) {
      const op = next().value;
      const rhs = parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    while (pos < tokens.length && (peek().value === "×" || peek().value === "÷")) {
      const op = next().value;
      const rhs = parseFactor();
      if (op === "×") v = v * rhs;
      else {
        if (Math.abs(rhs) < 1e-9) throw new Error("除数不能为 0");
        v = v / rhs;
      }
    }
    return v;
  }
  function parseFactor() {
    const tok = peek();
    if (!tok) throw new Error("算式不完整");
    if (tok.type === "num") { next(); return tok.value; }
    if (tok.type === "paren" && tok.value === "(") {
      next();
      const v = parseExpression();
      const close = next();
      if (!close || close.type !== "paren" || close.value !== ")") throw new Error("括号没有闭合");
      return v;
    }
    throw new Error("算式格式不对");
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new Error("算式格式不对");
  return result;
}

// ---------- 校验：4 个数字各用一次、结构合法 ----------
function validateTokens(tokens, nums) {
  const used = tokens.filter((t) => t.type === "num").map((t) => t.value).sort((a, b) => a - b);
  const need = nums.slice().sort((a, b) => a - b);
  if (used.join(",") !== need.join(",")) {
    return "必须把 4 个数字全部用上，且每个只能用一次";
  }

  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = tokens[i - 1];
    const nxt = tokens[i + 1];
    if (t.type === "paren") {
      depth += t.value === "(" ? 1 : -1;
      if (depth < 0) return "括号不匹配";
    }
    if (t.type === "op") {
      if (!prev || prev.type === "op" || (prev.type === "paren" && prev.value === "(")) return "运算符位置不对";
      if (!nxt) return "算式不完整";
    }
    if (t.type === "num" && prev && prev.type === "num") return "两个数字之间需要运算符";
  }
  if (depth !== 0) return "括号没有闭合";
  return null;
}

// ---------- 渲染 ----------
function renderCards() {
  const box = $("#cards");
  box.innerHTML = "";
  state.nums.forEach((n) => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.textContent = n;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      insertAtCursor(String(n));
    });
    box.appendChild(btn);
  });
  updateCardStates();
}

function updateCardStates() {
  let used = {};
  try {
    const tokens = tokenize($("#expression").value);
    tokens.filter((t) => t.type === "num").forEach((t) => { used[t.value] = (used[t.value] || 0) + 1; });
  } catch (e) {
    used = {};
  }
  const deck = {};
  state.nums.forEach((n) => { deck[n] = (deck[n] || 0) + 1; });
  const cards = document.querySelectorAll("#cards .card");
  state.nums.forEach((n, i) => {
    cards[i].classList.toggle("used", (used[n] || 0) >= (deck[n] || 0));
  });
}

function renderStats() {
  $("#score").textContent = state.score;
  $("#streak").textContent = state.streak;
}

function showMessage(text, type) {
  const el = $("#message");
  el.textContent = text;
  el.className = "message" + (type ? " " + type : "");
}

// ---------- 输入操作 ----------
function insertAtCursor(text) {
  const el = $("#expression");
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  const pos = start + text.length;
  el.focus();
  el.setSelectionRange(pos, pos);
  updateCardStates();
}

function backspace() {
  const el = $("#expression");
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (start === end) {
    if (start > 0) {
      el.value = el.value.slice(0, start - 1) + el.value.slice(start);
      el.focus();
      el.setSelectionRange(start - 1, start - 1);
    }
  } else {
    el.value = el.value.slice(0, start) + el.value.slice(end);
    el.focus();
    el.setSelectionRange(start, start);
  }
  updateCardStates();
}

function clearExpression() {
  $("#expression").value = "";
  $("#expression").focus();
  updateCardStates();
  showMessage("", "");
}

// ---------- 对局 ----------
function newRound() {
  const p = generatePuzzle();
  state.nums = p.nums;
  state.solutions = p.sols;
  state.revealed = false;
  $("#expression").value = "";
  renderCards();
  renderStats();
  showMessage("", "");
  updateCardStates();
  $("#expression").focus();
}

function submit() {
  if (state.revealed) {
    showMessage("这题已经看过答案啦，换一题吧", "err");
    return;
  }
  let tokens;
  try {
    tokens = tokenize($("#expression").value);
  } catch (e) {
    showMessage(e.message, "err");
    return;
  }
  const err = validateTokens(tokens, state.nums);
  if (err) { showMessage(err, "err"); return; }
  let value;
  try {
    value = evalTokens(tokens);
  } catch (e) {
    showMessage(e.message, "err");
    return;
  }
  if (Math.abs(value - 24) < 1e-6) {
    state.score += 1;
    state.streak += 1;
    renderStats();
    showMessage("答对了！太棒了 🎉", "ok");
    setTimeout(newRound, 1400);
  } else {
    state.streak = 0;
    renderStats();
    showMessage("等于 " + round(value) + "，不是 24，再想想", "err");
  }
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}

function showAnswer() {
  if (state.revealed) return;
  state.revealed = true;
  state.streak = 0;
  renderStats();
  const sol = state.solutions[0] || "（无解）";
  showMessage("一种解法：" + sol + " = 24", "ok");
}

function reset() {
  state.score = 0;
  state.streak = 0;
  newRound();
}

// ---------- 事件绑定 ----------
function bind() {
  document.querySelectorAll(".op").forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      insertAtCursor(b.dataset.op);
    });
  });
  document.querySelectorAll(".tool[data-op]").forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      insertAtCursor(b.dataset.op);
    });
  });
  $("#backspace").addEventListener("click", backspace);
  $("#clear").addEventListener("click", clearExpression);
  $("#submit").addEventListener("click", submit);
  $("#newRound").addEventListener("click", newRound);
  $("#showAnswer").addEventListener("click", showAnswer);
  $("#reset").addEventListener("click", reset);
  $("#expression").addEventListener("input", updateCardStates);
}

bind();
reset();
