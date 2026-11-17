const READ_TIME = 3;    // langkah yang dibutuhkan reader untuk membaca
const WRITE_TIME = 2;   // langkah yang dibutuhkan writer untuk menulis
const STARVE_AT = 4;    // writer menunggu >= N langkah => indikasi starvation

const POLICY_NOTE = {
  reader: 'Reader-preference: reader boleh masuk selama tidak ada writer aktif, sehingga writer bisa kelaparan (starvation).',
  writer: 'Writer-preference: reader baru menunggu jika ada writer yang antre, sehingga writer lebih cepat dilayani.'
};
const POLICY_LABEL = { reader: 'Reader-preference', writer: 'Writer-preference' };

let state = null;
let timer = null;

// Elemen DOM
const policySelect = document.getElementById('policy-select');
const readersRange = document.getElementById('readers-range');
const readersVal = document.getElementById('readers-val');
const policyNote = document.getElementById('policy-note');
const rwArea = document.getElementById('rw-area');
const logBox = document.getElementById('log-box');
const stateList = document.getElementById('state-list');
const stepCount = document.getElementById('step-count');
const btnPlay = document.getElementById('btn-play');
const btnStep = document.getElementById('btn-step');
const btnReset = document.getElementById('btn-reset');

function initRW({ policy, readers }) {
  const R = Array.from({ length: readers }, (_, i) => 'R' + (i + 1));
  const W = ['W1', 'W2'];
  const queue = [];
  let r = 0, w = 0;
  // urutan kedatangan: 2 reader, 1 writer, 2 reader, 1 writer, ...
  while (r < R.length || w < W.length) {
    for (let k = 0; k < 2 && r < R.length; k++) queue.push(R[r++]);
    if (w < W.length) queue.push(W[w++]);
  }
  const procs = {};
  [...R, ...W].forEach((id) => {
    procs[id] = {
      id,
      type: id[0] === 'R' ? 'reader' : 'writer',
      status: 'idle',      // idle | waiting | active
      left: 0,
      waitSince: 0,
      finished: false
    };
  });
  return {
    policy,
    procs,
    queue,
    currentStep: 0,
    done: false,
    logs: [`Step 0: Inisialisasi ${readers} reader & 2 writer — ${POLICY_LABEL[policy]}.`]
  };
}

function stepRW() {
  if (state.done) return;
  const s = state;
  s.currentStep++;
  const L = (m) => s.logs.push(`Step ${s.currentStep}: ${m}`);
  const all = Object.values(s.procs);
  const active = () => all.filter((p) => p.status === 'active');
  const waiting = (t) => all.filter((p) => p.status === 'waiting' && p.type === t);
  const ids = (arr) => arr.map((p) => p.id).join(', ');
  const startRead = (arr) => {
    arr.forEach((p) => { p.status = 'active'; p.left = READ_TIME; });
    L(`${ids(arr)} mulai membaca`);
  };
  const startWrite = (p) => { p.status = 'active'; p.left = WRITE_TIME; L(`${p.id} mulai menulis`); };
  const wait = (p) => { p.status = 'waiting'; p.waitSince = s.currentStep; L(`${p.id} menunggu`); };

  // Setiap Step: waktu berjalan 1 satuan, lalu TEPAT SATU kejadian dicatat di log.
  active().forEach((p) => p.left--);

  // Kejadian 1: proses yang waktunya habis selesai
  const finish = () => {
    const ended = active().filter((p) => p.left <= 0);
    if (!ended.length) return false;
    ended.forEach((p) => { p.status = 'idle'; p.finished = true; });
    L(`${ids(ended)} selesai`);
    return true;
  };

  // Kejadian 2: proses berikutnya datang (langsung jalan atau menunggu)
  const arrive = () => {
    if (!s.queue.length) return false;
    const p = s.procs[s.queue.shift()];
    if (p.type === 'reader') {
      const blocked = active().some((x) => x.type === 'writer') ||
        (s.policy === 'writer' && waiting('writer').length > 0);
      blocked ? wait(p) : startRead([p]);
    } else {
      const free = active().length === 0 && !waiting('reader').length && !waiting('writer').length;
      free ? startWrite(p) : wait(p);
    }
    return true;
  };

  // Kejadian 3: proses yang menunggu dimasukkan sesuai kebijakan
  const admit = () => {
    if (active().some((x) => x.type === 'writer')) return false;
    const wr = waiting('reader');
    const wt = waiting('writer');
    const none = active().length === 0;
    if (s.policy === 'reader') {
      if (wr.length) { startRead(wr); return true; }
      if (none && wt.length) { startWrite(wt[0]); return true; }
    } else if (none) {
      if (wt.length) { startWrite(wt[0]); return true; }
      if (wr.length) { startRead(wr); return true; }
    }
    return false;
  };

  // Urutan prioritas = inti kebijakan:
  // reader-preference: reader yang datang didahulukan sebelum writer yang antre.
  // writer-preference: writer yang antre didahulukan sebelum proses yang baru datang.
  const order = s.policy === 'reader' ? [finish, arrive, admit] : [finish, admit, arrive];
  if (!order.some((fn) => fn())) {
    const a = active();
    L(a.length ? `${ids(a)} masih ${a[0].type === 'reader' ? 'membaca' : 'menulis'}` : 'tidak ada perubahan');
  }

  if (!s.queue.length && all.every((p) => p.status === 'idle')) {
    s.done = true;
    s.logs.push('Selesai. Semua reader dan writer sudah mengakses database ✓');
  }

  if (s.done) stopAutoPlay();
  render();
}

function getStatusClass(p) {
  if (p.status === 'active') return 'running';
  if (p.status === 'waiting') return 'waiting';
  if (p.finished) return 'done';
  return 'ready';
}

function getStatusLabel(p) {
  if (p.status === 'active') return p.type === 'reader' ? 'Membaca' : 'Menulis';
  if (p.status === 'waiting') return 'Menunggu';
  if (p.finished) return 'Selesai';
  return 'Idle';
}

function render() {
  const list = Object.values(state.procs);
  const readers = list.filter((p) => p.type === 'reader');
  const writers = list.filter((p) => p.type === 'writer');

  // posisi node: reader di kiri, writer di kanan
  const place = (arr, x) => arr.map((p, i) => ({
    p, x, y: arr.length === 1 ? 50 : 24 + (i * 52) / (arr.length - 1)
  }));
  const nodes = [...place(readers, 14), ...place(writers, 88)];

  const actR = readers.filter((p) => p.status === 'active');
  const actW = writers.filter((p) => p.status === 'active');
  const dbText = actW.length
    ? `ditulis oleh ${actW[0].id}`
    : actR.length ? `dibaca oleh ${actR.map((p) => p.id).join(', ')}` : 'kosong';
  const dbClass = actW.length ? 'writing' : actR.length ? 'reading' : '';

  // 1. Render Visualisasi
  rwArea.innerHTML =
    `<svg class="rw-lines" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    nodes.map(({ p, x, y }) =>
      `<line class="rw-line ${getStatusClass(p)}" x1="${x}" y1="${y}" x2="50" y2="50" vector-effect="non-scaling-stroke"></line>`
    ).join('') +
    `</svg>` +
    `<div class="rw-label reader" style="left:14%">Reader</div>` +
    `<div class="rw-label writer" style="left:88%">Writer</div>` +
    `<div class="rw-db ${dbClass}">Database<small>${dbText}</small></div>` +
    nodes.map(({ p, x, y }) => `
      <div class="rw-node ${p.type} ${getStatusClass(p)}" style="left:${x}%; top:${y}%">
        <div class="avatar">${p.id}</div>
        <small>${getStatusLabel(p)}</small>
      </div>`).join('');

  // 2. Render Log
  logBox.innerHTML = state.logs.map((line, idx) => {
    const isLast = idx === state.logs.length - 1;
    return `<div class="log-line ${isLast ? 'last' : ''}">${line}</div>`;
  }).join('');
  logBox.scrollTop = logBox.scrollHeight;

  // 3. Render State List
  const waitW = writers.filter((p) => p.status === 'waiting');
  const longest = list
    .filter((p) => p.status === 'waiting')
    .reduce((m, p) => Math.max(m, state.currentStep - p.waitSince), 0);
  const starving = waitW.length > 0 && longest >= STARVE_AT;

  stateList.innerHTML = `
    <div class="state-summary">
      <div class="state-row"><span>Reader aktif</span><b>${actR.length}</b></div>
      <div class="state-row"><span>Writer menunggu</span><b>${waitW.length}</b></div>
      <div class="state-row"><span>Tunggu terlama</span><b>${longest} langkah</b></div>
      ${starving ? '<div class="starvation">Indikasi starvation</div>' : ''}
    </div>` +
    list.map((p) => `
      <div class="state-row">
        <span>${p.type === 'reader' ? 'Reader' : 'Writer'} ${p.id}</span>
        <span class="badge ${getStatusClass(p)}">${getStatusLabel(p)}</span>
      </div>`).join('');

  // 4. Update Kontrol
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
    timer = setInterval(stepRW, 650);
  }
}

function resetSimulation() {
  stopAutoPlay();
  const readers = parseInt(readersRange.value, 10);
  const policy = policySelect.value;
  readersVal.textContent = readers;
  policyNote.textContent = POLICY_NOTE[policy];
  state = initRW({ policy, readers });
  render();
}

// Event Listeners
policySelect.addEventListener('change', resetSimulation);
readersRange.addEventListener('input', resetSimulation);
btnStep.addEventListener('click', stepRW);
btnPlay.addEventListener('click', toggleAutoPlay);
btnReset.addEventListener('click', resetSimulation);

// Inisialisasi Awal
resetSimulation();
