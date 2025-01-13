const express = require('express');
const router = express.Router();
const sql = require('mssql');
const axios = require('axios');  // Make sure axios is imported
const { getPool } = require('../../db');  // Ensure correct path to db.js file

// PUT route for sending encomenda
router.put('/', async (req, res) => {
  const encomenda = req.body.encomenda;

  // Log the outgoing encomenda data for debugging
  console.log('Sending encomenda:', encomenda);

  // Validate required fields in encomenda
  if (!encomenda || !encomenda.estadoID || !encomenda.fornecedorID || !encomenda.encomendaID) {
    console.log('Missing required fields in encomenda');
    return res.status(400).json({ message: 'Missing required order fields' });
  }

  // Establish connection pool to the SQL database
  const pool = await getPool();  // Assuming `getPool` gives you a connection pool
  const transaction = new sql.Transaction(pool);

  try {
    // Log that we are starting the transaction
    console.log('Starting database transaction...');

    // Begin the transaction
    await transaction.begin();

    // Define the query for updating encomenda in the Encomenda table
    const updateEncomendaQuery = `
      UPDATE Encomenda
      SET estadoID = @estadoID, 
          fornecedorID = @fornecedorID, 
          encomendaCompleta = @encomendaCompleta, 
          aprovadoPorAdministrador = @aprovadoPorAdministrador, 
          dataEncomenda = @dataEncomenda, 
          dataEntrega = @dataEntrega, 
          quantidadeEnviada = @quantidadeEnviada
      WHERE encomendaID = @encomendaID
    `;

    // Execute the update query for encomenda
    await transaction.request()
      .input('estadoID', sql.Int, encomenda.estadoID)
      .input('fornecedorID', sql.Int, encomenda.fornecedorID)
      .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta || null)
      .input('aprovadoPorAdministrador', sql.Bit, encomenda.aprovadoPorAdministrador || null)
      .input('dataEncomenda', sql.Date, encomenda.dataEncomenda || null)
      .input('dataEntrega', sql.Date, encomenda.dataEntrega || null)
      .input('quantidadeEnviada', sql.Int, encomenda.quantidadeEnviada || null)
      .input('encomendaID', sql.Int, encomenda.encomendaID)  // Assuming encomendaID exists in request
      .query(updateEncomendaQuery);

    // Log that encomenda was successfully updated
    console.log('Encomenda updated with ID:', encomenda.encomendaID);

    // Process associated Medicamentos if any
    if (encomenda.medicamentos && Array.isArray(encomenda.medicamentos)) {
      console.log('Processing medicamentos:', encomenda.medicamentos);

      for (const medicamento of encomenda.medicamentos) {
        const { medicamentoID, quantidade } = medicamento;

        if (!medicamentoID || !quantidade) {
          console.log('Medicamento missing required fields:', medicamento);
          throw new Error('Medicamento ID and quantity are required for each medicamento');
        }

        // Update medicamento in Medicamento_Encomenda table
        const updateMedicamentoEncomendaQuery = `
          UPDATE Medicamento_Encomenda
          SET quantidade = @quantidade
          WHERE MedicamentoID = @medicamentoID AND EncomendaID = @encomendaID
        `;
        await transaction.request()
          .input('medicamentoID', sql.Int, medicamentoID)
          .input('encomendaID', sql.Int, encomenda.encomendaID)
          .input('quantidade', sql.Int, quantidade)
          .query(updateMedicamentoEncomendaQuery);

        // Log medicamento update
        console.log('Updated medicamento in Medicamento_Encomenda:', medicamentoID);
      }
    } else {
      console.log('No medicamentos to process.');
    }

    // Commit the transaction
    await transaction.commit();
    console.log('Transaction committed successfully.');

    // Send encomenda data to the external server using HTTP request
    try {
      const response = await axios.post('http://4.211.87.132:5000/api/receive/', { encomenda });
      console.log('Encomenda successfully sent to receiver backend:', response.data);
    } catch (error) {
      // Log HTTP request error
      console.error('Error sending encomenda to receiver backend:', error.message);
    }

    // Respond with success
    res.status(200).json({ message: 'Encomenda sent and updated successfully', encomendaID: encomenda.encomendaID });
  } catch (error) {
    console.error('Error sending encomenda:', error.message);
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: 'Error sending encomenda', details: error.message });
  }
});

module.exports = router;
