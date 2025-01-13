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
  if (!encomenda || !encomenda.estadoID || !encomenda.fornecedorID) {
    console.log(`[Transaction ${transactionID}] Missing required fields in encomenda`);
    return res.status(400).json({ message: 'Missing required order fields' });
  }

  // Establish connection pool to the SQL database
  const pool = await getPool();  
  let transaction;

  try {
    console.log(`[Transaction ${transactionID}] Starting database transaction...`);

    // Begin the transaction
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    console.log(`[Transaction ${transactionID}] Transaction started`);

    // Check if the encomenda already exists
    const checkEncomendaQuery = `
      SELECT COUNT(*) AS existingOrderCount
      FROM Encomenda
      WHERE estadoID = @estadoID AND fornecedorID = @fornecedorID
    `;
    console.log(`[Transaction ${transactionID}] Checking if encomenda already exists...`);

    const existingOrderResult = await transaction.request()
      .input('estadoID', sql.Int, encomenda.estadoID)
      .input('fornecedorID', sql.Int, encomenda.fornecedorID)
      .query(checkEncomendaQuery);

    const existingOrderCount = existingOrderResult.recordset[0].existingOrderCount;
    console.log(`[Transaction ${transactionID}] Existing order count: ${existingOrderCount}`);

    if (existingOrderCount > 0) {
      console.log(`[Transaction ${transactionID}] Encomenda already exists, discarding it.`);
      await transaction.rollback();
      console.log(`[Transaction ${transactionID}] Transaction rolled back`);
      return res.status(409).json({ message: 'Encomenda already exists' });
    }

    // Insert encomenda into the Encomenda table
    const insertEncomendaQuery = `
      INSERT INTO Encomenda (estadoID, fornecedorID, encomendaCompleta, aprovadoPorAdministrador, dataEncomenda, dataEntrega, quantidadeEnviada)
      OUTPUT INSERTED.encomendaID
      VALUES (@estadoID, @fornecedorID, @encomendaCompleta, @aprovadoPorAdministrador, @dataEncomenda, @dataEntrega, @quantidadeEnviada)
    `;
    console.log(`[Transaction ${transactionID}] Inserting encomenda...`);

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
    console.log(`[Transaction ${transactionID}] Encomenda inserted with ID: ${encomendaID}`);

    // Processing medicamentos without including quantity
	if (encomenda.medicamentos && Array.isArray(encomenda.medicamentos)) {
	  console.log(`[Transaction ${transactionID}] Processing medicamentos:`, encomenda.medicamentos);

	  for (const medicamento of encomenda.medicamentos) {
		const { medicamentoID } = medicamento;

		if (!medicamentoID) {
		  console.log(`[Transaction ${transactionID}] Medicamento missing required fields:`, medicamento);
		  throw new Error('Medicamento ID is required for each medicamento');
		}

		// Insert into Medicamento_Encomenda table without quantity
		const insertMedicamentoEncomendaQuery = `
		  INSERT INTO Medicamento_Encomenda (MedicamentomedicamentoID, EncomendaencomendaID)
		  VALUES (@medicamentoID, @encomendaID)
		`;
		
		console.log(`[Transaction ${transactionID}] Inserting medicamento ID: ${medicamentoID}`);
		await transaction.request()
		  .input('medicamentoID', sql.Int, medicamentoID)
		  .input('encomendaID', sql.Int, encomendaID)
		  .query(insertMedicamentoEncomendaQuery);
		console.log(`[Transaction ${transactionID}] Inserted medicamento ID: ${medicamentoID}`);
	  }
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
