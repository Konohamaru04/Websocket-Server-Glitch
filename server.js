const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();

// Create a new WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store all connected WebSocket clients
const clients = new Set();

// Create a new SQLite database
const db = new sqlite3.Database("drawingHistory.db");

// Create the drawing history table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS drawing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT
  )
`);

// Load the drawing history from the database (if it exists)
let drawingHistory = [];

function loadDrawingHistoryFromDatabase() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM drawing_history", (err, rows) => {
      if (err) {
        console.error("Error loading drawing history from database:", err);
        reject(err);
      } else {
        const drawingHistory = rows.map((row) => JSON.parse(row.data));
        resolve(drawingHistory);
      }
    });
  });
}

// Save the drawing history to the database
function saveDrawingHistoryToDatabase(history) {
  const stmt = db.prepare("INSERT INTO drawing_history (data) VALUES (?)");

  history.forEach((data) => {
    stmt.run(JSON.stringify(data));
  });

  stmt.finalize((err) => {
    if (err) {
      console.error("Error saving drawing history to database:", err);
    }
  });
}

// Handle new WebSocket connections
wss.on("connection", (ws) => {
  // Add the new client to the set
  clients.add(ws);

  // Log client information
  console.log(`New client connected: ${ws._socket.remoteAddress}:${ws._socket.remotePort}`);

  // Load the drawing history from the database
  loadDrawingHistoryFromDatabase()
    .then((history) => {
      drawingHistory = history;

      // Send the entire drawing history to the new client
      if (drawingHistory) {
        drawingHistory.forEach((data) => {
          sendMessage(ws, JSON.stringify(data));
        });
      }
    })
    .catch((error) => {
      console.error("Error loading drawing history:", error);
    });

  // Handle incoming messages from the client
  ws.on("message", (data) => {
    if (data instanceof Buffer) {
      // Convert Buffer data to a string
      data = data.toString();
    }

    try {
      // Parse the data as JSON
      const jsonData = JSON.parse(data);

      if (jsonData.action === "reset") {
        // Handle reset action
        drawingHistory = [];
        broadcastMessage(JSON.stringify(jsonData));
      } else if (jsonData.action === "getUsers") {
        // Send the list of connected users to the client
        sendUsers(ws);
      } else if (jsonData.action === "setUsername") {
        // Update the username of the user
        updateUserUsername(ws, jsonData.username);
      } else {
        // Add the drawing data to the history
        drawingHistory.push(jsonData);

        // Broadcast the drawing data to all connected clients except the sender
        broadcastMessageExceptSender(ws, JSON.stringify(jsonData));
      }

      // Save the drawing history to the database
      saveDrawingHistoryToDatabase(drawingHistory);
    } catch (error) {
      console.error("Error parsing JSON data:", error);
    }
  });

  // Handle WebSocket connection close
  ws.on("close", () => {
    // Remove the client from the set
    clients.delete(ws);

    // Log client disconnection
    console.log(`Client disconnected: ${ws._socket.remoteAddress}:${ws._socket.remotePort}`);
  });
});

function sendMessage(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }
}

function broadcastMessage(message) {
  clients.forEach((client) => {
    sendMessage(client, message);
  });
}

function broadcastMessageExceptSender(sender, message) {
  clients.forEach((client) => {
    if (client !== sender) {
      sendMessage(client, message);
    }
  });
}

function sendUsers(ws) {
  const userList = Array.from(clients).map((client) => ({
    address: client._socket.remoteAddress,
    port: client._socket.remotePort,
    username: `${client._socket.remoteAddress}:${client._socket.remotePort}`,
  }));
  sendMessage(ws, JSON.stringify({ action: "users", users: userList }));
}

function updateUserUsername(ws, username) {
  clients.forEach((client) => {
    if (client === ws) {
      client.username = username;
    }
  });

  sendUsers(ws);
}
