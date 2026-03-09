/**
 * Wrapper for client-side TikTok connection over Socket.IO
 * With reconnect functionality.
 */
class TikTokIOConnection {
    constructor(backendUrl) {
        this.socket = io(backendUrl);
        this.uniqueId = null;
        this.options = null;

        this.socket.on('connect', () => {
            console.info("Socket connected!");

            // Reconnect to streamer if uniqueId already set (socket.io transport reconnect)
            if (this.uniqueId) {
                this.socket.emit('setUniqueId', this.uniqueId, this.options);
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
    }

    connect(uniqueId, options) {
        this.uniqueId = uniqueId;
        this.options = options || {};

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

        this.socket.emit('setUniqueId', this.uniqueId, this.options);

        return new Promise((resolve, reject) => {
            this.socket.once('tiktokConnected', resolve);
            this.socket.once('tiktokDisconnected', reject);

            setTimeout(() => {
                reject('Connection Timeout');
            }, 15000)
        })
    }

    disconnect() {
        this.uniqueId = null;
        this.socket.emit('disconnect_tiktok');
    }

    on(eventName, eventHandler) {
        this.socket.on(eventName, eventHandler);
    }
}
