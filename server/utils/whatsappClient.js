const path = require('path');

let Client, LocalAuth, MessageMedia;
let waAvailable = false;

try {
  const ww = require('whatsapp-web.js');
  Client = ww.Client;
  LocalAuth = ww.LocalAuth;
  MessageMedia = ww.MessageMedia;
  waAvailable = true;
} catch {
  console.warn('whatsapp-web.js not available, WhatsApp features disabled');
}

const qrcode = require('qrcode');

class WAClient {
  constructor() {
    this.client = null;
    this.status = 'disconnected';
    this.qrData = null;
    this._listeners = { qr: [], ready: [], disconnected: [] };
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }

  on(event, fn) {
    if (this._listeners[event]) this._listeners[event].push(fn);
    return () => { this._listeners[event] = this._listeners[event].filter(f => f !== fn); };
  }

  async init() {
    if (!waAvailable) throw new Error('whatsapp-web.js not installed');
    if (this.client) return;
    this.status = 'initializing';

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: path.join(process.cwd(), '.wwebjs_auth') }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      }
    });

    this.client.on('qr', async (qr) => {
      this.status = 'qr_pending';
      this.qrData = await qrcode.toDataURL(qr);
      this._emit('qr', this.qrData);
    });

    this.client.on('authenticated', () => {
      this.status = 'authenticated';
      this.qrData = null;
    });

    this.client.on('ready', () => {
      this.status = 'ready';
      this.qrData = null;
      console.log('✅ WhatsApp Client Ready');
      this._emit('ready', null);
    });

    this.client.on('auth_failure', () => {
      this.status = 'disconnected';
      this.client = null;
    });

    this.client.on('disconnected', () => {
      this.status = 'disconnected';
      this.client = null;
      this._emit('disconnected', null);
    });

    this.client.initialize().catch(err => {
      console.error('WhatsApp init error:', err.message);
      this.status = 'disconnected';
      this.client = null;
    });
  }

  async sendText(phone, message) {
    if (this.status !== 'ready') throw new Error('WhatsApp not connected. Please connect first.');
    await this.client.sendMessage(this._fmt(phone), message);
  }

  async sendAudio(phone, filePath) {
    if (this.status !== 'ready') throw new Error('WhatsApp not connected.');
    const media = MessageMedia.fromFilePath(filePath);
    await this.client.sendMessage(this._fmt(phone), media, { sendAudioAsVoice: true });
  }

  _fmt(phone) {
    const d = phone.replace(/\D/g, '');
    const full = d.startsWith('91') ? d : `91${d}`;
    return `${full}@c.us`;
  }

  async disconnect() {
    if (this.client) {
      await this.client.destroy().catch(() => {});
      this.client = null;
      this.status = 'disconnected';
    }
  }

  getStatus() { return { status: this.status, qr: this.qrData, available: waAvailable }; }
  isReady() { return this.status === 'ready'; }
}

module.exports = new WAClient();
