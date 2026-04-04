const { Server } = require('socket.io');
const userController = require('../controllers/users');
const { verifyAuthToken } = require('./authToken');

const DEFAULT_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
];

function ServerSocket(httpServer, options) {
    const origins = (options && options.corsOrigins) || DEFAULT_ORIGINS;
    const io = new Server(httpServer, {
        cors: {
            origin: origins,
            credentials: true,
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        socket.on('welcome', async (data) => {
            try {
                const token = data && data.auth;
                if (!token || typeof token !== 'string') {
                    return;
                }
                const result = verifyAuthToken(token.trim());
                if (result.exp * 1000 <= Date.now()) {
                    socket.emit('auth_error', { message: 'token_expired' });
                    return;
                }
                const user = await userController.FindById(result.id);
                if (!user) {
                    socket.emit('auth_error', { message: 'user_not_found' });
                    return;
                }
                socket.data.userId = user.id;
                socket.join(String(user.id));
                const label = user.name || user.email || String(user.id);
                socket.emit('username', label);
            } catch {
                socket.emit('auth_error', { message: 'invalid_token' });
            }
        });

        function dmRoomKey(a, b) {
            const s1 = String(a);
            const s2 = String(b);
            return s1 < s2 ? `dm_${s1}_${s2}` : `dm_${s2}_${s1}`;
        }

        function joinPeerDmRoom(socket, peerId) {
            const me = socket.data.userId;
            if (me == null || peerId == null || peerId === '') {
                return;
            }
            socket.join(dmRoomKey(me, peerId));
        }

     
        socket.on('openChat', (peerId) => joinPeerDmRoom(socket, peerId));
        socket.on('user02', (peerId) => joinPeerDmRoom(socket, peerId));

        socket.on('newMess', (data) => {
            const fromId = data && data.fromUserId;
            const toId = data && data.toUserId;
            if (fromId == null || toId == null) {
                return;
            }
            io.to(dmRoomKey(fromId, toId)).emit('newMess', data);
        });
    });

    return io;
}

module.exports = { ServerSocket };
