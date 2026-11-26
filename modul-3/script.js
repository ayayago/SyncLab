const READ_TIME = 3;    // langkah yang dibutuhkan reader untuk membaca
const WRITE_TIME = 4;   // langkah yang dibutuhkan writer untuk menulis

const POLICY_NOTE = {
  reader: 'Reader-preference: reader boleh masuk selama tidak ada writer aktif, sehingga writer bisa kelaparan (starvation).',
  writer: 'Writer-preference: reader baru menunggu jika ada writer yang antre, sehingga writer lebih cepat dilayani.',
  fifo: 'FIFO / Fair: semua proses dilayani sesuai urutan datang, tanpa ada yang dilewati. Reader yang berurutan di antrean boleh membaca bersamaan.'
};
const POLICY_LABEL = {
  reader: 'Reader-preference',
  writer: 'Writer-preference',
  fifo: 'FIFO / Fair'
};

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
      finished: false,
      served: false
    };
  });
  return {
    policy,
    readersCount: readers,
    procs,
    order: Object.fromEntries(queue.map((id, i) => [id, i])),
    queue,
    currentStep: 0,
    hadStarvation: false,
    starvedTypes: new Set(),
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
  const waiting = (t) => all
    .filter((p) => p.status === 'waiting' && (!t || p.type === t))
    .sort((a, b) => s.order[a.id] - s.order[b.id]);
  const ids = (arr) => arr.map((p) => p.id).join(', ');
  const startRead = (arr) => {
    arr.forEach((p) => { p.status = 'active'; p.left = READ_TIME; p.served = true; });
    L(`${ids(arr)} mulai membaca`);
  };
  const startWrite = (p) => {
    p.status = 'active'; p.left = WRITE_TIME; p.served = true;
    L(`${p.id} mulai menulis`);
  };
  const wait = (p) => { p.status = 'waiting'; p.waitSince = s.currentStep; L(`${p.id} menunggu`); };

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
        (s.policy === 'writer' && waiting('writer').length > 0) ||
        (s.policy === 'fifo' && waiting().length > 0);
      blocked ? wait(p) : startRead([p]);
    } else {
      const free = active().length === 0 && waiting().length === 0;
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
    } else if (s.policy === 'fifo') {
      const q = waiting();
      if (!q.length) return false;
      if (q[0].type === 'writer') {
        if (none) { startWrite(q[0]); return true; }
        return false;
      }
      const batch = [];
      for (const x of q) { if (x.type === 'reader') batch.push(x); else break; }
      startRead(batch);
      return true;
    } else if (none) {
      if (wt.length) { startWrite(wt[0]); return true; }
      if (wr.length) { startRead(wr); return true; }
    }
    return false;
  };

  const order = s.policy === 'reader' ? [finish, arrive, admit] : [finish, admit, arrive];
  const eventHappened = order.some((fn) => fn());

  // Catat jika terjadi indikasi starvation selama langkah berjalan
  const overtakenNow = all.filter((w) => w.status === 'waiting' &&
    all.some((x) => x.served && s.order[x.id] > s.order[w.id]));
  if (overtakenNow.length > 0) {
    s.hadStarvation = true;
    overtakenNow.forEach((p) => s.starvedTypes.add(p.type === 'writer' ? 'Writer' : 'Reader'));
  }

  const totalOf = (p) => (p.type === 'reader' ? READ_TIME : WRITE_TIME);
  const progress = (p) => `${p.id} sedang ${p.type === 'reader' ? 'membaca' : 'menulis'} (${totalOf(p) - p.left}/${totalOf(p)})`;
  const running = active().filter((p) => p.left < totalOf(p));
  if (!eventHappened) {
    L(running.length ? running.map(progress).join(', ') : 'tidak ada perubahan');
  } else if (running.length) {
    s.logs[s.logs.length - 1] += ' · ' + running.map(progress).join(', ');
  }

  if (!s.queue.length && all.every((p) => p.status === 'idle')) {
    s.done = true;
    s.logs.push('Selesai. Semua reader dan writer sudah mengakses database ✓');
  }

  if (s.done) {
    stopAutoPlay();
    simpanHasilRW(s);
  }
  render();
}

function getStatusClass(p) {
  if (p.status === 'active') return 'running';
  if (p.status === 'waiting') return 'waiting';
  if (p.finished) return 'done';
  return 'ready';
}

function getStatusLabel(p) {
  if (p.status === 'active') {
    const total = p.type === 'reader' ? READ_TIME : WRITE_TIME;
    return `${p.type === 'reader' ? 'Membaca' : 'Menulis'} (${total - p.left}/${total})`;
  }
  if (p.status === 'waiting') return 'Menunggu';
  if (p.finished) return 'Selesai';
  return 'Idle';
}

function render() {
  const list = Object.values(state.procs);
  const readers = list.filter((p) => p.type === 'reader');
  const writers = list.filter((p) => p.type === 'writer');

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

  const queueList = list
    .filter((p) => p.status === 'waiting')
    .sort((a, b) => state.order[a.id] - state.order[b.id]);
  const queueHtml = state.policy === 'fifo'
    ? `<div class="rw-queue"><span class="rw-queue-title">Antrean FIFO</span>` +
      (queueList.length
        ? `<small>depan</small>` +
          queueList.map((p, i) => `<span class="q-chip ${p.type}${i === 0 ? ' head' : ''}">${p.id}</span>`).join('<span class="q-arrow">→</span>') +
          `<small>belakang</small>`
        : `<span class="q-empty">kosong</span>`) +
      `</div>`
    : '';

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
    queueHtml +
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
  const overtaken = list.filter((w) => w.status === 'waiting' &&
    list.some((x) => x.served && state.order[x.id] > state.order[w.id]));
  const starving = overtaken.length > 0;

  stateList.innerHTML = `
    <div class="state-summary">
      <div class="state-row"><span>Reader aktif</span><b>${actR.length}</b></div>
      <div class="state-row"><span>Writer menunggu</span><b>${waitW.length}</b></div>
      <div class="state-row"><span>Tunggu terlama</span><b>${longest} langkah</b></div>
      ${starving ? `<div class="starvation">Indikasi starvation: ${overtaken.map((p) => p.id).join(', ')} dilewati</div>` : ''}
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

// ==========================================
// LOGIKA POP-UP PERBANDINGAN READERS-WRITERS
// ==========================================
function simpanHasilRW(st) {
  const riwayat = JSON.parse(localStorage.getItem('syncLab_rw_results')) || {};

  let risikoText = 'Tidak ada';
  let penilaian = 'Terbaik';
  let kelasBadge = 'terbaik';

  if (st.hadStarvation) {
    const pihak = Array.from(st.starvedTypes).join(' & ');
    risikoText = `Starvation (${pihak})`;
    penilaian = st.policy === 'reader' ? 'Buruk' : 'Cukup';
    kelasBadge = st.policy === 'reader' ? 'buruk' : 'cukup';
  } else if (st.policy !== 'fifo') {
    penilaian = 'Baik';
    kelasBadge = 'baik';
  }

  riwayat[st.policy] = {
    mekanisme: POLICY_LABEL[st.policy],
    jumlahReader: `${st.readersCount} reader (2 writer)`,
    jumlahStep: st.currentStep,
    risiko: risikoText,
    penilaian: penilaian,
    kelasBadge: kelasBadge
  };

  localStorage.setItem('syncLab_rw_results', JSON.stringify(riwayat));
}

function bukaModalRW() {
  renderTabelRW();
  const modal = document.getElementById('modal-rw');
  modal.hidden = false;
  modal.classList.add('show');
}

function tutupModalRW() {
  const modal = document.getElementById('modal-rw');
  modal.classList.remove('show');
  modal.hidden = true;
}

function tutupModalRWLuar(e) {
  if (e.target.id === 'modal-rw') tutupModalRW();
}

function resetRiwayatRW() {
  localStorage.removeItem('syncLab_rw_results');
  renderTabelRW();
}

function renderTabelRW() {
  const saved = JSON.parse(localStorage.getItem('syncLab_rw_results')) || {};
  const daftar = ['reader', 'writer', 'fifo'];

  const tbody = document.getElementById('tabel-hasil-rw');
  if (!tbody) return;

  tbody.innerHTML = daftar.map(key => {
    const row = saved[key];
    if (!row) {
      return `
        <tr>
          <td>${POLICY_LABEL[key]}</td>
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
        <td>${row.jumlahReader}</td>
        <td>${row.jumlahStep}</td>
        <td>${row.risiko}</td>
        <td><span class="eval-badge ${row.kelasBadge}">${row.penilaian}</span></td>
      </tr>
    `;
  }).join('');
}

// Event Listeners
policySelect.addEventListener('change', resetSimulation);
readersRange.addEventListener('input', resetSimulation);
btnStep.addEventListener('click', stepRW);
btnPlay.addEventListener('click', toggleAutoPlay);
btnReset.addEventListener('click', resetSimulation);

// Inisialisasi Awal
resetSimulation();
