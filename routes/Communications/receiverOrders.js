const express = require('express');
const router = express.Router();  // Initializes the router to handle requests
const sql = require('mssql');  // Required to interact with the SQL Server database
const { getPool } = require('../../db');  // Assumed helper to get DB connection pool

// POST route for receiving encomenda
router.post('/receive-encomenda', async (req, res) => {
  const encomenda = req.body.encomenda;

  // Validate required fields in encomenda
  if (!encomenda || !encomenda.estadoID || !encomenda.fornecedorID) {
    return res.status(400).json({ message: 'Missing required order fields' });
  }

  // Establish connection pool to the SQL database
  const pool = await getPool();  // Assuming `getPool` gives you a connection pool
  const transaction = new sql.Transaction(pool);  // Create a transaction for atomic queries

  try {
    // Begin the transaction to ensure all queries are executed atomically
    await transaction.begin();

    // Define the query for inserting an encomenda into the Encomenda table
    const insertEncomendaQuery = `
      INSERT INTO Encomenda (estadoID, fornecedorID, encomendaCompleta, aprovadoPorAdministrador, dataEncomenda, dataEntrega, quantidadeEnviada)
      OUTPUT INSERTED.encomendaID
      VALUES (@estadoID, @fornecedorID, @encomendaCompleta, @aprovadoPorAdministrador, @dataEncomenda, @dataEntrega, @quantidadeEnviada)
    `;

    // Execute the insert query for encomenda
    const encomendaResult = await transaction.request()
      .input('estadoID', sql.Int, encomenda.estadoID)
      .input('fornecedorID', sql.Int, encomenda.fornecedorID)
      .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta || null)
      .input('aprovadoPorAdministrador', sql.Bit, encomenda.aprovadoPorAdministrador || null)
      .input('dataEncomenda', sql.Date, encomenda.dataEncomenda || null)
      .input('dataEntrega', sql.Date, encomenda.dataEntrega || null)
      .input('quantidadeEnviada', sql.Int, encomenda.quantidadeEnviada || null)
      .query(insertEncomendaQuery);

    const encomendaID = encomendaResult.recordset[0].encomendaID;  // Capture the inserted encomendaID

    // Check if there are any associated Medicamentos and insert them
    if (encomenda.medicamentos && Array.isArray(encomenda.medicamentos)) {
      for (const medicamento of encomenda.medicamentos) {
        const { medicamentoID, quantidade } = medicamento;

        // Validate medicamento fields
        if (!medicamentoID || !quantidade) {
          throw new Error('Medicamento ID and quantity are required for each medicamento');
        }

        // Insert each medicamento into the Medicamento_Encomenda table
        const insertMedicamentoEncomendaQuery = `
          INSERT INTO Medicamento_Encomenda (MedicamentomedicamentoID, EncomendaencomendaID)
          VALUES (@medicamentoID, @encomendaID)
        `;
        await transaction.request()
          .input('medicamentoID', sql.Int, medicamentoID)
          .input('encomendaID', sql.Int, encomendaID)
          .query(insertMedicamentoEncomendaQuery);
      }
    }

    // Commit the transaction once all queries are successful
    await transaction.commit();

    // Respond with success
    res.status(201).json({ message: 'Encomenda received and processed successfully', encomendaID });
  } catch (error) {
    // Log error and rollback if any error occurs
    console.error('Error processing encomenda:', error.message);
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: 'Error processing encomenda', details: error.message });
  }
});

module.exports = router;  // Export router so that it can be used in the main server file
