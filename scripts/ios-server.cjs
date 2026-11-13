const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

const PORT = 5180;
const DIST_DIR = path.resolve(__dirname, '../dist/renderer');

// 1. Update sw.js in dist/renderer with all built asset files so iPhone caches 100% of the app offline
function injectAssetsIntoServiceWorker() {
  try {
    const assetsDir = path.join(DIST_DIR, 'assets');
    const assetFiles = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).map((f) => `./assets/${f}`)
      : [];
    const allAssets = [
      './',
      './index.html',
      './manifest.webmanifest',
      './apple-touch-icon.png',
      './icon-512.png',
      ...assetFiles
    ];

    const swContent = `const CACHE_NAME = 'nakliye-defterim-ios-v3';
const CORE_ASSETS = ${JSON.stringify(allAssets, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const networkFetch = fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || networkFetch;
    })
  );
});
`;
    fs.writeFileSync(path.join(DIST_DIR, 'sw.js'), swContent, 'utf-8');
  } catch (err) {
    console.error('SW guncelleme uyarisi:', err.message);
  }
}

injectAssetsIntoServiceWorker();

function getLocalWiFiIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({ name, address: iface.address });
      }
    }
  }
  const preferred =
    candidates.find((c) => /wi-?fi|wlan|wireless|eth/i.test(c.name)) ||
    candidates.find((c) => c.address.startsWith('192.168.') || c.address.startsWith('10.')) ||
    candidates[0];
  return preferred ? preferred.address : '127.0.0.1';
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const localIP = getLocalWiFiIP();
const lanUrl = `http://${localIP}:${PORT}`;
let httpsTunnelUrl = '';

function startHttpsTunnel() {
  try {
    const ssh = spawn('ssh', [
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'ServerAliveInterval=30',
      '-R',
      `80:127.0.0.1:${PORT}`,
      'nokey@localhost.run'
    ]);

    const onData = (chunk) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9.-]+\.lhr\.life/);
      if (match && !httpsTunnelUrl) {
        httpsTunnelUrl = match[0];
        console.log('  iPhone Kalici HTTPS Adresi : ' + httpsTunnelUrl);
      }
    };

    ssh.stdout.on('data', onData);
    ssh.stderr.on('data', onData);
    ssh.on('error', () => {});
  } catch {
    // Ignore if ssh is unavailable
  }
}

const server = http.createServer((req, res) => {
  const cleanUrl = (req.url || '/').split('?')[0];

  if (cleanUrl === '/api/tunnel-status') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ lanUrl, httpsTunnelUrl }));
    return;
  }

  if (cleanUrl === '/kurulum') {
    const primaryUrl = httpsTunnelUrl || lanUrl;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(primaryUrl)}`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nakliye Defterim — Windows'tan iPhone (iOS) Kurulum Merkezi</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #141716;
      color: #EAE6DF;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      max-width: 760px;
      width: 100%;
      background: #1B201E;
      border: 1px solid rgba(200, 169, 126, 0.28);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.55);
    }
    .badge {
      display: inline-block;
      background: rgba(45, 110, 85, 0.25);
      color: #56AB89;
      border: 1px solid rgba(45, 110, 85, 0.45);
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: #C8A97E;
    }
    p.sub {
      margin: 0 0 24px 0;
      font-size: 14px;
      color: #9BA39F;
      line-height: 1.5;
    }
    .grid {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 28px;
      align-items: center;
    }
    .qr-box {
      background: #ffffff;
      padding: 16px;
      border-radius: 16px;
      text-align: center;
    }
    .qr-box img {
      width: 220px;
      height: 220px;
      display: block;
      margin: 0 auto;
    }
    .url-pill {
      margin-top: 12px;
      background: #141716;
      border: 1px solid rgba(200, 169, 126, 0.35);
      padding: 10px 12px;
      border-radius: 10px;
      font-family: monospace;
      font-size: 13px;
      font-weight: 800;
      color: #C8A97E;
      text-align: center;
      word-break: break-all;
    }
    ol {
      margin: 0;
      padding-left: 20px;
      line-height: 1.75;
      font-size: 14px;
    }
    ol li {
      margin-bottom: 10px;
    }
    strong {
      color: #C8A97E;
    }
    .btn {
      display: inline-block;
      margin-top: 14px;
      background: #2D6E55;
      color: #fff;
      text-decoration: none;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
    }
    .lan-box {
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 12px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      font-size: 12px;
      color: #9BA39F;
    }
    @media (max-width: 680px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge" id="status-badge">● Windows -> iPhone (iOS) Canlı Kurulum Sunucusu Aktif</span>
    <h1>Windows Bilgisayardan iPhone'a Kurulum</h1>
    <p class="sub">
      Aşağıdaki QR Kodu iPhone kameranızla okutup Safari'de <strong>"Paylaş -> Ana Ekrana Ekle"</strong> dediğinizde uygulama iPhone'unuza tam ekran olarak kurulur.
    </p>
    <div class="grid">
      <div>
        <div class="qr-box">
          <img id="qr-img" src="${qrApi}" alt="iPhone Kurulum QR Kodu" />
        </div>
        <div class="url-pill" id="primary-url">${primaryUrl}</div>
      </div>
      <div>
        <ol>
          <li>iPhone'unuzda <strong>Kamera</strong> uygulamasını açın ve soldaki <strong>QR Kodu</strong> okutup çıkan sarı bağlantıya dokunun (Safari açılır).</li>
          <li>Uygulama ekrana geldiğinde Safari'nin en alt ortasındaki <strong>Paylaş (Yukarı Oklu Kare ⬆️)</strong> simgesine dokunun.</li>
          <li>Açılan menüyü biraz aşağı kaydırıp <strong>"Ana Ekrana Ekle" (Add to Home Screen)</strong> seçeneğine basın.</li>
          <li>Sağ üstteki <strong>"Ekle"</strong> butonuna basın.</li>
          <li><strong>Tamamdır!</strong> Artık iPhone ana ekranınızdaki <strong>Nakliye Defterim</strong> ikonuna basarak tam ekran kullanabilirsiniz.</li>
        </ol>
        <div class="lan-box">
          <div><strong>Ev/Ofis Wi-Fi Adresi:</strong> <span style="color:#EAE6DF;font-family:monospace">${lanUrl}</span></div>
          <div id="https-row" style="margin-top:4px;"><strong>Kalıcı HTTPS Bağlantısı (4.5G & Çevrimdışı Önbellek):</strong> <span id="https-val" style="color:#56AB89;font-family:monospace">${httpsTunnelUrl || 'Hazırlanıyor...'}</span></div>
        </div>
        <a class="btn" href="/">Uygulamayı Bilgisayarda Önizle →</a>
      </div>
    </div>
  </div>
  <script>
    setInterval(async () => {
      try {
        const res = await fetch('/api/tunnel-status');
        const data = await res.json();
        if (data.httpsTunnelUrl) {
          document.getElementById('https-val').textContent = data.httpsTunnelUrl;
          document.getElementById('primary-url').textContent = data.httpsTunnelUrl;
          const nextQr = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(data.httpsTunnelUrl);
          const img = document.getElementById('qr-img');
          if (img.src !== nextQr) img.src = nextQr;
        }
      } catch (e) {}
    }, 2000);
  </script>
</body>
</html>`);
    return;
  }

  let filePath = path.join(DIST_DIR, cleanUrl === '/' ? 'index.html' : cleanUrl);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Sunucu hatasi');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================================');
  console.log('  NAKLIYE DEFTERIM - WINDOWS -> iPHONE (iOS) KURULUM SUNUCUSU');
  console.log('==============================================================');
  console.log('  iPhone Wi-Fi Adresi   : ' + lanUrl);
  console.log('  PC Kurulum Ekranı     : http://localhost:' + PORT + '/kurulum');
  console.log('==============================================================');
  startHttpsTunnel();
  exec(`start http://localhost:${PORT}/kurulum`);
});
