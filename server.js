
const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const proxyList = [
  'http://71.163.238.129:1236',
  'http://208.113.153.30:46293',
  'http://64.90.52.19:55552'
  // ...more proxies
];

let joinMsgDelay = 0;  // Initialize before using

// Create a rate-limited Axios instance: 1 request per 2 seconds
const http = rateLimit(axios.create(), { maxRequests: 1, perMilliseconds: 2000 });

// Exponential backoff settings
const maxRetries = 5;
const retryDelay = 2000; // initial retry delay in ms

async function makeRequestWithRetry(axiosInstance, url, retries = maxRetries, delay = retryDelay) {
  try {
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      console.log(`Rate limit exceeded. Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeRequestWithRetry(axiosInstance, url, retries - 1, delay * 2);
    }
    console.error(`Error making request to ${url}: ${error}`);
    return null;
  }
}

async function makeRequestWithRandomProxy(url) {
  const proxyUrl = getRandomProxy();

  const axiosInstance = http; // Use the rate-limited instance
  axiosInstance.defaults.proxy = {
    host: proxyUrl.split(':')[0],
    port: proxyUrl.split(':')[1]
  };

  return makeRequestWithRetry(axiosInstance, url);
}

function getRandomProxy() {
  const index = Math.floor(Math.random() * proxyList.length);
  return proxyList[index];
}

async function makeRequestWithRandomProxy(url) {
  const proxyUrl = getRandomProxy();

  const axiosInstance = axios.create({
    proxy: {
      host: proxyUrl.split(':')[0],
      port: proxyUrl.split(':')[1]
    }
  });

  try {
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error making request to ${url} with proxy ${proxyUrl}: ${error}`);
    return null;
  }
}

require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { TikTokConnectionWrapper, getGlobalConnectionCount } = require('./connectionWrapper');
const { clientBlocked } = require('./limiter');

const app = express();
const httpServer = createServer(app);

// Enable cross origin resource sharing
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});


io.on('connection', (socket) => {
  let tiktokConnectionWrapper;

  console.info('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);

  socket.on('setUniqueId', (uniqueId, options) => {

    // Prohibit the client from specifying these options (for security reasons)
    if (typeof options === 'object' && options) {
      delete options.requestOptions;
      delete options.websocketOptions;
    } else {
      options = {};
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
    tiktokConnectionWrapper.connection.on('subscribe', msg => socket.emit('subscribe', msg));
  });

  socket.on('disconnect', () => {
    if (tiktokConnectionWrapper) {
      tiktokConnectionWrapper.disconnect();
    }
  });
});

// Emit global connection statistics
setInterval(() => {
  io.emit('statistic', { globalConnectionCount: getGlobalConnectionCount() });
}, 5000)

// Serve frontend files
app.use(express.static('public'));

// Start http listener
const port = process.env.PORT || 8081;
httpServer.listen(port);
console.info(`Server running! Please visit http://localhost:${port}`);