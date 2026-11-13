import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createReadStream } from 'fs';
import { initDb, getDb } from './db';
import { requireAuth, registerUser, loginUser, AuthRequest } from './auth';
import { cacheChapterAsCbz, getCbzPath, isChapterCached, listCbzPages, extractCbzPage } from './cache';
import { MangaDexAPI } from './plugins/mangadex/mangadex_api';
import { WeebCentral } from './plugins/weebcentral/weebcentral';
import { siteFetch, BASE_URL as WC_BASE } from './plugins/weebcentral/http';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cookieParser());

const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));

app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);
app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ ok: true });
});
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

// --- Search with Adult Content Enabled for MangaDex ---
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const source = String(req.query.source || 'all');
    const results: any[] = [];

    if (source === 'all' || source === 'mangadex') {
      const md = await MangaDexAPI.search({
        title: q,
        limit: 20,
        includes: ['cover_art'],
        contentRating: ['safe', 'suggestive', 'erotica', 'pornographic'],
      });
      for (const item of md.data || []) {
        const title = item.attributes.title.en || Object.values(item.attributes.title)[0] || 'Untitled';
        const contentRating = item.attributes.contentRating || 'safe';
        const isAdult = contentRating === 'erotica' || contentRating === 'pornographic';
        const coverRel = item.relationships?.find((r: any) => r.type === 'cover_art');
        const rawCover = coverRel?.attributes?.fileName
          ? MangaDexAPI.coverImageUrl(item.id, coverRel.attributes.fileName, 256)
          : '';
        results.push({
          source: 'mangadex',
          id: item.id,
          title,
          isAdult,
          contentRating,
          coverUrl: rawCover ? `/api/stream?url=${encodeURIComponent(rawCover)}` : '',
        });
      }
    }

    if (source === 'all' || source === 'weebcentral') {
      const wc = await WeebCentral.search({ text: q, limit: 20 });
      for (const item of wc) {
        results.push({
          source: 'weebcentral',
          id: item.id,
          title: item.name,
          isAdult: false,
          contentRating: 'safe',
          coverUrl: item.thumbnailUrl ? `/api/stream?url=${encodeURIComponent(item.thumbnailUrl)}` : '',
        });
      }
    }

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stream', requireAuth, async (req, res) => {
  try {
    const targetUrl = String(req.query.url || '');
    const parsed = new URL(targetUrl);
    const allowedHosts = ['uploads.mangadex.org', 'weebcentral.com', 'temp.compsci88.com'];
    if (!allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
      res.status(403).json({ error: 'Host not allowed for direct streaming' });
      return;
    }

    const upstream = parsed.hostname.includes('mangadex')
      ? await fetch(targetUrl)
      : await siteFetch(targetUrl, { headers: { Referer: `${WC_BASE}/` } });

    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status || 502).end();
      return;
    }

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch {
    res.status(500).end();
  }
});

app.get('/api/series/:source/:seriesId/chapters', requireAuth, async (req, res) => {
  try {
    const source = String(req.params.source);
    const seriesId = String(req.params.seriesId);
    let chapters: any[] = [];

    if (source === 'mangadex') {
      const feed = await MangaDexAPI.mangaFeed(seriesId, {
        limit: 500,
        translatedLanguage: ['en'],
        order: { chapter: 'asc' },
      });
      chapters = (feed.data || []).map((ch: any) => ({
        id: ch.id,
        number: ch.attributes.chapter || '0',
        title: ch.attributes.title
          ? `Ch. ${ch.attributes.chapter} - ${ch.attributes.title}`
          : `Chapter ${ch.attributes.chapter || 'Oneshot'}`,
      }));
    } else if (source === 'weebcentral') {
      const list = await WeebCentral.getChapters(seriesId);
      const sorted = WeebCentral.sortChapters(list, 'asc');
      chapters = sorted.map((ch: any) => ({
        id: ch.id,
        number: String(ch.number ?? ''),
        title: ch.title,
      }));
    }

    const enriched = await Promise.all(
      chapters.map(async (ch: any) => ({
        ...ch,
        cached: await isChapterCached(source, seriesId, ch.id),
      }))
    );

    res.json({ chapters: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/read/:source/:seriesId/:chapterId/pages', requireAuth, async (req, res) => {
  try {
    const source = String(req.params.source);
    const seriesId = String(req.params.seriesId);
    const chapterId = String(req.params.chapterId);
    const cbzPath = await cacheChapterAsCbz(source, seriesId, chapterId);
    const pages = await listCbzPages(cbzPath);
    const urls = pages.map(
      (p) => `/api/read/${source}/${seriesId}/${chapterId}/image/${encodeURIComponent(p)}`
    );
    res.json({ pages: urls, cbzCached: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/read/:source/:seriesId/:chapterId/image/:pageName', requireAuth, async (req, res) => {
  try {
    const source = String(req.params.source);
    const seriesId = String(req.params.seriesId);
    const chapterId = String(req.params.chapterId);
    const pageName = String(req.params.pageName);
    const cbzPath = getCbzPath(source, seriesId, chapterId);
    const { buffer, mime } = await extractCbzPage(cbzPath, pageName);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=31536000');
    res.send(buffer);
  } catch {
    res.status(404).end();
  }
});

app.get('/api/download/:source/:seriesId/:chapterId/cbz', requireAuth, async (req, res) => {
  try {
    const source = String(req.params.source);
    const seriesId = String(req.params.seriesId);
    const chapterId = String(req.params.chapterId);
    const cbzPath = await cacheChapterAsCbz(source, seriesId, chapterId);
    res.setHeader('Content-Type', 'application/vnd.comicbook+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(cbzPath)}"`);
    createReadStream(cbzPath).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/library', requireAuth, async (req: AuthRequest, res) => {
  const db = getDb();
  const rows = await db.all('SELECT * FROM saved_series WHERE user_id = ? ORDER BY saved_at DESC', [
    req.user!.id,
  ]);
  res.json({ library: rows });
});

app.post('/api/library', requireAuth, async (req: AuthRequest, res) => {
  const { source, seriesId, title, coverUrl, isAdult } = req.body;
  const db = getDb();
  await db.run(
    `INSERT OR REPLACE INTO saved_series (user_id, source, series_id, title, cover_url, is_adult)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.user!.id, source, seriesId, title, coverUrl, isAdult ? 1 : 0]
  );
  res.json({ ok: true });
});

app.delete('/api/library/:source/:seriesId', requireAuth, async (req: AuthRequest, res) => {
  const source = String(req.params.source);
  const seriesId = String(req.params.seriesId);
  const db = getDb();
  await db.run('DELETE FROM saved_series WHERE user_id = ? AND source = ? AND series_id = ?', [
    req.user!.id,
    source,
    seriesId,
  ]);
  res.json({ ok: true });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Manga Reader server running on http://0.0.0.0:${PORT}`);
  });
});