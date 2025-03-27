import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        // console.log(`🔗 User Connected: ${socket.id}`);

        socket.on("join-call", (path) => {
            if (!connections[path]) {
                connections[path] = [];
            }

            connections[path].push(socket.id);
            timeOnline[socket.id] = new Date();

            // console.log(`📞 User ${socket.id} joined call: ${path}`);
            // console.log(`👥 Current Connections:`, connections);

            connections[path].forEach(userId => {
                io.to(userId).emit("user-joined", socket.id, connections[path]);
            });

            if (messages[path]) {
                messages[path].forEach(msg => {
                    io.to(socket.id).emit("chat-message", msg.data, msg.sender, msg["socket-id-sender"]);
                });
            }
        });

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections).reduce(([room, isFound], [roomKey, roomValue]) => {
                if (!isFound && roomValue.includes(socket.id)) {
                    return [roomKey, true];
                }
                return [room, isFound];
            }, ["", false]);

            if (found) {
                if (!messages[matchingRoom]) {
                    messages[matchingRoom] = [];
                }

                messages[matchingRoom].push({
                    sender,
                    data,
                    "socket-id-sender": socket.id
                });

                // console.log(`💬 Message in ${matchingRoom}: ${sender}: ${data}`);

                connections[matchingRoom].forEach(userId => {
                    if (userId !== socket.id) {
                        io.to(userId).emit("chat-message", data, sender, socket.id);
                    }
                });
            }
        });

        socket.on("disconnect", () => {
            let diffTime = timeOnline[socket.id] ? Math.abs(timeOnline[socket.id] - new Date()) : 0;

            for (const [key, users] of Object.entries(connections)) {
                if (users.includes(socket.id)) {
                    // console.log(`🚪 User ${socket.id} left call: ${key}`);

                    users.forEach(userId => {
                        io.to(userId).emit("user-left", socket.id);
                    });

                    connections[key] = users.filter(userId => userId !== socket.id);

                    if (connections[key].length === 0) {
                        delete connections[key];
                    }

                    // console.log(`👥 Remaining Users:`, connections[key]);
                }
            }
        });
    });

    return io;
};
