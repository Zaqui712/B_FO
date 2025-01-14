const express = require('express');
const router = express.Router();
const sql = require('mssql');
const axios = require('axios');  // Make sure axios is imported
const { getPool } = require('../../db');  // Ensure correct path to db.js file

// PUT route for sending encomenda
router.put('/', async (req, res) => {
  const encomenda = req.body.encomenda;

  // Log incoming data
  console.log('Updating and sending encomenda:', encomenda);

  // Validate required fields
  if (!encomenda || encomenda.encomendaCompleta == null || !encomenda.dataEntrega || !encomenda.encomendaID) {
    console.log('Missing required fields in encomenda');
    return res.status(400).json({ message: 'Missing required fields for updating order' });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    console.log('Starting database transaction...');

    await transaction.begin();

    // Update encomenda query - only updating encomendaCompleta and dataEntrega
    const updateEncomendaQuery = `
      UPDATE Encomenda
      SET encomendaCompleta = @encomendaCompleta, 
          dataEntrega = @dataEntrega
      WHERE encomendaID = @encomendaID
    `;

    // Execute update query
    await transaction.request()
      .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta)
      .input('dataEntrega', sql.Date, encomenda.dataEntrega)  // Use dataEntrega here
      .input('encomendaID', sql.Int, encomenda.encomendaID)
      .query(updateEncomendaQuery);

    console.log('Encomenda updated locally:', encomenda.encomendaID);

    // Commit the transaction
    await transaction.commit();

    console.log('Transaction committed successfully.');

    // Prepare data for external backend
    const encomendaToSend = {
      ...encomenda,
      encomendaSHID: encomenda.encomendaID  // Rename to encomendaSHID for the external backend
    };
    delete encomendaToSend.encomendaID;  // Optional: Remove original encomendaID to avoid confusion

    // Send encomenda data to external backend
    try {
      const response = await axios.post('http://4.211.87.132:5000/api/receive/', { encomenda: encomendaToSend });
      console.log('Encomenda sent to external backend:', response.data);
    } catch (error) {
      console.error('Error sending encomenda to external backend:', error.message);
    }

    // Success response
    res.status(200).json({ message: 'Encomenda updated and sent successfully', encomendaID: encomenda.encomendaID });
  } catch (error) {
    console.error('Error updating encomenda:', error.message);
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: 'Error updating encomenda', details: error.message });
  }
});

module.exports = router;
