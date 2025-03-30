require("dotenv").config();
process.env.TZ = process.env.APP_TIMEZONE || "Asia/Jakarta";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const url = require("url");

// استيراد الملفات الداخلية
const App = require("./server/app/config/app.js");
const { logger } = require("./server/app/lib/myf.velixs.js");
const SessionsDatabase = require("./server/app/database/sessions.db.js");
const SessionConnection = require("./server/WAServer/session.js");

// إنشاء التطبيق والخادم
const appInstance = new App();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// استخدام المنفذ الخاص بـ Vercel
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger("info", `[EXPRESS] App Listening on port ${PORT}`);
});

// توجيه الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("Server is running...");
});

// إعداد WebSocket
io.on("connection", (socket) => {
  socket.on("getSession", async (session) => {
    let get_dbsession = await new SessionsDatabase().findSessionId(session);
    let get_server_session = await new SessionConnection(socket).getSession(session);

    if (get_server_session) {
      if (!get_dbsession) {
        await new SessionConnection(socket).deleteSession(session);
        return socket.emit("servervelixs", { status: false, code_message: "dbsession404", session_id: session });
      }

      if (get_dbsession.status === "STOPPED") {
        await new SessionConnection(socket).createSession(session);
      } else {
        socket.emit("logger", { session_id: session, type: "debug", message: "[SESSION] GET SESSION." });

        try {
          socket.emit("servervelixs", {
            status: true,
            code_message: "sessionconnected",
            session_id: session,
            session: {
              name: get_server_session.authState.creds.me.name,
              number: get_server_session.authState.creds.me.id.split(":")[0],
              platform: get_server_session.authState.creds.platform,
            },
          });
        } catch (e) {
          await new SessionsDatabase().updateStatus(session);
          socket.emit("logger", { session_id: session, type: "error", message: "[SESSION] GET SESSION FAILED, SESSION NOT FOUND." });
          socket.emit("servervelixs", { status: false, code_message: "session404", session_id: session, message: "SESSION NOT FOUND." });
        }
      }
    } else {
      if (!get_dbsession) return socket.emit("servervelixs", { status: false, code_message: "dbsession404", session_id: session });
      await new SessionConnection(socket).createSession(session);
    }
  });

  socket.on("logout", async (session) => {
    let velixs = await new SessionConnection(socket).getSession(session);
    if (velixs) {
      velixs.logout();
      velixs.ev.removeAllListeners("connection.update");
      velixs.end();
      await new SessionConnection(socket).deleteSession(session);
      await new SessionsDatabase().updateStatus(session);
      socket.emit("servervelixs", { status: true, code_message: "logout", session_id: session, message: "LOGOUT SUCCESS." });
    } else {
      socket.emit("logger", { session_id: session, type: "error", message: "[SESSION] LOGOUT FAILED, SESSION NOT FOUND." });
      socket.emit("servervelixs", { status: false, session_id: session, code_message: "logout", message: "LOGOUT FAILED, SESSION NOT FOUND." });
    }
  });
});

// تشغيل الجلسات تلقائيًا
(async () => {
  await new SessionConnection(io).autoStart();
})();

// تصدير الخادم لـ Vercel
module.exports = app;
