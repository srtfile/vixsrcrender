const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// Render provides the PORT env var (usually 10000)
const PORT = process.env.PORT || 3000;
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  'Referer': 'https://vixsrc.to/',
  'Origin': 'https://vixsrc.to',
};

// 1. Helper: Request via FlareSolverr
async function flaresolverrGet(targetUrl) {
  const payload = {
    cmd: 'request.get',
    url: targetUrl,
    maxTimeout: 60000,
  };

  const res = await axios.post(FLARESOLVERR_URL, payload, { timeout: 70000 });
  if (res.data && res.data.status === 'ok') {
    return res.data.solution;
  }
  throw new Error(res.data?.message || 'FlareSolverr failed to solve challenge');
}

// 2. Decode API response (handles base64 or JSON)
function decodeApiResponse(raw) {
  let text = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);
  
  // Strip any HTML tags if wrapped in <pre> by FlareSolverr
  const preMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch) {
    text = preMatch[1].trim();
  }

  try {
    return JSON.parse(text);
  } catch (e) {}

  try {
    const padded = text + '='.repeat((4 - (text.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {}

  throw new Error('Cannot decode API response: ' + text.slice(0, 100));
}

// 3. Resolve Stream using FlareSolverr
async function resolveStreamWithFlareSolverr(movieId) {
  console.log(`[*] Resolving Movie ID ${movieId} via FlareSolverr (${FLARESOLVERR_URL})...`);

  // Step A: Fetch /api/movie/{id}
  const apiSolution = await flaresolverrGet(`https://vixsrc.to/api/movie/${movieId}`);
  const apiData = decodeApiResponse(apiSolution.response);

  let embedPath = apiData.src;
  if (!embedPath.startsWith('http')) {
    embedPath = 'https://vixsrc.to' + embedPath;
  }

  // Step B: Fetch Embed Page to extract masterPlaylist
  const embedSolution = await flaresolverrGet(embedPath);
  const html = embedSolution.response;

  // Extract window.masterPlaylist tokens
  const tokenMatch = html.match(/['"]token['"]\s*:\s*['"]([^'"]+)['"]/);
  const expiresMatch = html.match(/['"]expires['"]\s*:\s*['"]([^'"]*)['"]/);
  const urlMatch = html.match(/url\s*:\s*['"]([^'"]+)['"]/);

  if (tokenMatch && urlMatch) {
    const token = tokenMatch[1];
    const expires = expiresMatch ? expiresMatch[1] : '';
    const baseUrl = urlMatch[1];
    const masterUrl = `${baseUrl}?token=${token}&expires=${expires}&h=1&lang=en`;
    
    // Extract cookies
    const cookieHeader = (embedSolution.cookies || [])
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    return { masterUrl, cookieHeader };
  }

  throw new Error('Could not parse masterPlaylist from embed page HTML');
}

// 4. M3U8 Stream Endpoint
app.get('/play/:id.m3u8', async (req, res) => {
  try {
    const movieId = req.params.id;
    const { masterUrl, cookieHeader } = await resolveStreamWithFlareSolverr(movieId);

    const headers = { ...HEADERS };
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    const m3u8Res = await axios.get(masterUrl, { headers });
    let manifest = m3u8Res.data;

    // Rewrite chunks to pass through our relay server
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);

    const lines = manifest.split('\n');
    const rewritten = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      const absoluteUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
      return `${protocol}://${host}/segment?url=${encodeURIComponent(absoluteUrl)}`;
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten.join('\n'));
  } catch (err) {
    console.error('[!] Play error:', err.message);
    res.status(500).send('Error resolving stream: ' + err.message);
  }
});

// 5. Segment Relay (.ts chunks)
app.get('/segment', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url');

    const segmentRes = await axios({
      method: 'GET',
      url: targetUrl,
      headers: HEADERS,
      responseType: 'stream',
    });

    res.setHeader('Content-Type', segmentRes.headers['content-type'] || 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
    segmentRes.data.pipe(res);
  } catch (err) {
    res.status(502).send('Error relaying segment');
  }
});

// 6. Web Player Interface (Mobile & Desktop Friendly, Zero Ads)
app.get('/watch/:id', (req, res) => {
  const movieId = req.params.id;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Clean Stream - Movie ${movieId}</title>
  <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
  <style>
    body, html { margin:0; padding:0; width:100%; height:100%; background:#000; overflow:hidden; }
    video, .plyr { width:100% !important; height:100% !important; }
    #loader { position:fixed; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0b0f19; color:#fff; font-family:sans-serif; z-index:10; gap:12px; }
    .spinner { width:40px; height:40px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loader">
    <div class="spinner"></div>
    <p>Solving Cloudflare Challenge & Loading Stream...</p>
  </div>
  <video id="player" controls playsinline></video>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.min.js"></script>
  <script>
    const video = document.getElementById('player');
    const loader = document.getElementById('loader');
    const src = '/play/${movieId}.m3u8';
    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        loader.style.display = 'none';
        new Plyr(video, { autoplay: true });
      });
      hls.on(Hls.Events.ERROR, (e, data) => {
        if (data.fatal) {
          loader.innerHTML = '<p style="color:#ef4444;">Playback error. Please refresh.</p>';
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      loader.style.display = 'none';
      new Plyr(video, { autoplay: true });
    }
  </script>
</body>
</html>`);
});

// Default Home Page
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VixSrc Clean Stream Relay</title>
  <style>
    body { font-family:system-ui; background:#0f172a; color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:80vh; margin:0; padding:20px; }
    .card { background:#1e293b; padding:24px; border-radius:12px; max-width:440px; width:100%; box-shadow:0 10px 25px rgba(0,0,0,0.5); }
    h2 { margin-top:0; color:#38bdf8; }
    input { width:100%; padding:12px; box-sizing:border-box; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; margin:12px 0; font-size:16px; }
    button { width:100%; padding:12px; background:#0284c7; color:#fff; border:none; border-radius:6px; font-size:16px; font-weight:600; cursor:pointer; }
    button:hover { background:#0369a1; }
  </style>
</head>
<body>
  <div class="card">
    <h2>VixSrc Ad-Free Stream</h2>
    <p>Enter Movie ID to play on any device with 0 ads:</p>
    <form onsubmit="event.preventDefault(); window.location.href='/watch/' + document.getElementById('id').value.trim();">
      <input id="id" value="254" placeholder="Movie ID (e.g. 254)" />
      <button type="submit">Play Clean Stream</button>
    </form>
  </div>
</body>
</html>`);
});

// Health check endpoint for Render
app.get('/healthz', (req, res) => res.send('OK'));

app.listen(PORT, () => {
  console.log(`[+] Server running on port ${PORT}`);
  console.log(`[+] Using FlareSolverr at: ${FLARESOLVERR_URL}`);
});
