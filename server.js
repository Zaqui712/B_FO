const express = require('express');
const app = express();

// Import your route file
const receiverOrders = require('./routes/Communications/receiverOrders');

// Middleware to parse JSON bodies
app.use(express.json());

// Use the route in your Express app
app.use('/receiver-orders', receiverOrders); // Define base path for this route file

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
