// A股监控 - 数据代理服务器
// 部署到 Render / Railway 等免费平台
const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;
const TIMEOUT = 8000;

function fetchEM(url, redirectCount) {
  redirectCount = redirectCount || 0;
  if (redirectCount > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), TIMEOUT);
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://data.eastmoney.com/' } }, (res) => {
      // Handle redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(t);
        var loc = res.headers.location;
        if (loc.startsWith('//')) loc = 'https:' + loc;
        resolve(fetchEM(loc, redirectCount + 1));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { clearTimeout(t); resolve(data); });
    });
    req.on('error', (e) => { clearTimeout(t); reject(e); });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === '/api/sectors') {
      // 获取所有行业板块列表
      const raw = await fetchEM('https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=200&po=1&np=1&fltt=2&invt=2&fs=m:90+t:2&fields=f12,f14');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(raw);
    }
    else if (path === '/api/sectors-all') {
      // 获取所有行业板块资金流向（含行情数据）
      const raw = await fetchEM('https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=200&po=1&np=1&fltt=2&invt=2&fs=m:90+t:2&fields=f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f62,f115,f128,f140,f141,f136');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(raw);
    }
    else if (path === '/api/stocks') {
      // 获取板块内个股
      const sid = url.searchParams.get('id') || 'BK0447';
      const raw = await fetchEM(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=15&po=1&np=1&fltt=2&invt=2&fs=b:${sid}&fields=f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f20,f21,f62,f115,f128,f140,f141,f136`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(raw);
    }
    else if (path === '/api/global') {
      // 美股港股行情
      const [us, hk] = await Promise.all([
        fetchEM('https://push2.eastmoney.com/api/qt/ulist.np/get?secids=100.NVDA,100.AMD,100.TSLA&fields=f2,f3,f12,f14').catch(() => '{}'),
        fetchEM('https://push2.eastmoney.com/api/qt/ulist.np/get?secids=116.00700,116.09988,116.03690&fields=f2,f3,f12,f14').catch(() => '{}')
      ]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ us, hk }));
    }
    else if (path === '/api/quote') {
      // 个股实时行情
      const code = url.searchParams.get('code') || '';
      const raw = await fetchEM(`https://push2.eastmoney.com/api/qt/stock/get?secid=${code}&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f60,f116,f117,f162,f167,f168,f169,f170,f171`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(raw);
    }
    else if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    }
    else {
      res.writeHead(404);
      res.end('Not Found');
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`A股监控代理服务器运行在端口 ${PORT}`);
});
