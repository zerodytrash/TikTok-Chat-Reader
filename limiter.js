let ipRequestCounts = {};

let maxIpConnections = 10;
let maxIpRequestsPerMinute = 5;

setInterval(() => {
    ipRequestCounts = {};
}, 60 * 1000)

function clientBlocked(io, currentSocket) {
    let ipCounts = getOverallIpConnectionCounts(io);
    let currentIp = getSocketIp(currentSocket);

    if (typeof currentIp !== 'string') {
        console.info('LIMITER: Failed to retrieve socket IP.');
        return false;
    }

    let currentIpConnections = ipCounts[currentIp] || 0;
    let currentIpRequests = ipRequestCounts[currentIp] || 0;

    ipRequestCounts[currentIp] = currentIpRequests + 1;

    if (currentIpConnections > maxIpConnections) {
        console.info(`LIMITER: Max connection count of ${maxIpConnections} exceeded for client ${currentIp}`);
        return true;
    }

    if (currentIpRequests > maxIpRequestsPerMinute) {
        console.info(`LIMITER: Max request count of ${maxIpRequestsPerMinute} exceeded for client ${currentIp}`);
        return true;
    }

    return false;
}

function getOverallIpConnectionCounts(io) {
    let ipCounts = {};

    io.of('/').sockets.forEach(socket => {
        let ip = getSocketIp(socket);
        if (!ipCounts[ip]) {
            ipCounts[ip] = 1;
        } else {
            ipCounts[ip] += 1;
        }
    })

    return ipCounts;
}

function getSocketIp(socket) {
    if (['::1', '::ffff:127.0.0.1'].includes(socket.handshake.address)) {
        return socket.handshake.headers['x-forwarded-for'];
    } else {
        return socket.handshake.address;
    }
}

module.exports = {
    clientBlocked
}