const express = require('express');
const cors = require('cors');  // Import CORS middleware
const app = express();

// Import route files
const senderOrders = require('./routes/Communications/senderOrders');
const receiverOrders = require('./routes/Communications/receiverOrders');
const inventoryRouter = require('./routes/Stock/stock');
const orderRouter = require('./routes/Orders/order');

// Enable CORS globally for all routes
app.use(cors({
  origin: '*',  // Allow all origins (for testing, can be restricted for production)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// Parse incoming JSON requests
app.use(express.json());  // Ensure body parsing for JSON data

// Use routes
app.use('/send-encomenda', senderOrders);
app.use('/receive-encomenda', receiverOrders);
app.use('/inventory', inventoryRouter);
app.use('/orders', orderRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
