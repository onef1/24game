const state = {
  nums: [],          // 当前 4 个数字
  solutions: [],     // 当前题目的解法列表
  tokens: [],        // 玩家拼的算式 token 列表
  score: 0,
  streak: 0,
  revealed: false,
  startTime: 0,
  timerId: null,
};

const $ = (sel) => document.querySelector(sel);

// ---------- 24 点求解器 ----------
function solve24(nums) {
  const results = [];
  const items = nums.map((n, i) => ({
    val: n,
    str: String(n),
    ids: [i],
  }));

  function rec(list) {
    if (list.length === 1) {
      if (Math.abs(list[0].val - 24) < 1e-6) {
        results.push(list[0].str);
      }
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
        for (const c of combos) {
          rec([...rest, c]);
        }
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
    if (sols.length > 0) {
      return { nums, sols };
    }
  }
  // 极小概率兜底：给一个一定有解的题目
  return { nums: [3, 3, 8, 8], sols: solve24([3, 3, 8, 8]) };
}

// ---------- 表达式求值（递归下降，不用 eval） ----------
function evalTokens(tokens) {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }
  function next() {
    return tokens[pos++];
  }
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
      if (op === "×") {
        v = v * rhs;
      } else {
        if (Math.abs(rhs) < 1e-9) throw new Error("除数不能为 0");
        v = v / rhs;
      }
    }
    return v;
  }
  function parseFactor() {
    const tok = peek();
    if (!tok) throw new Error("算式不完整");
    if (tok.type === "num") {
      next();
      return tok.value;
    }
    if (tok.type === "paren" && tok.value === "(") {
      next();
      const v = parseExpression();
      const close = next();
      if (!close || close.type !== "paren" || close.value !== ")") {
        throw new Error("括号没有闭合");
      }
      return v;
    }
    throw new Error("算式格式不对");
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new Error("算式格式不对");
  return result;
}

// ---------- 校验：4 个数字是否各用一次、结构是否合法 ----------
function validateTokens(tokens, nums) {
  const numTokens = tokens.filter((t) => t.type === "num");
  const usedIds = numTokens.map((t) => t.id).sort();
  const allIds = nums.map((_, i) => i).sort();
  if (usedIds.join(",") !== allIds.join(",")) {
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
      if (!prev || prev.type === "op" || (prev.type === "paren" && prev.value === "(")) {
        return "运算符位置不对";
      }
      if (!nxt) return "算式不完整";
    }
    if (t.type === "num") {
      if (prev && prev.type === "num") return "两个数字之间需要运算符";
    }
  }
  if (depth !== 0) return "括号没有闭合";
  return null;
}

// ---------- 渲染 ----------
function renderCards() {
  const box = $("#cards");
  box.innerHTML = "";
  const used = new Set(state.tokens.filter((t) => t.type === "num").map((t) => t.id));
  state.nums.forEach((n, i) => {
    const btn = document.createElement("button");
    btn.className = "card" + (used.has(i) ? " used" : "");
    btn.textContent = n;
    btn.addEventListener("click", () => addNumber(i));
    box.appendChild(btn);
  });
}

function tokenText(t) {
  if (t.type === "num") return String(t.value);
  return t.value;
}

function renderExpression() {
  const box = $("#expression");
  if (state.tokens.length === 0) {
    box.innerHTML = '<span class="placeholder">点击数字和符号，在这里拼出算式</span>';
    return;
  }
  box.textContent = state.tokens.map(tokenText).join(" ");
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

// ---------- 操作 ----------
function addNumber(id) {
  if (state.revealed) return;
  const last = state.tokens[state.tokens.length - 1];
  if (last && last.type === "num") return; // 两个数字不能挨着
  state.tokens.push({ type: "num", value: state.nums[id], id });
  renderCards();
  renderExpression();
}

function addOp(op) {
  if (state.revealed) return;
  const last = state.tokens[state.tokens.length - 1];
  if (state.tokens.length === 0) return;
  if (last.type === "op") return;
  if (last.type === "paren" && last.value === "(") return;
  state.tokens.push({ type: "op", value: op });
  renderExpression();
}

function addParen(p) {
  if (state.revealed) return;
  state.tokens.push({ type: "paren", value: p });
  renderExpression();
}

function backspace() {
  state.tokens.pop();
  renderCards();
  renderExpression();
}

function clearExpression() {
  state.tokens = [];
  state.revealed = false;
  renderCards();
  renderExpression();
  showMessage("", "");
}

function startTimer() {
  stopTimer();
  state.startTime = Date.now();
  state.timerId = setInterval(() => {
    const s = (Date.now() - state.startTime) / 1000;
    $("#timer").textContent = s.toFixed(1) + "s";
  }, 100);
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function newRound() {
  const p = generatePuzzle();
  state.nums = p.nums;
  state.solutions = p.sols;
  state.tokens = [];
  state.revealed = false;
  renderCards();
  renderExpression();
  showMessage("", "");
  startTimer();
}

function submit() {
  if (state.revealed) {
    showMessage("这题已经看过答案啦，换一题吧", "err");
    return;
  }
  const err = validateTokens(state.tokens, state.nums);
  if (err) {
    showMessage(err, "err");
    return;
  }
  let value;
  try {
    value = evalTokens(state.tokens);
  } catch (e) {
    showMessage(e.message, "err");
    return;
  }
  if (Math.abs(value - 24) < 1e-6) {
    state.score += 1;
    state.streak += 1;
    renderStats();
    showMessage("答对了！太棒了 🎉", "ok");
    stopTimer();
    setTimeout(newRound, 1400);
  } else {
    state.streak = 0;
    renderStats();
    showMessage("等于 " + round(value) + "，不是 24，再想想", "err");
  }
}

function round(v) {
  const r = Math.round(v * 1000) / 1000;
  return r;
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
  renderStats();
  newRound();
}

// ---------- 事件绑定 ----------
function bind() {
  document.querySelectorAll(".op").forEach((b) => {
    b.addEventListener("click", () => {
      const op = b.dataset.op;
      if (op === "(" || op === ")") addParen(op);
      else addOp(op);
    });
  });
  $("#backspace").addEventListener("click", backspace);
  $("#clear").addEventListener("click", clearExpression);
  $("#submit").addEventListener("click", submit);
  $("#newRound").addEventListener("click", newRound);
  $("#showAnswer").addEventListener("click", showAnswer);
  $("#reset").addEventListener("click", reset);
}

bind();
reset();
