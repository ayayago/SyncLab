const MEALS = 3;
const MECH_LABEL = {
  mutex: 'Mutex (garpu satu-satu)',
  semaphore: 'Semaphore (N-1 kursi)',
  monitor: 'Monitor (atomik)'
};

let state = null;
let timer = null;

// Elemen DOM
const mechSelect = document.getElementById('mech-select');
const nRange = document.getElementById('n-range');
const nVal = document.getElementById('n-val');
const mechNote = document.getElementById('mech-note');
const forksLayer = document.getElementById('forks-layer');
const philLayer = document.getElementById('philosophers-layer');
const logBox = document.getElementById('log-box');
const stateList = document.getElementById('state-list');
const stepCount = document.getElementById('step-count');
const btnPlay = document.getElementById('btn-play');
const btnStep = document.getElementById('btn-step');
const btnReset = document.getElementById('btn-reset');

function initPhil({ mechanism, n }) {
  return {
    mechanism,
    n,
    ptr: 0,
    currentStep: 0,
    done: false,
    deadlock: false,
    room: n - 1,
    forks: Array(n).fill(null),
    ph: Array.from({ length: n }, (_, i) => ({
      id: i,
      state: 'thinking',
      left: false,
      right: false,
      seat: false,
      meals: 0
    })),
    logs: [`Step 0: Inisialisasi ${n} filsuf — ${MECH_LABEL[mechanism]}.`],
  };
}

function act(st, i, L) {
  const p = st.ph[i];
  const l = i;
  const r = (i + 1) % st.n;
  const m = st.mechanism;
  const nm = 'P' + (i + 1);

  if (p.state === 'done') return false;
  if (p.state === 'thinking') {
    p.state = 'hungry';
    L(`${nm} lapar`);
    return true;
  }
  if (p.state === 'eating') {
    st.forks[l] = null;
    st.forks[r] = null;
    p.left = p.right = false;
    p.meals++;
    if (p.seat) {
      st.room++;
      p.seat = false;
    }
    p.state = p.meals >= MEALS ? 'done' : 'thinking';
    L(`${nm} selesai makan, menaruh 2 garpu (makan ke-${p.meals})`);
    return true;
  }
  if (m === 'monitor') {
    if (st.forks[l] !== null || st.forks[r] !== null) return false;
    st.forks[l] = i;
    st.forks[r] = i;
    p.left = p.right = true;
    p.state = 'eating';
    L(`${nm} ambil 2 garpu`);
    L(`${nm} makan`);
    return true;
  }
  if (m === 'semaphore' && !p.seat) {
    if (st.room <= 0) return false;
    st.room--;
    p.seat = true;
    L(`${nm} masuk ruang makan (sisa kursi ${st.room})`);
    return true;
  }
  if (!p.left) {
    if (st.forks[l] !== null) return false;
    st.forks[l] = i;
    p.left = true;
    L(`${nm} ambil garpu kiri (F${l + 1})`);
    return true;
  }
  if (!p.right) {
    if (st.forks[r] !== null) return false;
    st.forks[r] = i;
    p.right = true;
    p.state = 'eating';
    L(`${nm} ambil garpu kanan (F${r + 1})`);
    L(`${nm} makan`);
    return true;
  }
  return false;
}

function stepPhil() {
  if (state.done) return;
  state.currentStep++;
  const L = (m) => state.logs.push(`Step ${state.currentStep}: ${m}`);
  let moved = false;

  for (let k = 0; k < state.n; k++) {
    const i = (state.ptr + k) % state.n;
    if (act(state, i, L)) {
      state.ptr = (i + 1) % state.n;
      moved = true;
      break;
    }
  }

  if (!moved) {
    state.deadlock = true;
    state.done = true;
    L('DEADLOCK! Semua filsuf menunggu garpu satu sama lain.');
  } else if (state.ph.every((p) => p.state === 'done')) {
    state.done = true;
    L(`Selesai. Semua filsuf sudah makan ${MEALS} kali tanpa deadlock ✓`);
  }

  if (state.done) stopAutoPlay();
  render();
}

function pos(deg, r) {
  const a = ((deg - 90) * Math.PI) / 180;
  return {
    left: `${50 + r * Math.cos(a)}%`,
    top: `${50 + r * Math.sin(a)}%`
  };
}

function getStatusClass(p) {
  if (state.deadlock && p.state === 'hungry') return 'deadlock';
  if (p.state === 'hungry') return 'waiting';
  if (p.state === 'eating') return 'running';
  if (p.state === 'done') return 'done';
  return 'ready';
}

function getStatusLabel(p) {
  if (state.deadlock && p.state === 'hungry') return 'Deadlock';
  return {
    thinking: 'Berpikir',
    hungry: 'Lapar',
    eating: 'Makan',
    done: 'Selesai'
  }[p.state];
}

function render() {
  const n = state.n;

  // 1. Render Garpu
  forksLayer.innerHTML = state.forks.map((owner, i) => {
    const mid = ((i + 0.5) * 360) / n;
    const p = owner === null ? pos(mid, 22) : pos((owner * 360) / n, 27);
    const heldClass = owner !== null ? ' held' : '';
    return `<div class="fork${heldClass}" style="left:${p.left}; top:${p.top}; transform:translate(-50%,-50%) rotate(${mid}deg)" title="Garpu F${i + 1}"></div>`;
  }).join('');

  // 2. Render Filsuf
  philLayer.innerHTML = state.ph.map((p, i) => {
    const coords = pos((i * 360) / n, 41);
    const cls = getStatusClass(p);
    return `
      <div class="philosopher ${cls}" style="left:${coords.left}; top:${coords.top}">
        <div class="avatar">P${i + 1}</div>
        <small>${p.meals}/${MEALS} makan</small>
      </div>
    `;
  }).join('');

  // 3. Render Log
  logBox.innerHTML = state.logs.map((line, idx) => {
    const isLast = idx === state.logs.length - 1;
    const isBad = line.includes('DEADLOCK');
    return `<div class="log-line ${isLast ? 'last' : ''} ${isBad ? 'bad' : ''}">${line}</div>`;
  }).join('');
  logBox.scrollTop = logBox.scrollHeight;

  // 4. Render State List
  stateList.innerHTML = state.ph.map((p, i) => {
    const cls = getStatusClass(p);
    const label = getStatusLabel(p);
    return `
      <div class="state-row">
        <span>P${i + 1}</span>
        <span class="badge ${cls}">${label}</span>
      </div>
    `;
  }).join('');

  // 5. Update Kontrol
  stepCount.textContent = `Step: ${state.currentStep}`;
  btnStep.disabled = state.done;
  btnPlay.disabled = state.done;
}

function stopAutoPlay() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  btnPlay.textContent = '▶ Auto Play';
}

function toggleAutoPlay() {
  if (timer) {
    stopAutoPlay();
  } else {
    btnPlay.textContent = '⏸ Pause';
    timer = setInterval(stepPhil, 650);
  }
}

function resetSimulation() {
  stopAutoPlay();
  const n = parseInt(nRange.value, 10);
  const mechanism = mechSelect.value;
  nVal.textContent = n;
  mechNote.textContent = `Mutex mengambil garpu satu per satu sehingga bisa deadlock. Semaphore membatasi ${n - 1} filsuf di meja. Monitor mengambil kedua garpu sekaligus.`;
  state = initPhil({ mechanism, n });
  render();
}

// Event Listeners
mechSelect.addEventListener('change', resetSimulation);
nRange.addEventListener('input', resetSimulation);
btnStep.addEventListener('click', stepPhil);
btnPlay.addEventListener('click', toggleAutoPlay);
btnReset.addEventListener('click', resetSimulation);

// Inisialisasi Awal
resetSimulation();
