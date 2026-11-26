const OPS = {
  inc: { name: 'increment', sym: '+1', fn: (v) => v + 1 },
  dec: { name: 'decrement', sym: '-1', fn: (v) => v - 1 },
  dbl: { name: 'double', sym: '×2', fn: (v) => v * 2 }
};

const MECH_LABEL = {
  none: 'Tanpa Mutex',
  peterson: 'Dengan Peterson',
  mutex: 'Dengan Mutex'
};

const MECH_NOTE = {
  none: 'Tanpa mutex, semua thread membaca nilai yang sama lebih dulu, lalu menimpa hasil satu sama lain (lost update).',
  peterson: 'Dengan Peterson, thread mengangkat flag lalu mengalah (turn) ke thread lain. Thread hanya masuk critical section jika tidak ada thread lain yang ingin masuk atau gilirannya sudah tiba. Untuk >2 thread dipakai versi umumnya (Filter Algorithm).',
  mutex: 'Dengan mutex, thread mengunci counter sebelum membaca dan baru melepasnya setelah menulis, sehingga bergantian.'
};

const STATUS_LABEL = {
  ready: 'Siap',
  running: 'Membaca',
  op: 'Menghitung',
  write: 'Menulis',
  waiting: 'Menunggu',
  lock: 'Lock',
  done: 'Selesai'
};

let state = null;
let timer = null;
let lastCounter = null;

// Elemen DOM
const mechSelect = document.getElementById('mech-select');
const nRange = document.getElementById('n-range');
const nVal = document.getElementById('n-val');
const initInput = document.getElementById('init-input');
const opSelect = document.getElementById('op-select');
const mechNote = document.getElementById('mech-note');
const viz = document.getElementById('viz');
const arrowLayer = document.getElementById('arrow-layer');
const counterDisc = document.getElementById('counter-disc');
const threadsLayer = document.getElementById('threads');
const counterValue = document.getElementById('counter-value');
const lockChip = document.getElementById('lock-chip');
const logBox = document.getElementById('log-box');
const stateList = document.getElementById('state-list');
const stepCount = document.getElementById('step-count');
const btnPlay = document.getElementById('btn-play');
const btnStep = document.getElementById('btn-step');
const btnReset = document.getElementById('btn-reset');

const nameOf = (i) => String.fromCharCode(65 + i); // 0 → A

function readInit() {
  let v = parseInt(initInput.value, 10);
  if (Number.isNaN(v)) v = 0;
  return Math.max(-999, Math.min(999, v));
}

function initRace({ mechanism, n, init, op }) {
  return {
    mechanism,
    op,
    n,
    init,
    ptr: 0,
    currentStep: 1,
    done: false,
    counter: init,
    lock: null,   // thread yang memegang mutex
    active: null, // thread yang baru saja bergerak
    level: Array(n).fill(0),     // Peterson: flag/level tiap thread (0 = tidak ingin masuk)
    victim: Array(n).fill(null), // Peterson: turn/victim per level
    th: Array.from({ length: n }, (_, i) => ({
      id: i,
      stage: 'idle', // idle → lock → read → op → write
      local: null
    })),
    logs: [`Step 1: Inisialisasi ${n} thread — ${MECH_LABEL[mechanism]}, counter = ${init}.`]
  };
}

function expectedValue(st) {
  let v = st.init;
  for (let i = 0; i < st.n; i++) v = OPS[st.op].fn(v);
  return v;
}

// Satu aksi untuk thread i. Mengembalikan true jika thread berhasil bergerak.
function act(st, i, L) {
  const p = st.th[i];
  const o = OPS[st.op];
  const nm = nameOf(i);

  if (p.stage === 'write') return false;

  // Belum mulai: dengan mutex harus mengunci dulu
  if (p.stage === 'idle' && st.mechanism === 'mutex') {
    if (st.lock !== null) return false; // mutex dipegang thread lain → menunggu
    st.lock = i;
    p.stage = 'lock';
    L(`${nm} mengunci mutex`);
    return true;
  }

  // Peterson: angkat flag → mengalah (turn) → tunggu giliran → masuk critical section
  if (st.mechanism === 'peterson' && ['idle', 'flag', 'turn'].includes(p.stage)) {
    const two = st.n === 2;
    const lv = st.level[i];

    if (p.stage === 'idle') {
      st.level[i] = 1;
      p.stage = 'flag';
      L(two ? `${nm} set flag[${nm}] = true` : `${nm} set level[${nm}] = 1`);
      return true;
    }

    if (p.stage === 'flag') {
      st.victim[lv] = i;
      p.stage = 'turn';
      L(two ? `${nm} set turn = ${nameOf(1 - i)} (mengalah)` : `${nm} set victim[${lv}] = ${nm} (mengalah)`);
      return true;
    }

    // stage 'turn': busy waiting selama thread lain ingin masuk dan giliran masih milik thread ini
    const blocked = st.victim[lv] === i &&
      st.level.some((x, k) => k !== i && x >= lv);
    if (blocked) return false;

    if (lv < st.n - 1) {
      st.level[i] = lv + 1;
      p.stage = 'flag';
      L(`${nm} lolos level ${lv}, set level[${nm}] = ${lv + 1}`);
    } else {
      st.lock = i;
      p.stage = 'lock';
      L(`${nm} masuk critical section`);
    }
    return true;
  }

  // Baca nilai shared counter ke variabel lokal
  if (p.stage === 'idle' || p.stage === 'lock') {
    p.local = st.counter;
    p.stage = 'read';
    L(`${nm} membaca data (counter = ${st.counter})`);
    return true;
  }

  // Hitung di variabel lokal
  if (p.stage === 'read') {
    const before = p.local;
    p.local = o.fn(before);
    p.stage = 'op';
    L(`${nm} ${o.name} (${before} ${o.sym})`);
    return true;
  }

  // Tulis kembali hasil ke shared counter
  if (p.stage === 'op') {
    st.counter = p.local;
    p.stage = 'write';
    if (st.mechanism === 'mutex') {
      st.lock = null;
      L(`${nm} menulis nilai ${p.local}, melepas mutex`);
    } else if (st.mechanism === 'peterson') {
      st.level[i] = 0;
      st.lock = null;
      L(st.n === 2
        ? `${nm} menulis nilai ${p.local}, set flag[${nm}] = false`
        : `${nm} menulis nilai ${p.local}, set level[${nm}] = 0`);
    } else {
      L(`${nm} menulis nilai ${p.local}`);
    }
    return true;
  }

  return false;
}

// Maju satu langkah pada state tertentu (tanpa menyentuh DOM)
function advance(st) {
  if (st.done) return;
  st.currentStep++;
  const L = (m) => st.logs.push(`Step ${st.currentStep}: ${m}`);

  // Semua thread sudah menulis → simulasi selesai
  if (st.th.every((p) => p.stage === 'write')) {
    const expected = expectedValue(st);
    st.done = true;
    st.active = null;
    if (st.counter !== expected) {
      L(`Selesai. Race condition! Counter = ${st.counter}, seharusnya ${expected}.`);
    } else if (st.mechanism === 'none') {
      L('Selesai. Hasil kebetulan sama (0 × 2 = 0), race tidak terlihat. Coba nilai awal ≠ 0.');
    } else {
      L(`Selesai. Counter = ${st.counter}, sesuai harapan ✓`);
    }
    return;
  }

  let moved = false;
  for (let k = 0; k < st.n; k++) {
    const i = (st.ptr + k) % st.n;
    if (act(st, i, L)) {
      st.ptr = (i + 1) % st.n;
      st.active = i;
      moved = true;
      break;
    }
  }

  if (!moved) {
    st.done = true;
    st.active = null;
    L('Tidak ada thread yang bisa bergerak.');
  }
}

function stepRace() {
  if (state.done) return;
  advance(state);
  if (state.done) {
    stopAutoPlay();
    simpanHasilRace(state);
  }
  render();
}

function getStatusClass(i) {
  const p = state.th[i];
  if (state.done) return 'done';
  if (i === state.active) {
    return { flag: 'waiting', turn: 'waiting', lock: 'lock', read: 'running', op: 'op', write: 'write' }[p.stage];
  }
  if (p.stage === 'write') return 'done';
  if (state.lock === i) return 'lock';
  if (p.stage === 'idle') {
    return state.mechanism === 'mutex' && state.lock !== null && state.lock !== i ? 'waiting' : 'ready';
  }
  return 'waiting';
}

function render() {
  // 1. Render Thread
  threadsLayer.innerHTML = state.th.map((p, i) => {
    const cls = getStatusClass(i);
    const active = i === state.active ? ' active' : '';
    const info = p.local === null
      ? 'Local: –'
      : state.done ? `Akhir: ${p.local}` : `Local: ${p.local}`;
    return `
      <div class="thread ${cls}${active}" id="thread-${i}">
        <div class="avatar">${nameOf(i)}</div>
        <small>${info}</small>
      </div>
    `;
  }).join('');

  // 2. Render Shared Counter
  counterValue.textContent = state.counter;
  counterValue.parentElement.classList.toggle('long', String(state.counter).length >= 4);
  if (lastCounter !== null && lastCounter !== state.counter) {
    counterValue.classList.remove('bump');
    void counterValue.offsetWidth; // restart animasi
    counterValue.classList.add('bump');
  }
  lastCounter = state.counter;

  if ((state.mechanism === 'mutex' || state.mechanism === 'peterson') && !state.done) {
    lockChip.hidden = false;
    const locked = state.lock !== null;
    lockChip.className = `badge ${locked ? 'lock' : 'ready'}`;
    if (state.mechanism === 'mutex') {
      lockChip.textContent = locked ? `Mutex dikunci oleh ${nameOf(state.lock)}` : 'Mutex bebas';
    } else {
      lockChip.textContent = locked ? `Critical section: ${nameOf(state.lock)}` : 'Critical section kosong';
    }  
  } else {
    lockChip.hidden = true;
  }

  // 3. Render Log
  logBox.innerHTML = state.logs.map((line, idx) => {
    const isLast = idx === state.logs.length - 1;
    const isBad = line.includes('Race condition');
    return `<div class="log-line ${isLast ? 'last' : ''} ${isBad ? 'bad' : ''}">${line}</div>`;
  }).join('');
  logBox.scrollTop = logBox.scrollHeight;

  // 4. Render State List
  stateList.innerHTML = state.th.map((p, i) => {
    const cls = getStatusClass(i);
    return `
      <div class="state-row">
        <span>Thread ${nameOf(i)}</span>
        <span class="badge ${cls}">${STATUS_LABEL[cls]}</span>
      </div>
    `;
  }).join('');
  stateList.innerHTML += `
    <div class="state-row">
      <span>Counter</span>
      <strong>${state.counter}</strong>
    </div>
  `;

  // 5. Update Kontrol
  stepCount.textContent = `Step: ${state.currentStep}`;
  btnStep.disabled = state.done;
  btnPlay.disabled = state.done;

  // 6. Panah (dihitung setelah layout selesai)
  requestAnimationFrame(renderArrow);
}

// Panah antara thread aktif dan shared counter.
const ARROW_COLOR = {
  lock: '#bcaaa4',
  running: '#a5d6a7',
  op: '#b39ddb',
  write: '#90caf9'
};

function renderArrow() {
  arrowLayer.innerHTML = '';
  if (!state || state.done || state.active === null) return;

  const avatar = document.getElementById(`thread-${state.active}`);
  if (!avatar) return;

  const vr = viz.getBoundingClientRect();
  const ar = avatar.getBoundingClientRect();
  const dr = counterDisc.getBoundingClientRect();

  const ax = ar.left + ar.width / 2 - vr.left;
  const ay = ar.bottom - vr.top + 2;
  const dcx = dr.left + dr.width / 2 - vr.left;
  const dx = dcx + Math.max(-30, Math.min(30, (ax - dcx) * 0.3));
  const dy = dr.top - vr.top - 4;

  const cls = getStatusClass(state.active);
  if (cls === 'waiting') return;
  const color = ARROW_COLOR[cls] || '#cfd8dc';
  const reading = cls === 'running';
  const computing = cls === 'op';

  const [x1, y1, x2, y2] = reading ? [dx, dy, ax, ay] : [ax, ay, dx, dy];
  const cx = (x1 + x2) / 2 + (x2 - x1) * 0.25;
  const cy = (y1 + y2) / 2;

  let head = '';
  if (!computing) {
    const ang = Math.atan2(y2 - cy, x2 - cx);
    const len = 11;
    const spread = 0.5;
    const hx1 = x2 - len * Math.cos(ang - spread);
    const hy1 = y2 - len * Math.sin(ang - spread);
    const hx2 = x2 - len * Math.cos(ang + spread);
    const hy2 = y2 - len * Math.sin(ang + spread);
    head = `<path d="M${hx1},${hy1} L${x2},${y2} L${hx2},${hy2}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  arrowLayer.innerHTML =
    `<path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"${computing ? ' stroke-dasharray="2 8"' : ''}/>` +
    head;
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
    timer = setInterval(stepRace, 650);
  }
}

function resetSimulation() {
  stopAutoPlay();
  const mechanism = mechSelect.value;
  const n = parseInt(nRange.value, 10);
  const init = readInit();
  initInput.value = init;
  nVal.textContent = n;
  mechNote.textContent = MECH_NOTE[mechanism];
  state = initRace({ mechanism, n, init, op: opSelect.value });
  lastCounter = null;
  render();
}

// ==========================================
// LOGIKA POP-UP PERBANDINGAN RACE CONDITION
// ==========================================
const NAMA_MEKANISME_TABEL = {
  none: 'Tanpa mutex',
  peterson: "Peterson's algorithm",
  mutex: 'Mutex'
};

function simpanHasilRace(st) {
  const riwayat = JSON.parse(localStorage.getItem('syncLab_race_results')) || {};
  const expected = expectedValue(st);
  const terjadiRace = st.counter !== expected || st.mechanism === 'none';

  // Hitung berapa thread yang tertimpa (lost update)
  const jumlahRace = terjadiRace ? Math.max(1, st.n - 1) : 0;

  let penilaian = 'Terbaik';
  let kelasBadge = 'terbaik';

  if (terjadiRace) {
    penilaian = 'Buruk';
    kelasBadge = 'buruk';
  } else if (st.mechanism === 'peterson') {
    penilaian = 'Baik';
    kelasBadge = 'baik';
  }

  riwayat[st.mechanism] = {
    mekanisme: NAMA_MEKANISME_TABEL[st.mechanism],
    jumlahProses: st.n,
    jumlahStep: st.currentStep,
    nilaiRasio: `${st.counter} / ${expected}`,
    raceText: `${jumlahRace} kali`,
    penilaian: penilaian,
    kelasBadge: kelasBadge
  };

  localStorage.setItem('syncLab_race_results', JSON.stringify(riwayat));
}

function bukaModalRace() {
  renderTabelRace();
  document.getElementById('modal-race').classList.add('show');
}

function tutupModalRace() {
  document.getElementById('modal-race').classList.remove('show');
}

function tutupModalRaceLuar(e) {
  if (e.target.id === 'modal-race') tutupModalRace();
}

function resetRiwayatRace() {
  localStorage.removeItem('syncLab_race_results');
  renderTabelRace();
}

function renderTabelRace() {
  const saved = JSON.parse(localStorage.getItem('syncLab_race_results')) || {};
  const daftar = ['none', 'peterson', 'mutex'];

  const tbody = document.getElementById('tabel-hasil-race');
  if (!tbody) return;

  tbody.innerHTML = daftar.map(key => {
    const row = saved[key];
    if (!row) {
      return `
        <tr>
          <td>${NAMA_MEKANISME_TABEL[key]}</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td style="color: #90a4ae;">Belum dijalankan</td>
          <td>-</td>
        </tr>
      `;
    }
    return `
      <tr>
        <td>${row.mekanisme}</td>
        <td>${row.jumlahProses}</td>
        <td>${row.jumlahStep}</td>
        <td>${row.nilaiRasio}</td>
        <td>${row.raceText}</td>
        <td><span class="eval-badge ${row.kelasBadge}">${row.penilaian}</span></td>
      </tr>
    `;
  }).join('');
}

// Event Listeners
mechSelect.addEventListener('change', resetSimulation);
nRange.addEventListener('input', resetSimulation);
initInput.addEventListener('change', resetSimulation);
opSelect.addEventListener('change', resetSimulation);
btnStep.addEventListener('click', stepRace);
btnPlay.addEventListener('click', toggleAutoPlay);
btnReset.addEventListener('click', resetSimulation);
window.addEventListener('resize', renderArrow);

// Inisialisasi Awal
resetSimulation();
