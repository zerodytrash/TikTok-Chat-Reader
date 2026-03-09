require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const {createServer} = require('http');
const {Server} = require('socket.io');
const NodeCache = require('node-cache');
const {TikTokConnectionWrapper, getGlobalConnectionCount} = require('./connectionWrapper');
const {clientBlocked} = require('./limiter');
const {SignConfig} = require('tiktok-live-connector');

if (process.env.API_KEY) {
    SignConfig.apiKey = process.env.API_KEY;
    console.info('Using Euler API key from environment');
}

const app = express();
const httpServer = createServer(app);

// Bypass token cache (tokens valid for 24 hours)
const bypassTokens = new NodeCache({ stdTTL: 86400 });

// Enable cross-origin resource sharing
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

async function verifyRecaptcha(token) {
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(token)}`;
    const response = await fetch(verifyUrl, { method: 'POST' });
    const result = await response.json();
    return result.success;
}

io.on('connection', (socket) => {
    let tiktokConnectionWrapper;

    console.info('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);

    socket.on('setUniqueId', async (uniqueId, options) => {

        // Prohibit the client from specifying these options (for security reasons)
        if (typeof options === 'object' && options) {
            delete options.requestOptions;
            delete options.websocketOptions;
        } else {
            options = {};
        }

        // Verify reCAPTCHA v2 or bypass token if configured
        if (process.env.RECAPTCHA_SECRET_KEY) {
            const recaptchaToken = options.recaptchaToken;
            const bypassToken = options.bypassToken;
            delete options.recaptchaToken;
            delete options.bypassToken;

            if (bypassToken && bypassTokens.has(bypassToken)) {
                // Valid bypass token, allow through
            } else if (recaptchaToken) {
                try {
                    const success = await verifyRecaptcha(recaptchaToken);
                    if (!success) {
                        socket.emit('tiktokDisconnected', 'reCAPTCHA verification failed. Please try again.');
                        return;
                    }
                } catch (err) {
                    console.error('reCAPTCHA verification error:', err);
                    socket.emit('tiktokDisconnected', 'reCAPTCHA verification error. Please try again.');
                    return;
                }
            } else {
                socket.emit('tiktokDisconnected', 'reCAPTCHA verification required.');
                return;
            }
        }

        // Session ID in .env file is optional
        if (process.env.SESSIONID) {
            options.sessionId = process.env.SESSIONID;
            console.info('Using SessionId');
        }

        // Check if rate limit exceeded
        if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
            socket.emit('tiktokDisconnected', 'You have opened too many connections or made too many connection requests. Please reduce the number of connections/requests or host your own server instance. The connections are limited to avoid that the server IP gets blocked by TokTok.');
            return;
        }

        // Disconnect previous connection if exists
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
        }

        // Connect to the given username (uniqueId)
        try {
            tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);
            tiktokConnectionWrapper.connect();
        } catch (err) {
            socket.emit('tiktokDisconnected', err.toString());
            return;
        }

        // Redirect wrapper control events once
        tiktokConnectionWrapper.once('connected', state => socket.emit('tiktokConnected', state));
        tiktokConnectionWrapper.once('disconnected', reason => socket.emit('tiktokDisconnected', reason));

        // Notify client when stream ends
        tiktokConnectionWrapper.connection.on('streamEnd', () => socket.emit('streamEnd'));

        // Redirect message events
        tiktokConnectionWrapper.connection.on('roomUser', msg => socket.emit('roomUser', msg));
        tiktokConnectionWrapper.connection.on('member', msg => socket.emit('member', msg));
        tiktokConnectionWrapper.connection.on('chat', msg => socket.emit('chat', msg));
        tiktokConnectionWrapper.connection.on('gift', msg => socket.emit('gift', msg));
        tiktokConnectionWrapper.connection.on('social', msg => socket.emit('social', msg));
        tiktokConnectionWrapper.connection.on('like', msg => socket.emit('like', msg));
        tiktokConnectionWrapper.connection.on('questionNew', msg => socket.emit('questionNew', msg));
        tiktokConnectionWrapper.connection.on('linkMicBattle', msg => socket.emit('linkMicBattle', msg));
        tiktokConnectionWrapper.connection.on('linkMicArmies', msg => socket.emit('linkMicArmies', msg));
        tiktokConnectionWrapper.connection.on('liveIntro', msg => socket.emit('liveIntro', msg));
        tiktokConnectionWrapper.connection.on('emote', msg => socket.emit('emote', msg));
        tiktokConnectionWrapper.connection.on('envelope', msg => socket.emit('envelope', msg));
    });

    socket.on('disconnect_tiktok', () => {
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
            tiktokConnectionWrapper = null;
        }
    });

    socket.on('disconnect', () => {
        if (tiktokConnectionWrapper) {
            tiktokConnectionWrapper.disconnect();
        }
    });
});

// Emit global connection statistics
setInterval(() => {
    io.emit('statistic', {globalConnectionCount: getGlobalConnectionCount()});
}, 5000)

// reCAPTCHA config endpoint
app.get('/recaptcha-config', (req, res) => {
    res.json({
        enabled: !!process.env.RECAPTCHA_SITE_KEY,
        siteKey: process.env.RECAPTCHA_SITE_KEY || null
    });
});

// Generate a bypass token after verifying reCAPTCHA v2 (for overlay URLs)
app.post('/generate-overlay-token', express.json(), async (req, res) => {
    if (!process.env.RECAPTCHA_SECRET_KEY) {
        return res.json({ token: null });
    }

    const { recaptchaToken } = req.body;
    if (!recaptchaToken) {
        return res.status(400).json({ error: 'reCAPTCHA token required' });
    }

    try {
        const success = await verifyRecaptcha(recaptchaToken);
        if (!success) {
            return res.status(403).json({ error: 'reCAPTCHA verification failed' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        bypassTokens.set(token, true);
        return res.json({ token });
    } catch (err) {
        console.error('reCAPTCHA verification error:', err);
        return res.status(500).json({ error: 'Verification error' });
    }
});

// Serve frontend files
app.use(express.static('public'));

// Start http listener
const port = process.env.PORT || 8081;
httpServer.listen(port);
console.info(`Server running! Please visit http://localhost:${port}`);
