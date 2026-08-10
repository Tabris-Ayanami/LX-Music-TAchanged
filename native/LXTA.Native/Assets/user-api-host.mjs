import readline from 'node:readline';
import vm from 'node:vm';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let context = null;
let requestHandler = null;
const send = value => process.stdout.write(JSON.stringify(value) + '\n');

const responseFor = async (url, options = {}) => {
  const method = String(options.method ?? 'GET').toUpperCase();
  const headers = options.headers ?? {};
  let body = options.body;
  if (body == null && options.form != null) {
    body = new URLSearchParams(options.form).toString();
    headers['content-type'] ??= 'application/x-www-form-urlencoded';
  }
  const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(Math.min(Number(options.timeout ?? 60000), 60000)) });
  const raw = Buffer.from(await response.arrayBuffer());
  let parsed = raw.toString('utf8');
  try { parsed = JSON.parse(parsed); } catch { /* text response */ }
  return { statusCode: response.status, statusMessage: response.statusText, headers: Object.fromEntries(response.headers.entries()), bytes: raw.length, raw, body: parsed };
};

const createContext = info => {
  const events = { request: null };
  const lx = {
    EVENT_NAMES: { request: 'request', inited: 'inited', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'desktop', currentScriptInfo: info,
    on(name, handler) { if (name !== 'request') throw new Error('unsupported event: ' + name); events.request = handler; requestHandler = handler; return Promise.resolve(); },
    send(name, data) { if (name === 'inited') send({ type: 'inited', data }); else if (name === 'updateAlert') send({ type: 'update', data }); return Promise.resolve(); },
    request(url, options = {}, callback) { let cancelled = false; responseFor(url, options).then(resp => { if (!cancelled) callback.call(this, null, resp, resp.body); }).catch(error => { if (!cancelled) callback.call(this, error, null, null); }); return () => { cancelled = true; }; },
    utils: {
      crypto: {
        randomBytes: size => crypto.randomBytes(size),
        md5: value => crypto.createHash('md5').update(String(value)).digest('hex'),
        aesEncrypt(buffer, mode, key, iv) { const cipher = crypto.createCipheriv(mode, Buffer.from(key), iv == null ? null : Buffer.from(iv)); return Buffer.concat([cipher.update(Buffer.from(buffer)), cipher.final()]); },
        rsaEncrypt(buffer, key) { return crypto.publicEncrypt({ key, padding: crypto.constants.RSA_NO_PADDING }, Buffer.concat([Buffer.alloc(128 - buffer.length), Buffer.from(buffer)])); },
      },
      buffer: { from: (...args) => Buffer.from(...args), bufToString: (buffer, format) => Buffer.from(buffer, 'binary').toString(format) },
      zlib: { inflate: data => Promise.resolve(zlib.inflateSync(Buffer.from(data))), deflate: data => Promise.resolve(zlib.deflateSync(Buffer.from(data))) },
    },
  };
  context = vm.createContext({ console, Buffer, URL, URLSearchParams, TextEncoder, TextDecoder, setTimeout, clearTimeout, fetch, AbortSignal, globalThis: null, lx });
  context.globalThis = context;
  return context;
};

rl.on('line', async line => {
  try {
    const message = JSON.parse(line);
    if (message.type === 'init') {
      createContext(message.info);
      await vm.runInContext(message.script, context, { timeout: 20000 });
      send({ type: 'ready' });
    } else if (message.type === 'request') {
      if (!requestHandler) throw new Error('request event is not defined');
      const value = await requestHandler({ source: message.source, action: message.action, info: message.info });
      let data = value;
      if (message.action === 'musicUrl') {
        if (typeof value !== 'string' || value.length > 2048 || !/^https?:/.test(value)) throw new Error('invalid music url');
        data = { source: message.source, action: message.action, data: { type: message.info.type, url: value } };
      } else if (message.action === 'pic') {
        if (typeof value !== 'string' || value.length > 2048 || !/^https?:/.test(value)) throw new Error('invalid picture url');
        data = { source: message.source, action: message.action, data: value };
      } else if (message.action === 'lyric') {
        if (!value || typeof value !== 'object' || typeof value.lyric !== 'string' || value.lyric.length > 51200) throw new Error('invalid lyric');
        data = { source: message.source, action: message.action, data: { lyric: value.lyric, tlyric: typeof value.tlyric === 'string' && value.tlyric.length < 5120 ? value.tlyric : null, rlyric: typeof value.rlyric === 'string' && value.rlyric.length < 5120 ? value.rlyric : null, lxlyric: typeof value.lxlyric === 'string' && value.lxlyric.length < 8192 ? value.lxlyric : null } };
      }
      send({ type: 'result', requestId: message.requestId, result: data });
    }
  } catch (error) {
    send({ type: 'error', requestId: (() => { try { return JSON.parse(line).requestId; } catch { return null; } })(), message: error?.message ?? String(error) });
  }
});
