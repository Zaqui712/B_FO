const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getPool } = require('../../db');

// POST route for receiving encomenda
router.post('/receive-encomenda', async (req, res) => {
  const encomenda = req.body.encomenda;

  // Log the incoming encomenda data for debugging
  console.log('Received encomenda:', encomenda);

  // Validate required fields in encomenda
  if (!encomenda || !encomenda.estadoID || !encomenda.fornecedorID) {
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

    const encomendaID = encomendaResult.recordset[0].encomendaID;

    // Log the inserted encomenda ID
    console.log('Encomenda inserted with ID:', encomendaID);

    // Process associated Medicamentos
    if (encomenda.medicamentos && Array.isArray(encomenda.medicamentos)) {
      console.log('Processing medicamentos:', encomenda.medicamentos);

      for (const medicamento of encomenda.medicamentos) {
        const { medicamentoID, quantidade } = medicamento;

        if (!medicamentoID || !quantidade) {
          console.log('Medicamento missing required fields:', medicamento);
          throw new Error('Medicamento ID and quantity are required for each medicamento');
        }

        // Insert medicamento into Medicamento_Encomenda table
        const insertMedicamentoEncomendaQuery = `
          INSERT INTO Medicamento_Encomenda (MedicamentomedicamentoID, EncomendaencomendaID)
          VALUES (@medicamentoID, @encomendaID)
        `;
        await transaction.request()
          .input('medicamentoID', sql.Int, medicamentoID)
          .input('encomendaID', sql.Int, encomendaID)
          .query(insertMedicamentoEncomendaQuery);

        // Log medicamento insertion
        console.log('Inserted medicamento into Medicamento_Encomenda:', medicamentoID);
      }
    } else {
      console.log('No medicamentos to process.');
    }

    // Commit the transaction
    await transaction.commit();
    console.log('Transaction committed successfully.');

    // Respond with success
    res.status(201).json({ message: 'Encomenda received and processed successfully', encomendaID });
  } catch (error) {
    console.error('Error processing encomenda:', error.message);
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: 'Error processing encomenda', details: error.message });
  }
});

module.exports = router;
