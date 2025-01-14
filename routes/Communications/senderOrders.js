const express = require('express');
const cors = require('cors');  // Import cors
const router = express.Router();
const sql = require('mssql');
const axios = require('axios');
const { getPool } = require('../../db'); // Ensure correct path to db.js file

// Initialize Express app
const app = express();

// Enable CORS globally for all routes
app.use(cors({
  origin: '*', // Allow all origins (for testing, can be restricted for production)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// Parse incoming JSON requests
app.use(express.json());  // Ensure body parsing for JSON data

// PUT route for sending encomenda
router.put('/', async (req, res) => {
  const encomenda = req.body.encomenda;

  // Log incoming data
  console.log('Updating and sending encomenda:', encomenda);

  // Validate required fields
  if (!encomenda || encomenda.encomendaCompleta == null || !encomenda.dataEntrega || !encomenda.encomendaSHID) {
    console.log('Missing required fields in encomenda');
    return res.status(400).json({ message: 'Missing required fields for updating order' });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    console.log('Starting database transaction...');

    await transaction.begin();

    // Ensure the value of encomendaCompleta is passed as a boolean (1 for true, 0 for false)
    const encomendaCompletaValue = encomenda.encomendaCompleta ? 1 : 0;  // Use 1 for true and 0 for false

    // Update encomenda query - only updating encomendaCompleta and dataEntrega using encomendaSHID
    const updateEncomendaQuery = `
      UPDATE Encomenda
      SET encomendaCompleta = @encomendaCompleta, 
          dataEntrega = @dataEntrega
      WHERE encomendaSHID = @encomendaSHID AND encomendaCompleta IS NULL
    `;

    // Execute update query
    await transaction.request()
      .input('encomendaCompleta', sql.Bit, encomendaCompletaValue)  // Ensure Bit type
      .input('dataEntrega', sql.Date, encomenda.dataEntrega)  // Use dataEntrega here
      .input('encomendaSHID', sql.Int, encomenda.encomendaSHID)  // Correct encomendaSHID type
      .query(updateEncomendaQuery);

    console.log('Encomenda updated locally:', encomenda.encomendaSHID);

    // Commit the transaction
    await transaction.commit();

    console.log('Transaction committed successfully.');

    // Prepare data for external backend
    const encomendaToSend = {
      encomendaSHID: encomenda.encomendaSHID,  // Correctly send encomendaSHID for the external backend
      dataEntrega: encomenda.dataEntrega,    // Ensure it's in the correct format (YYYY-MM-DD)
      encomendaCompleta: encomenda.encomendaCompleta,
    };

    // Send encomenda data to external backend
    try {
      const response = await axios.post('http://4.211.87.132:5000/api/receive/', { encomenda: encomendaToSend });
      console.log('Encomenda sent to external backend:', response.data);
    } catch (error) {
      console.error('Error sending encomenda to external backend:', error.message);
      // Log the response details for debugging
      if (error.response) {
        console.error('Response from external backend:', error.response.data);
        console.error('Status code:', error.response.status);
      }
    }

    // Success response
    res.status(200).json({ message: 'Encomenda updated and sent successfully', encomendaSHID: encomenda.encomendaSHID });
  } catch (error) {
    console.error('Error updating encomenda:', error.message);
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: 'Error updating encomenda', details: error.message });
  }
});

/*
// Order Automatically Sent (every 2 minutes) - Modified to send only incomplete encomendas
router.put('/auto', async (req, res) => {
  console.log('Starting automatic order sending every 2 minutes');

  // Execute this process every 2 minutes
  setInterval(async () => {
    try {
      // Query for all incomplete encomendas (encomendaCompleta = 0)
      const pool = await getPool();
      const query = `
        SELECT * FROM Encomenda
        WHERE encomendaCompleta = 0  -- Only select incomplete orders
        ORDER BY dataEncomenda
      `;

      const result = await pool.request().query(query);
      const encomendas = result.recordset;

      if (encomendas.length === 0) {
        console.log('No encomendas found to send automatically');
        return;
      }

      console.log(`Found ${encomendas.length} encomendas to send`);

      for (const encomenda of encomendas) {
        console.log('Automatically sending encomenda:', encomenda.encomendaID);

        // Adjust dataEntrega to be 2 days later
        const dataEntrega = new Date(encomenda.dataEntrega);
        dataEntrega.setDate(dataEntrega.getDate() + 2);  // Add 2 days

        // Prepare the data to send
        const encomendaToSend = {
          ...encomenda,
          encomendaSHID: encomenda.encomendaID,  // Rename for external backend
          dataEntrega: dataEntrega.toISOString().split('T')[0]  // Format the date in YYYY-MM-DD format
        };
        delete encomendaToSend.encomendaID;

        // Send the encomenda data to the external backend
        try {
          const response = await axios.post('http://4.211.87.132:5000/api/receive/', { encomenda: encomendaToSend });
          console.log('Encomenda sent to external backend:', response.data);
        } catch (error) {
          console.error('Error sending encomenda to external backend:', error.message);
        }

        // Optionally update the status of the encomenda as completed after sending
        await pool.request()
          .input('encomendaID', sql.Int, encomenda.encomendaID)
          .query(`
            UPDATE Encomenda
            SET encomendaCompleta = 1  -- Mark the order as completed after sending
            WHERE encomendaID = @encomendaID
          `);
      }

    } catch (error) {
      console.error('Error in automatic order sending:', error.message);
    }
  }, 120000);  // 120000 ms = 2 minutes

  // Respond immediately to indicate the process is running
  res.status(200).json({ message: 'Auto-order sending started' });
});

*/

module.exports = router;  // No app.listen() here
