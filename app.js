(() => {
  "use strict";

  const STORAGE_KEY = "dagmal:state";
  const MAX_KIDS = 5;
  const MAX_RANGES = 5;
  const MAX_ITEMS = 50;

  const AVATARS = ["🦊", "🐻", "🐰", "🐸", "🐼", "🦁", "🐨", "🐯", "🐵", "🐱"];

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const todayKey = () => new Date().toISOString().slice(0, 10);

  function defaultState() {
    return {
      kids: [{ id: uid(), name: "Alex" }],
      timeRanges: [
        {
          id: uid(),
          from: "07:00",
          to: "08:00",
          items: [
            { id: uid(), text: "Brush teeth" },
            { id: uid(), text: "Get dressed" },
            { id: uid(), text: "Eat breakfast" },
            { id: uid(), text: "Pack school bag" },
          ],
        },
        {
          id: uid(),
          from: "19:00",
          to: "20:00",
          items: [
            { id: uid(), text: "Bath time" },
            { id: uid(), text: "Pajamas on" },
            { id: uid(), text: "Brush teeth" },
            { id: uid(), text: "Read a story" },
          ],
        },
      ],
      checksDate: todayKey(),
      checks: {},
    };
  }

  // Older versions of Dagmál gave each time range a free-text name instead
  // of a from/to time. Map those to sensible default times so existing
  // localStorage data keeps working.
  function migrateRanges(ranges) {
    let autoHour = 9;
    return (ranges || []).map((r) => {
      if (r.from && r.to) {
        return { id: r.id, from: r.from, to: r.to, items: r.items || [] };
      }
      const n = (r.name || "").toLowerCase();
      let from, to;
      if (n.includes("morning")) {
        from = "07:00";
        to = "08:00";
      } else if (n.includes("bed") || n.includes("night")) {
        from = "19:00";
        to = "20:00";
      } else if (n.includes("after")) {
        from = "15:00";
        to = "16:00";
      } else {
        const h = autoHour % 24;
        from = `${String(h).padStart(2, "0")}:00`;
        to = `${String((h + 1) % 24).padStart(2, "0")}:00`;
        autoHour += 2;
      }
      return { id: r.id, from, to, items: r.items || [] };
    });
  }

  function loadState() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) return defaultState();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.kids || !parsed.timeRanges) return defaultState();
      parsed.timeRanges = migrateRanges(parsed.timeRanges);
      if (parsed.checksDate !== todayKey()) {
        parsed.checksDate = todayKey();
        parsed.checks = {};
      }
      if (!parsed.checks) parsed.checks = {};
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      showToast("Couldn't save — storage might be full 😬");
    }
  }

  let state = loadState();

  // ---------------- sound ----------------

  let audioCtx = null;
  function playChime() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.09;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch (e) {
      /* audio not available, ignore */
    }
  }

  // ---------------- confetti ----------------

  const CONFETTI_COLORS = ["#ffb703", "#52b788", "#ff6b6b", "#8ecae6", "#f9c74f"];

  function burstConfetti(originEl) {
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.left = `${cx}px`;
      piece.style.top = `${cy}px`;
      document.body.appendChild(piece);

      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.random() * 70;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 40;
      const rotate = (Math.random() - 0.5) * 720;

      const anim = piece.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(${dx}px, ${dy + 90}px) rotate(${rotate}deg)`,
            opacity: 0,
          },
        ],
        { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
      anim.onfinish = () => piece.remove();
    }
  }

  // ---------------- toast ----------------

  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  }

  const ENCOURAGEMENTS = ["Great job! 🌟", "Way to go! 🎉", "Awesome! 🌈", "You did it! 🌻", "Yay! ☀️"];

  // ---------------- time formatting ----------------

  function formatTime(t) {
    if (!t) return "";
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${mStr} ${ampm}`;
  }

  function formatTimeRange(from, to) {
    return `${formatTime(from)} – ${formatTime(to)}`;
  }

  function sortedRanges() {
    return state.timeRanges.slice().sort((a, b) => (a.from || "").localeCompare(b.from || ""));
  }

  // ---------------- relevance (which routine matters right now) ----------------

  function toMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  // Handles ranges that wrap past midnight (e.g. 20:00 -> 07:00).
  function isRangeActive(range, nowMin) {
    const from = toMinutes(range.from);
    const to = toMinutes(range.to);
    if (from === to) return false;
    if (from < to) return nowMin >= from && nowMin < to;
    return nowMin >= from || nowMin < to;
  }

  // Ranges due right now; if none, fall back to whichever range starts
  // soonest (wrapping to tomorrow morning if every range has already
  // ended today) so the view is never just empty.
  function relevantRanges(ranges, nowMin) {
    const active = ranges.filter((r) => isRangeActive(r, nowMin));
    if (active.length > 0) return { ranges: active, upcoming: false };

    let best = null;
    let bestDist = Infinity;
    ranges.forEach((r) => {
      const dist = (toMinutes(r.from) - nowMin + 1440) % 1440;
      if (dist < bestDist) {
        bestDist = dist;
        best = r;
      }
    });
    return { ranges: best ? [best] : [], upcoming: true };
  }

  // ---------------- main view rendering ----------------

  const mainView = document.getElementById("mainView");

  function isChecked(kidId, itemId) {
    return !!(state.checks[kidId] && state.checks[kidId][itemId]);
  }

  function setChecked(kidId, itemId, value) {
    if (!state.checks[kidId]) state.checks[kidId] = {};
    if (value) {
      state.checks[kidId][itemId] = true;
    } else {
      delete state.checks[kidId][itemId];
    }
    saveState();
  }

  function totalItemCount() {
    return state.timeRanges.reduce((sum, r) => sum + r.items.length, 0);
  }

  function kidCheckedCount(kidId, itemIds) {
    const checks = state.checks[kidId] || {};
    let count = 0;
    itemIds.forEach((id) => {
      if (checks[id]) count++;
    });
    return count;
  }

  function renderMain() {
    mainView.innerHTML = "";

    if (state.kids.length === 0 || totalItemCount() === 0) {
      const tpl = document.getElementById("emptyStateTemplate");
      mainView.appendChild(tpl.content.cloneNode(true));
      return;
    }

    const usableRanges = sortedRanges().filter((r) => r.items.length > 0);
    const { ranges: rangesToShow, upcoming } = relevantRanges(usableRanges, nowMinutes());

    if (upcoming && rangesToShow.length > 0) {
      const bannerTpl = document.getElementById("dayBannerTemplate");
      const banner = bannerTpl.content.cloneNode(true);
      banner.querySelector(".day-banner-text").textContent =
        "Nothing due right now — coming up: " +
        rangesToShow.map((r) => formatTimeRange(r.from, r.to)).join(", ");
      mainView.appendChild(banner);
    }

    const visibleItemIds = rangesToShow.flatMap((r) => r.items.map((it) => it.id));

    state.kids.forEach((kid, idx) => {
      const cardTpl = document.getElementById("kidCardTemplate");
      const card = cardTpl.content.cloneNode(true);

      const cardRoot = card.querySelector(".kid-card");
      card.querySelector(".kid-avatar").textContent = AVATARS[idx % AVATARS.length];
      card.querySelector(".kid-name").textContent = kid.name || "Unnamed";

      const rangesWrap = card.querySelector(".kid-ranges");

      rangesToShow.forEach((range) => {
        const rangeTpl = document.getElementById("rangeBlockTemplate");
        const rangeEl = rangeTpl.content.cloneNode(true);
        rangeEl.querySelector(".range-title").textContent =
          rangeIcon(range.from) + " " + formatTimeRange(range.from, range.to);

        const list = rangeEl.querySelector(".item-list");
        range.items.forEach((item) => {
          const rowTpl = document.getElementById("itemRowTemplate");
          const row = rowTpl.content.cloneNode(true);
          const rowRoot = row.querySelector(".item-row");
          const rowBtn = row.querySelector(".item-row-btn");
          const checkVisual = row.querySelector(".item-check");
          row.querySelector(".item-text").textContent = item.text;

          const checked = isChecked(kid.id, item.id);
          if (checked) {
            rowRoot.classList.add("checked");
            checkVisual.classList.add("is-checked");
            rowBtn.setAttribute("aria-pressed", "true");
          }

          rowBtn.addEventListener("click", () => {
            const nowChecked = !isChecked(kid.id, item.id);
            setChecked(kid.id, item.id, nowChecked);
            rowRoot.classList.toggle("checked", nowChecked);
            checkVisual.classList.toggle("is-checked", nowChecked);
            rowBtn.setAttribute("aria-pressed", String(nowChecked));

            if (nowChecked) {
              checkVisual.classList.remove("celebrate");
              void checkVisual.offsetWidth;
              checkVisual.classList.add("celebrate");
              burstConfetti(checkVisual);
              playChime();
              if (Math.random() < 0.35) {
                showToast(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
              }
            }
            updateKidProgress(cardRoot, kid.id, visibleItemIds);
          });

          list.appendChild(row);
        });

        rangesWrap.appendChild(rangeEl);
      });

      mainView.appendChild(card);
      updateKidProgress(cardRoot, kid.id, visibleItemIds);
    });
  }

  function rangeIcon(from) {
    if (!from) return "⭐";
    const h = parseInt(from.split(":")[0], 10);
    if (h < 12) return "🌅";
    if (h >= 17) return "🌙";
    return "🌤️";
  }

  function updateKidProgress(cardRoot, kidId, itemIds) {
    const total = itemIds.length;
    const done = kidCheckedCount(kidId, itemIds);
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const fill = cardRoot.querySelector(".kid-progress-fill");
    const label = cardRoot.querySelector(".kid-progress-label");
    if (fill) fill.style.width = pct + "%";
    if (label) label.textContent = `${done}/${total}`;
  }

  // ---------------- parents panel ----------------

  const overlay = document.getElementById("parentsOverlay");
  const kidsEditor = document.getElementById("kidsEditor");
  const rangesEditor = document.getElementById("rangesEditor");
  let draft = null;

  function cloneStateForEditing() {
    return JSON.parse(JSON.stringify({ kids: state.kids, timeRanges: state.timeRanges }));
  }

  function openParents() {
    draft = cloneStateForEditing();
    renderKidsEditor();
    renderRangesEditor();
    overlay.hidden = false;
  }

  function closeParents() {
    overlay.hidden = true;
    draft = null;
    renderMain(); // pick up any routine boundary crossed while the panel was open
  }

  function renderKidsEditor() {
    kidsEditor.innerHTML = "";
    draft.kids.forEach((kid, idx) => {
      const row = document.createElement("div");
      row.className = "kid-edit-row";

      const avatar = document.createElement("span");
      avatar.textContent = AVATARS[idx % AVATARS.length];
      avatar.style.fontSize = "1.4rem";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "text-input";
      input.placeholder = "Kid's name";
      input.maxLength = 30;
      input.value = kid.name;
      input.addEventListener("input", () => {
        kid.name = input.value;
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-remove";
      removeBtn.textContent = "✕";
      removeBtn.setAttribute("aria-label", "Remove kid");
      removeBtn.addEventListener("click", () => {
        draft.kids.splice(idx, 1);
        renderKidsEditor();
      });

      row.appendChild(avatar);
      row.appendChild(input);
      row.appendChild(removeBtn);
      kidsEditor.appendChild(row);
    });

    const addBtn = document.getElementById("addKid");
    addBtn.disabled = draft.kids.length >= MAX_KIDS;
    addBtn.textContent = draft.kids.length >= MAX_KIDS ? `Max ${MAX_KIDS} kids` : "+ Add kid";
  }

  function renderRangesEditor() {
    rangesEditor.innerHTML = "";
    draft.timeRanges.forEach((range, rIdx) => {
      const block = document.createElement("div");
      block.className = "range-edit-block";

      const head = document.createElement("div");
      head.className = "range-edit-head";

      const fromInput = document.createElement("input");
      fromInput.type = "time";
      fromInput.className = "text-input time-input";
      fromInput.setAttribute("aria-label", "Start time");
      fromInput.value = range.from || "";
      fromInput.addEventListener("input", () => {
        range.from = fromInput.value;
      });

      const sep = document.createElement("span");
      sep.className = "time-sep";
      sep.textContent = "–";

      const toInput = document.createElement("input");
      toInput.type = "time";
      toInput.className = "text-input time-input";
      toInput.setAttribute("aria-label", "End time");
      toInput.value = range.to || "";
      toInput.addEventListener("input", () => {
        range.to = toInput.value;
      });

      const removeRangeBtn = document.createElement("button");
      removeRangeBtn.type = "button";
      removeRangeBtn.className = "btn-remove";
      removeRangeBtn.textContent = "✕";
      removeRangeBtn.setAttribute("aria-label", "Remove time range");
      removeRangeBtn.addEventListener("click", () => {
        draft.timeRanges.splice(rIdx, 1);
        renderRangesEditor();
      });

      head.appendChild(fromInput);
      head.appendChild(sep);
      head.appendChild(toInput);
      head.appendChild(removeRangeBtn);
      block.appendChild(head);

      const itemsWrap = document.createElement("div");
      itemsWrap.className = "range-items-editor";

      range.items.forEach((item, iIdx) => {
        const itemRow = document.createElement("div");
        itemRow.className = "item-edit-row";

        const itemInput = document.createElement("input");
        itemInput.type = "text";
        itemInput.className = "text-input";
        itemInput.placeholder = "To-do item";
        itemInput.maxLength = 60;
        itemInput.value = item.text;
        itemInput.addEventListener("input", () => {
          item.text = itemInput.value;
        });

        const removeItemBtn = document.createElement("button");
        removeItemBtn.type = "button";
        removeItemBtn.className = "btn-remove";
        removeItemBtn.textContent = "✕";
        removeItemBtn.setAttribute("aria-label", "Remove item");
        removeItemBtn.addEventListener("click", () => {
          range.items.splice(iIdx, 1);
          renderRangesEditor();
        });

        itemRow.appendChild(itemInput);
        itemRow.appendChild(removeItemBtn);
        itemsWrap.appendChild(itemRow);
      });

      block.appendChild(itemsWrap);

      const addItemBtn = document.createElement("button");
      addItemBtn.type = "button";
      addItemBtn.className = "btn-add-item";
      const atMax = range.items.length >= MAX_ITEMS;
      addItemBtn.disabled = atMax;
      addItemBtn.textContent = atMax ? `Max ${MAX_ITEMS} items` : "+ Add item";
      addItemBtn.addEventListener("click", () => {
        range.items.push({ id: uid(), text: "" });
        renderRangesEditor();
        const inputs = block.querySelectorAll(".item-edit-row .text-input");
        const last = inputs[inputs.length - 1];
        if (last) last.focus();
      });
      block.appendChild(addItemBtn);

      rangesEditor.appendChild(block);
    });

    const addRangeBtn = document.getElementById("addRange");
    addRangeBtn.disabled = draft.timeRanges.length >= MAX_RANGES;
    addRangeBtn.textContent =
      draft.timeRanges.length >= MAX_RANGES ? `Max ${MAX_RANGES} ranges` : "+ Add time range";
  }

  function saveDraft() {
    const cleanedKids = draft.kids
      .map((k) => ({ id: k.id, name: k.name.trim() }))
      .filter((k) => k.name.length > 0)
      .slice(0, MAX_KIDS);

    const cleanedRanges = draft.timeRanges
      .map((r) => ({
        id: r.id,
        from: r.from,
        to: r.to,
        items: r.items
          .map((it) => ({ id: it.id, text: it.text.trim() }))
          .filter((it) => it.text.length > 0)
          .slice(0, MAX_ITEMS),
      }))
      .filter((r) => r.from && r.to)
      .slice(0, MAX_RANGES);

    // prune checks for kids/items that no longer exist
    const validKidIds = new Set(cleanedKids.map((k) => k.id));
    const validItemIds = new Set(cleanedRanges.flatMap((r) => r.items.map((it) => it.id)));
    Object.keys(state.checks).forEach((kidId) => {
      if (!validKidIds.has(kidId)) {
        delete state.checks[kidId];
        return;
      }
      Object.keys(state.checks[kidId]).forEach((itemId) => {
        if (!validItemIds.has(itemId)) delete state.checks[kidId][itemId];
      });
    });

    state.kids = cleanedKids;
    state.timeRanges = cleanedRanges;
    saveState();
    closeParents(); // also re-renders the main view with the new settings
    showToast("Saved! 🌟");
  }

  // ---------------- parents gate ----------------
  // A simple arithmetic check to keep young kids from wandering into
  // settings — not real security, just a "grown-ups only" speed bump.

  const gateOverlay = document.getElementById("gateOverlay");
  const gateA = document.getElementById("gateA");
  const gateB = document.getElementById("gateB");
  const gateInput = document.getElementById("gateInput");
  const gateError = document.getElementById("gateError");
  let gateChallenge = null;

  const randomTwoDigit = () => Math.floor(Math.random() * 90) + 10; // 10-99

  function newGateChallenge() {
    gateChallenge = { a: randomTwoDigit(), b: randomTwoDigit() };
    gateA.textContent = gateChallenge.a;
    gateB.textContent = gateChallenge.b;
    gateInput.value = "";
  }

  function openGate() {
    gateError.hidden = true;
    newGateChallenge();
    gateOverlay.hidden = false;
    gateInput.focus();
  }

  function closeGate() {
    gateOverlay.hidden = true;
    gateChallenge = null;
  }

  function submitGate() {
    const answer = parseInt(gateInput.value, 10);
    if (gateChallenge && answer === gateChallenge.a + gateChallenge.b) {
      closeGate();
      openParents();
    } else {
      gateError.hidden = false;
      newGateChallenge();
      gateInput.focus();
    }
  }

  document.getElementById("gateSubmit").addEventListener("click", submitGate);
  document.getElementById("closeGate").addEventListener("click", closeGate);
  gateInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitGate();
  });
  gateOverlay.addEventListener("click", (e) => {
    if (e.target === gateOverlay) closeGate();
  });

  // ---------------- events ----------------

  document.getElementById("openParents").addEventListener("click", openGate);
  document.getElementById("closeParents").addEventListener("click", closeParents);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeParents();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!gateOverlay.hidden) closeGate();
    else if (!overlay.hidden) closeParents();
  });

  document.getElementById("addKid").addEventListener("click", () => {
    if (draft.kids.length >= MAX_KIDS) return;
    draft.kids.push({ id: uid(), name: "" });
    renderKidsEditor();
    const inputs = kidsEditor.querySelectorAll(".text-input");
    const last = inputs[inputs.length - 1];
    if (last) last.focus();
  });

  document.getElementById("addRange").addEventListener("click", () => {
    if (draft.timeRanges.length >= MAX_RANGES) return;
    draft.timeRanges.push({ id: uid(), from: "08:00", to: "09:00", items: [{ id: uid(), text: "" }] });
    renderRangesEditor();
  });

  document.getElementById("saveParents").addEventListener("click", saveDraft);

  // ---------------- init ----------------

  renderMain();

  // Keep the "what's relevant right now" view current if the page is left
  // open across a routine boundary (e.g. mounted on a tablet all day).
  // Re-rendering just rebuilds the DOM from `state`, which already holds
  // today's checks, so it never loses check-off progress. Skipped while
  // the parents pane is open so it doesn't fight with an in-progress edit;
  // closeParents()/saveDraft() re-render once it closes to catch up.
  setInterval(() => {
    if (overlay.hidden) renderMain();
  }, 20000);
})();
