import express from "express";
import { createServer } from "node:http";
import dotenv from "dotenv";
import cors from "cors";
import { Server } from "socket.io";
import { connectDatabase } from "./config/database.js";
import { sigenuRouter, authRouter, secretaryRouter, notificationRouter, commonRouter, professorRouter, chatRouter, vicedeanRouter } from "./routes/index.js";
import { ENV } from "./config/envs.js";
import { setChatSocketServer } from "./services/chat.service.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

app.use(express.json());

const PORT = ENV.PORT;
const FRONTEND_URL = ENV.FRONTEND_URL;

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type', 'Cache-Control', 'Pragma', 'Expires']
}));

app.use('/api/auth', authRouter);
app.use('/api/sigenu', sigenuRouter);
app.use('/api/secretary', secretaryRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/common', commonRouter);
app.use('/api/professor', professorRouter);
app.use('/api/chat', chatRouter);
app.use('/api/vicedean', vicedeanRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
  }
});

setChatSocketServer(io);

const server = httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

server.requestTimeout = 10 * 60 * 1000; 
server.headersTimeout = 10 * 60 * 1000 + 1000; 
server.keepAliveTimeout = 65 * 1000; 

connectDatabase();
