// server.js
const express = require('express');
const app = express();

// Import the receiverOrders route
const receiverOrders = require('./routes/Communications/receiverOrders');
const senderOrders = require('./routes/Communications/senderOrders');


// Middleware to parse JSON bodies
app.use(express.json());

// Use the route with correct base path
app.use('/receive-encomenda', receiverOrders);  // This is correct, based on your setup
app.use('/send-encomenda', senderOrders);  // This is correct, based on your setup

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
