const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-livestream-chat-connector');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

let connectionCount = 0;

setInterval(() => {
    io.emit('statistic', { connectionCount });
}, 5000)


io.on('connection', (socket) => {
    let chatConnection;

    socket.on('setUniqueId', (uniqueId, options) => {

        if (chatConnection) chatConnection.disconnect();
        
        chatConnection = new WebcastPushConnection(uniqueId, options);
        chatConnection.connect().then(state => {
            socket.emit('setUniqueIdSuccess', state);
        }).catch(err => {
            socket.emit('setUniqueIdFailed', err.toString());
        })

        chatConnection.on('member', msg => socket.emit('member', Object.assign({}, msg)));
        chatConnection.on('chat', msg => socket.emit('chat', Object.assign({}, msg)));
        chatConnection.on('gift', msg => socket.emit('gift', Object.assign({}, msg)));
        chatConnection.on('streamEnd', () => socket.emit('streamEnd'));

        chatConnection.on('connected', () => {
            connectionCount += 1;
        });

        chatConnection.on('disconnected', () => {
            connectionCount -= 1;
        });
    })

    socket.on('close', () => {
        if (chatConnection) chatConnection.disconnect();
        console.log('client disconnected');
    })

    console.log('client connected');
});

// Server frontend files
app.use(express.static('public'));

httpServer.listen(process.env.PORT || 80);