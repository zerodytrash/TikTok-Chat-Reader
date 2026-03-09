require('dotenv').config();

const express = require('express');
const {createServer} = require('http');
const {Server} = require('socket.io');
const {TikTokConnectionWrapper, getGlobalConnectionCount} = require('./connectionWrapper');
const {clientBlocked} = require('./limiter');
const {SignConfig} = require('tiktok-live-connector');

if (process.env.API_KEY) {
    SignConfig.apiKey = process.env.API_KEY;
    console.info('Using Euler API key from environment');
}

const app = express();
const httpServer = createServer(app);

// Enable cross-origin resource sharing
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});


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

        // Verify reCAPTCHA v3 token if configured
        if (process.env.RECAPTCHA_SECRET_KEY) {
            const recaptchaToken = options.recaptchaToken;
            delete options.recaptchaToken;

            if (!recaptchaToken) {
                socket.emit('tiktokDisconnected', 'reCAPTCHA verification required.');
                return;
            }

            try {
                const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(recaptchaToken)}`;
                const response = await fetch(verifyUrl, { method: 'POST' });
                const result = await response.json();

                if (!result.success || result.score < 0.5) {
                    console.info(`reCAPTCHA failed for ${uniqueId}: success=${result.success}, score=${result.score}`);
                    socket.emit('tiktokDisconnected', 'reCAPTCHA verification failed. Please try again.');
                    return;
                }
            } catch (err) {
                console.error('reCAPTCHA verification error:', err);
                socket.emit('tiktokDisconnected', 'reCAPTCHA verification error. Please try again.');
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
            socket.emit('tiktokDisconnected', 'Disconnected by user.');
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

// reCAPTCHA v3 config endpoint
app.get('/recaptcha-config', (req, res) => {
    res.json({
        enabled: !!process.env.RECAPTCHA_SITE_KEY,
        siteKey: process.env.RECAPTCHA_SITE_KEY || null
    });
});

// Serve frontend files
app.use(express.static('public'));

// Start http listener
const port = process.env.PORT || 8081;
httpServer.listen(port);
console.info(`Server running! Please visit http://localhost:${port}`);