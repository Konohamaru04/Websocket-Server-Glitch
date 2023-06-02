const WebSocket = require("ws");
const fs = require("fs");

// Create a new WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store all connected WebSocket clients
const clients = new Set();
// File path to store the drawing history
const drawingHistoryFilePath = "drawingHistory.json";

// Store all connected users
const connectedUsers = new Set();

// Load the drawing history from the file (if it exists)
let drawingHistory = loadDrawingHistoryFromFile();

// Handle new WebSocket connections
wss.on("connection", (ws) => {
  // Add the new client to the set
  clients.add(ws);

  // Log client information
  console.log(
    `New client connected: ${ws._socket.remoteAddress}:${ws._socket.remotePort}`
  );

  // Add the user to the connected users set
  addUserToConnectedUsers(ws);

  // Send the entire drawing history to the new client
  if (drawingHistory) {
    drawingHistory.forEach((data) => {
      ws.send(JSON.stringify(data));
    });
  }

  // Send the list of connected users to all clients
  const userList = Array.from(connectedUsers);
  broadcastToClients(JSON.stringify({ action: "users", users: userList }));

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
        broadcastToClients(JSON.stringify(jsonData));
      } else if (jsonData.action === "getUsers") {
        // Send the list of connected users to the client
        const userList = Array.from(connectedUsers);
        ws.send(JSON.stringify({ action: "users", users: userList }));
      } else if (jsonData.action === "setUsername") {
        // Update the username of the user
        updateUserUsername(ws, jsonData.username);
      } else {
        // Add the drawing data to the history
        drawingHistory.push(jsonData);

        // Broadcast the drawing data to all connected clients except the sender
        broadcastToClientsExceptSender(ws, JSON.stringify(jsonData));
      }

      // Save the drawing history to the file
      saveDrawingHistoryToFile(drawingHistory);
    } catch (error) {
      console.error("Error parsing JSON data:", error);
    }
  });

  // Handle WebSocket connection close
  ws.on("close", () => {
    // Remove the client from the set
    clients.delete(ws);

    // Remove the user from the connected users set
    removeUserFromConnectedUsers(ws);

    // Log client disconnection
    console.log(
      `Client disconnected: ${ws._socket.remoteAddress}:${ws._socket.remotePort}`
    );

    // Broadcast the updated list of connected users to all clients
    const userList = Array.from(connectedUsers);
    broadcastToClients(JSON.stringify({ action: "users", users: userList }));
  });
});

function loadDrawingHistoryFromFile() {
  try {
    if (fs.existsSync(drawingHistoryFilePath)) {
      const fileContent = fs.readFileSync(drawingHistoryFilePath, "utf8");
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Error loading drawing history from file:", error);
  }

  return [];
}

function saveDrawingHistoryToFile(history) {
  try {
    const jsonData = JSON.stringify(history);
    fs.writeFileSync(drawingHistoryFilePath, jsonData, "utf8");
  } catch (error) {
    console.error("Error saving drawing history to file:", error);
  }
}

function broadcastToClients(message) {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastToClientsExceptSender(sender, message) {
  clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function addUserToConnectedUsers(ws) {
  const user = {
    address: ws._socket.remoteAddress,
    port: ws._socket.remotePort,
    username: `${ws._socket.remoteAddress}:${ws._socket.remotePort}`
  };
  connectedUsers.add(user);
}

function updateUserUsername(ws, username) {
  const user = Array.from(connectedUsers).find(
    (u) => u.address === ws._socket.remoteAddress && u.port === ws._socket.remotePort
  );
  if (user) {
    user.username = username;
  }

  // Broadcast the updated list of connected users to all clients
  const userList = Array.from(connectedUsers);
  broadcastToClients(JSON.stringify({ action: "users", users: userList }));
}

function removeUserFromConnectedUsers(ws) {
  const user = Array.from(connectedUsers).find(
    (u) => u.address === ws._socket.remoteAddress && u.port === ws._socket.remotePort
  );
  if (user) {
    connectedUsers.delete(user);
  }

  // Broadcast the updated list of connected users to all clients
  const userList = Array.from(connectedUsers);
  broadcastToClients(JSON.stringify({ action: "users", users: userList }));
}
