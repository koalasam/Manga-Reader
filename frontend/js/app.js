const OFFLINE_META_KEY = 'pwa_offline_chapters';
const OFFLINE_CACHE_NAME = 'manga-offline-chapters-v1';

let currentSeries = null;
let savedSet = new Set();
let cachedChapters = [];

function showAuthGate() {
  document.getElementById('auth-view').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
}

function showAppShell() {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
}

async function refreshLibrary() {
  const { library } = await API.getLibrary();
  savedSet = new Set(library.map((item) => `${item.source}:${item.series_id}`));

  const grid = document.getElementById('library-grid');
  grid.innerHTML = '';
  for (const item of library) {
    grid.appendChild(
      createSeriesCard({
        source: item.source,
        id: item.series_id,
        title: item.title,
        coverUrl: item.cover_url,
        isAdult: item.is_adult === 1,
      })
    );
  }
}

function createSeriesCard(series) {
  const card = document.createElement('div');
  card.className = 'series-card';
  card.innerHTML = `
    <img src="${series.coverUrl || ''}" alt="${series.title}" loading="lazy" />
    <div class="info">
      <span class="badge">${series.source}</span>
      ${series.isAdult ? '<span class="badge badge-adult">18+</span>' : ''}
      <div class="title">${series.title}</div>
    </div>
  `;
  card.addEventListener('click', () => openSeries(series));
  return card;
}

async function openSeries(series) {
  currentSeries = series;
  document.querySelectorAll('.view-panel').forEach((el) => el.classList.add('hidden'));
  document.getElementById('series-view').classList.remove('hidden');

  document.getElementById('detail-cover').src = series.coverUrl || '';
  document.getElementById('detail-source').textContent = series.source;
  document.getElementById('detail-title').textContent = series.title;

  const adultBadge = document.getElementById('detail-adult-badge');
  if (series.isAdult) {
    adultBadge.classList.remove('hidden');
  } else {
    adultBadge.classList.add('hidden');
  }

  const saveBtn = document.getElementById('btn-save-series');
  const isSaved = savedSet.has(`${series.source}:${series.id}`);
  saveBtn.textContent = isSaved ? 'Remove from Saved' : 'Save Series';

  const list = document.getElementById('chapter-list');
  list.innerHTML = '<p>Loading chapters...</p>';

  const res = await API.getChapters(series.source, series.id);
  cachedChapters = res.chapters;
  list.innerHTML = '';

  for (let i = 0; i < cachedChapters.length; i++) {
    const ch = cachedChapters[i];
    const row = document.createElement('div');
    row.className = 'chapter-row';
    row.innerHTML = `
      <div>
        <strong>${ch.title}</strong>
        <span class="badge">${ch.cached ? 'CBZ Cached' : 'Stream & Cache'}</span>
      </div>
      <div class="chapter-actions">
        <button class="btn-primary btn-read">Read</button>
        <button class="btn-secondary btn-pwa-dl">Save Offline</button>
        <a class="btn-ghost" href="/api/download/${series.source}/${series.id}/${ch.id}/cbz">.CBZ</a>
      </div>
    `;

    row.querySelector('.btn-read').addEventListener('click', () => {
      Reader.open(series, cachedChapters, i);
    });

    row.querySelector('.btn-pwa-dl').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Downloading...';
      try {
        await downloadChapterOffline(series, ch);
        btn.textContent = 'Saved on Device';
      } catch {
        btn.disabled = false;
        btn.textContent = 'Retry';
      }
    });

    list.appendChild(row);
  }
}

async function downloadChapterOffline(series, chapter) {
  const pagesEndpoint = `/api/read/${series.source}/${series.id}/${chapter.id}/pages`;
  const data = await API.getPages(series.source, series.id, chapter.id);

  if ('caches' in window) {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    await cache.put(pagesEndpoint, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
    await Promise.all(data.pages.map((url) => cache.add(url)));
  }

  const saved = JSON.parse(localStorage.getItem(OFFLINE_META_KEY) || '[]');
  const filtered = saved.filter((x) => !(x.source === series.source && x.chapterId === chapter.id));
  filtered.unshift({
    source: series.source,
    seriesId: series.id,
    seriesTitle: series.title,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    pagesEndpoint,
  });
  localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(filtered));
  renderOfflineDownloads();
}

function renderOfflineDownloads() {
  const container = document.getElementById('offline-list');
  const saved = JSON.parse(localStorage.getItem(OFFLINE_META_KEY) || '[]');
  container.innerHTML = saved.length ? '' : '<p>No chapters downloaded to this device yet.</p>';

  for (const item of saved) {
    const row = document.createElement('div');
    row.className = 'chapter-row';
    row.innerHTML = `
      <div>
        <strong>${item.seriesTitle}</strong> — ${item.chapterTitle}
      </div>
      <div class="chapter-actions">
        <button class="btn-primary btn-read-offline">Read Offline</button>
        <button class="btn-ghost btn-del-offline">Delete</button>
      </div>
    `;
    row.querySelector('.btn-read-offline').addEventListener('click', async () => {
      const res = await fetch(item.pagesEndpoint);
      const { pages } = await res.json();
      Reader.open({ source: item.source, id: item.seriesId, title: item.seriesTitle }, [{ id: item.chapterId, title: item.chapterTitle }], 0);
    });
    row.querySelector('.btn-del-offline').addEventListener('click', async () => {
      const updated = JSON.parse(localStorage.getItem(OFFLINE_META_KEY) || '[]').filter(
        (x) => !(x.source === item.source && x.chapterId === item.chapterId)
      );
      localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(updated));
      renderOfflineDownloads();
    });
    container.appendChild(row);
  }
}

window.addEventListener('auth:required', showAuthGate);

document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  Reader.init();

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('auth-username').value;
    const p = document.getElementById('auth-password').value;
    const rem = document.getElementById('auth-remember').checked;
    try {
      await API.login(u, p, rem);
      showAppShell();
      await refreshLibrary();
    } catch (err) {
      document.getElementById('auth-error').textContent = err.message;
    }
  });

  document.getElementById('btn-register').addEventListener('click', async () => {
    const u = document.getElementById('auth-username').value;
    const p = document.getElementById('auth-password').value;
    const rem = document.getElementById('auth-remember').checked;
    try {
      await API.register(u, p, rem);
      showAppShell();
      await refreshLibrary();
    } catch (err) {
      document.getElementById('auth-error').textContent = err.message;
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await API.logout();
    showAuthGate();
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view-panel').forEach((p) => p.classList.add('hidden'));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
      if (btn.dataset.tab === 'library') refreshLibrary();
      if (btn.dataset.tab === 'offline') renderOfflineDownloads();
    });
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    document.getElementById('series-view').classList.add('hidden');
    document.getElementById('tab-search').classList.remove('hidden');
  });

  document.getElementById('btn-save-series').addEventListener('click', async () => {
    if (!currentSeries) return;
    const key = `${currentSeries.source}:${currentSeries.id}`;
    if (savedSet.has(key)) {
      await API.removeSeries(currentSeries.source, currentSeries.id);
    } else {
      await API.saveSeries({
        source: currentSeries.source,
        seriesId: currentSeries.id,
        title: currentSeries.title,
        coverUrl: currentSeries.coverUrl,
        isAdult: currentSeries.isAdult,
      });
    }
    await refreshLibrary();
    const saveBtn = document.getElementById('btn-save-series');
    saveBtn.textContent = savedSet.has(key) ? 'Remove from Saved' : 'Save Series';
  });

  document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = document.getElementById('search-input').value;
    const source = document.getElementById('search-source').value;
    const grid = document.getElementById('search-results');
    grid.innerHTML = '<p>Searching...</p>';
    const { results } = await API.search(q, source);
    grid.innerHTML = '';
    for (const item of results) {
      grid.appendChild(createSeriesCard(item));
    }
  });

  try {
    await API.me();
    showAppShell();
    await refreshLibrary();
    renderOfflineDownloads();
  } catch {
    showAuthGate();
  }
});