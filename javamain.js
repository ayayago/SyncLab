function pilihModul(path, tabId) {
  const frame = document.getElementById('modul-frame');
  if (!frame) return;

  frame.src = path;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.add('active');
}

// Otomatis membuka modul yang sesuai jika diklik dari kartu di homepage.html (?modul=1, 2, atau 3)
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const modul = params.get('modul');

  if (modul === '1') pilihModul('modul-1/index.html', 'tab-1');
  else if (modul === '2') pilihModul('modul-2/index.html', 'tab-2');
  else if (modul === '3') pilihModul('modul-3/index.html', 'tab-3');
});
