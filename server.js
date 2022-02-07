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

let globalConnectionCount = 0;

setInterval(() => {
    io.emit('statistic', { globalConnectionCount });
}, 5000)


io.on('connection', (socket) => {
    let chatConnection;

    function disconnectChat() {
        if (chatConnection) {
            chatConnection.disconnect();
            chatConnection = null;
        }
    }

    socket.on('setUniqueId', (uniqueId, options) => {

        let thisConnection = new WebcastPushConnection(uniqueId, options);

        thisConnection.connect().then(state => {
            disconnectChat();
            chatConnection = thisConnection;
            if(!socket.connected) {
                disconnectChat();
                return;
            }
            socket.emit('setUniqueIdSuccess', state);
        }).catch(err => {
            socket.emit('setUniqueIdFailed', err.toString());
        })

        thisConnection.on('roomUser', msg => socket.emit('roomUser', msg));
        thisConnection.on('member', msg => socket.emit('member', msg));
        thisConnection.on('chat', msg => socket.emit('chat', msg));
        thisConnection.on('gift', msg => socket.emit('gift', msg));
        thisConnection.on('streamEnd', () => socket.emit('streamEnd'));

        thisConnection.on('connected', () => {
            console.log("chatConnection connected");
            globalConnectionCount += 1;
        });

        thisConnection.on('disconnected', () => {
            console.log("chatConnection disconnected");
            globalConnectionCount -= 1;
        });
    })

    socket.on('disconnect', () => {
        disconnectChat();
        console.log('client disconnected');
    })

    console.log('client connected');
});

// Server frontend files
app.use(express.static('public'));

httpServer.listen(process.env.PORT || 80);