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

// Store user information
const users = {};

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
  // Assign a unique identifier to the client
  const clientId = generateClientId();

  // Add the new client to the set
  clients.add(ws);

  // Log client information
  console.log(`New client connected: ${clientId}`);

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

  // Create a new user and store the information
  users[clientId] = {
    id: clientId,
    username: clientId,
  };

  // Send the list of connected users to the client
  sendUsers(ws);

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
        updateUserUsername(clientId, jsonData.username);
        sendUsers(ws);
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

    // Remove the user from the users object
    delete users[clientId];

    // Log client disconnection
    console.log(`Client disconnected: ${clientId}`);
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
  const userList = Object.values(users);
  sendMessage(ws, JSON.stringify({ action: "users", users: userList }));
}

function updateUserUsername(clientId, username) {
  if (users[clientId]) {
    users[clientId].username = username;
  }

  broadcastMessage(JSON.stringify({ action: "updateUsername", userId: clientId, username }));
}

// Generate a unique client identifier
function generateClientId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
