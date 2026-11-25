'use strict';
// Minimal dependency-free RFC 6455 WebSocket server (text + binary frames, ping/pong, close).
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 1 << 20;

class Socket extends EventEmitter {
  constructor(sock) {
    super();
    this.sock = sock; this.buf = Buffer.alloc(0); this.open = true; this.frag = null; this.isAlive = true;
    this.backlog = 0;
    sock.setNoDelay(true);
    sock.on('data', (d) => this._data(d));
    sock.on('close', () => this._closed());
    sock.on('error', () => this._closed());
  }
  _closed() { if (!this.open) return; this.open = false; this.emit('close'); }
  _data(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.open) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_PAYLOAD || !masked) { this.close(1009); return; }
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4);
      const payload = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) payload[i] = b[off + 4 + i] ^ mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      this._frame(fin, op, payload);
    }
  }
  _frame(fin, op, payload) {
    if (op === 0x8) { this.close(1000); return; }
    if (op === 0x9) { this._send(0xA, payload); return; }
    if (op === 0xA) { this.isAlive = true; return; }
    if (op === 0x1 || op === 0x2) this.frag = { op, parts: [] };
    if (!this.frag) return;
    this.frag.parts.push(payload);
    if (fin) {
      const data = Buffer.concat(this.frag.parts); const isText = this.frag.op === 1; this.frag = null;
      this.emit('message', isText ? data.toString('utf8') : data, isText);
    }
  }
  _send(op, payload) {
    if (!this.open) return;
    const len = payload.length; let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    this.sock.write(Buffer.concat([head, payload]));
  }
  send(data) { if (typeof data === 'string') this._send(0x1, Buffer.from(data)); else this._send(0x2, data); }
  ping() { this._send(0x9, Buffer.alloc(0)); }
  close(code = 1000) {
    if (!this.open) return;
    try { const p = Buffer.alloc(2); p.writeUInt16BE(code); this._send(0x8, p); this.sock.end(); } catch (e) { /* ignore */ }
    this._closed();
  }
}

function attach(httpServer, onConnection) {
  httpServer.on('upgrade', (req, sock) => {
    const key = req.headers['sec-websocket-key'];
    if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const ws = new Socket(sock);
    onConnection(ws, req);
  });
}
module.exports = { attach };
