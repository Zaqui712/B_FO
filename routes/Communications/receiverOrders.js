const express = require('express');
const axios = require('axios');  // Ensure axios is imported for potential future use
const router = express.Router();
const sql = require('mssql');
const { getPool } = require('../../db');  // Ensure correct path to db.js file

// POST route for receiving encomenda
router.post('/', async (req, res) => {
  const encomenda = req.body.encomenda;
  const transactionID = Date.now(); // Unique identifier for this transaction

  // Log the incoming encomenda data for debugging
  console.log(`[${new Date().toISOString()}] [Transaction ${transactionID}] Received encomenda:`, encomenda);

  // Validate required fields in encomenda
  if (!encomenda || !encomenda.estadoID || !encomenda.fornecedorID || !encomenda.encomendaID) {
    console.log(`[Transaction ${transactionID}] Missing required fields in encomenda`);
    return res.status(400).json({ message: 'Missing required order fields' });
  }

  const encomendaID = encomenda.encomendaID; // Using the provided encomendaID

  // Establish connection pool to the SQL database
  const pool = await getPool();
  let transaction;

  try {
    console.log(`[Transaction ${transactionID}] Starting database transaction...`);

    // Begin the transaction
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    console.log(`[Transaction ${transactionID}] Transaction started`);

    // Check if the encomenda already exists based on the provided encomendaID
    const checkEncomendaQuery = `
      SELECT COUNT(*) AS existingOrderCount
      FROM Encomenda
      WHERE encomendaID = @encomendaID
    `;
    console.log(`[Transaction ${transactionID}] Checking if encomenda with ID ${encomendaID} already exists...`);

    const existingOrderResult = await transaction.request()
      .input('encomendaID', sql.Int, encomendaID)
      .query(checkEncomendaQuery);

    const existingOrderCount = existingOrderResult.recordset[0].existingOrderCount;
    console.log(`[Transaction ${transactionID}] Existing order count for encomendaID ${encomendaID}: ${existingOrderCount}`);

    if (existingOrderCount > 0) {
      console.log(`[Transaction ${transactionID}] Encomenda with ID ${encomendaID} already exists, discarding it.`);
      await transaction.rollback();
      console.log(`[Transaction ${transactionID}] Transaction rolled back`);
      return res.status(409).json({ message: 'Encomenda already exists' });
    }

    // Insert encomenda into the Encomenda table using the provided encomendaID
    const insertEncomendaQuery = `
      SET IDENTITY_INSERT Encomenda ON;  -- Enable explicit value insertion for the identity column

      INSERT INTO Encomenda (encomendaID, estadoID, fornecedorID, encomendaCompleta, aprovadoPorAdministrador, dataEncomenda, dataEntrega, quantidadeEnviada)
      VALUES (@encomendaID, @estadoID, @fornecedorID, @encomendaCompleta, @aprovadoPorAdministrador, @dataEncomenda, @dataEntrega, @quantidadeEnviada);

      SET IDENTITY_INSERT Encomenda OFF;  -- Disable explicit value insertion for the identity column

      SELECT SCOPE_IDENTITY() AS encomendaID;  -- Retrieve the generated encomendaID (if needed)
    `;
    console.log(`[Transaction ${transactionID}] Inserting encomenda with ID: ${encomendaID}...`);

    await transaction.request()
      .input('encomendaID', sql.Int, encomendaID)
      .input('estadoID', sql.Int, encomenda.estadoID)
      .input('fornecedorID', sql.Int, encomenda.fornecedorID)
      .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta || null)
      .input('aprovadoPorAdministrador', sql.Bit, encomenda.aprovadoPorAdministrador || null)
      .input('dataEncomenda', sql.Date, encomenda.dataEncomenda || null)
      .input('dataEntrega', sql.Date, encomenda.dataEntrega || null)
      .input('quantidadeEnviada', sql.Int, encomenda.quantidadeEnviada || null)
      .query(insertEncomendaQuery);

    console.log(`[Transaction ${transactionID}] Encomenda with ID ${encomendaID} inserted successfully.`);

    // Process associated Medicamentos
    if (encomenda.medicamentos && Array.isArray(encomenda.medicamentos)) {
      console.log(`[Transaction ${transactionID}] Processing medicamentos:`, encomenda.medicamentos);

      for (const medicamento of encomenda.medicamentos) {
        const { medicamentoID } = medicamento;

        if (!medicamentoID) {
          console.log(`[Transaction ${transactionID}] Medicamento missing required fields:`, medicamento);
          throw new Error('Medicamento ID is required for each medicamento');
        }

        // Insert medicamento into Medicamento_Encomenda table
        const insertMedicamentoEncomendaQuery = `
          INSERT INTO Medicamento_Encomenda (MedicamentomedicamentoID, EncomendaencomendaID)
          VALUES (@medicamentoID, @encomendaID)
        `;
        
        console.log(`[Transaction ${transactionID}] Inserting medicamento ID: ${medicamentoID} for encomenda ID: ${encomendaID}`);
        await transaction.request()
          .input('medicamentoID', sql.Int, medicamentoID)
          .input('encomendaID', sql.Int, encomendaID)
          .query(insertMedicamentoEncomendaQuery);
        console.log(`[Transaction ${transactionID}] Inserted medicamento ID: ${medicamentoID}`);
      }
    } else {
      console.log(`[Transaction ${transactionID}] No medicamentos to process.`);
    }

    // Commit the transaction
    await transaction.commit();
    console.log(`[Transaction ${transactionID}] Transaction committed successfully.`);

    // Respond with success
    res.status(201).json({ message: 'Encomenda received and processed successfully', encomendaID });
  } catch (error) {
    console.error(`[Transaction ${transactionID}] Error processing encomenda:`, error.message);
    if (transaction) {
      await transaction.rollback();
      console.log(`[Transaction ${transactionID}] Transaction rolled back due to error`);
    }
    res.status(500).json({ error: 'Error processing encomenda', details: error.message });
  }
});

module.exports = router;
