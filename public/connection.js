/**
 * Wrapper for client-side TikTok connection over Socket.IO
 * With reconnect functionality and optional reCAPTCHA v3 support.
 */
class TikTokIOConnection {
    constructor(backendUrl) {
        this.socket = io(backendUrl);
        this.uniqueId = null;
        this.options = null;
        this.recaptchaSiteKey = null;
        this.recaptchaReady = false;
        this._connecting = false;

        this.socket.on('connect', () => {
            console.info("Socket connected!");

            // Reconnect to streamer if uniqueId already set (socket.io transport reconnect)
            if (this.uniqueId && !this._connecting) {
                this.setUniqueId();
            }
        })

        this.socket.on('disconnect', () => console.warn("Socket disconnected!"))

        this.socket.on('streamEnd', () => {
            console.warn("LIVE has ended!");
            this.uniqueId = null;
        })

        this.socket.on('tiktokDisconnected', (errMsg) => {
            console.warn(errMsg);
            if (errMsg && errMsg.includes('LIVE has ended')) {
                this.uniqueId = null;
            }
        });

        // Load reCAPTCHA config from server
        this._initRecaptcha();
    }

    async _initRecaptcha() {
        try {
            const res = await fetch('/recaptcha-config');
            const config = await res.json();

            if (config.enabled && config.siteKey) {
                this.recaptchaSiteKey = config.siteKey;
                await this._loadRecaptchaScript(config.siteKey);
                this.recaptchaReady = true;
                console.info('reCAPTCHA v3 loaded');
            }
        } catch (err) {
            console.warn('Failed to load reCAPTCHA config:', err);
        }
    }

    _loadRecaptchaScript(siteKey) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    _getRecaptchaToken() {
        if (!this.recaptchaReady || !this.recaptchaSiteKey) return Promise.resolve(null);

        return new Promise((resolve) => {
            grecaptcha.ready(() => {
                grecaptcha.execute(this.recaptchaSiteKey, { action: 'connect' })
                    .then(resolve)
                    .catch((err) => {
                        console.warn('Failed to get reCAPTCHA token:', err);
                        resolve(null);
                    });
            });
        });
    }

    connect(uniqueId, options) {
        this.uniqueId = uniqueId;
        this.options = options || {};
        this._connecting = true;

        // Clean up stale listeners from any previous connect() call
        this.socket.off('tiktokConnected');
        this.socket.off('tiktokDisconnected');

        // Re-add the permanent tiktokDisconnected handler
        this.socket.on('tiktokDisconnected', (errMsg) => {
            console.warn(errMsg);
            if (errMsg && errMsg.includes('LIVE has ended')) {
                this.uniqueId = null;
            }
        });

        this.setUniqueId().then(() => {
            this._connecting = false;
        });

        return new Promise((resolve, reject) => {
            this.socket.once('tiktokConnected', resolve);
            this.socket.once('tiktokDisconnected', reject);

            setTimeout(() => {
                reject('Connection Timeout');
            }, 15000)
        })
    }

    async setUniqueId() {
        const options = { ...this.options };

        const token = await this._getRecaptchaToken();
        if (token) {
            options.recaptchaToken = token;
        }

        this.socket.emit('setUniqueId', this.uniqueId, options);
    }

    disconnect() {
        this.uniqueId = null;
        this.socket.emit('disconnect_tiktok');
    }

    on(eventName, eventHandler) {
        this.socket.on(eventName, eventHandler);
    }
}
