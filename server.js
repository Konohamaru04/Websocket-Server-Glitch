const WebSocket = require('ws');

// Create a new WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Store all connected WebSocket clients
const clients = new Set();

// Handle new WebSocket connections
wss.on('connection', (ws) => {
  // Add the new client to the set
  clients.add(ws);

  // Log client information
  console.log(`New client connected: ${ws._socket.remoteAddress}:${ws._socket.remotePort}`);

  // Handle incoming messages from the client
  ws.on('message', (data) => {
    if (data instanceof Buffer) {
      // Convert Buffer data to a string
      data = data.toString();
    }

    try {
      // Parse the data as JSON
      const jsonData = JSON.parse(data);

      // Broadcast the drawing data to all connected clients except the sender
      clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(jsonData));
        }
      });
    } catch (error) {
      console.error('Error parsing JSON data:', error);
    }
  });

  // Handle WebSocket connection close
  ws.on('close', () => {
    // Remove the client from the set
    clients.delete(ws);

    // Log client disconnection
    console.log(`Client disconnected: ${ws._socket.remoteAddress}:${ws._socket.remotePort}`);
  });
});