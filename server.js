const WebSocket = require("ws");
const fs = require("fs");

// Create a new WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store all connected WebSocket clients
const clients = new Set();
// File path to store the drawing history
const drawingHistoryFilePath = "drawingHistory.json";

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

  // Send the entire drawing history to the new client
  if (drawingHistory) {
    drawingHistory.forEach((data) => {
      ws.send(JSON.stringify(data));
    });
  }

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

    // Log client disconnection
    console.log(
      `Client disconnected: ${ws._socket.remoteAddress}:${ws._socket.remotePort}`
    );
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
