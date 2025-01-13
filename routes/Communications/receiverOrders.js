const express = require('express');
const axios = require('axios');
const router = express.Router();
const sql = require('mssql');
const { getPool } = require('../../db');

// POST route for receiving encomenda
router.post('/', async (req, res) => {
  const encomendas = req.body.encomendas; // Assuming multiple encomendas are sent in an array

  if (!Array.isArray(encomendas) || encomendas.length === 0) {
    return res.status(400).json({ message: 'No encomendas to process' });
  }

  const pool = await getPool();

  try {
    for (const encomenda of encomendas) {
      const transactionID = Date.now(); // Unique identifier for this transaction

      console.log(`[${new Date().toISOString()}] [Transaction ${transactionID}] Received encomenda:`, encomenda);

      if (!encomenda.estadoID || !encomenda.fornecedorID) {
        console.log(`[Transaction ${transactionID}] Missing required fields in encomenda`);
        continue; // Skip to the next encomenda if required fields are missing
      }

      let transaction;

      try {
        console.log(`[Transaction ${transactionID}] Starting database transaction...`);

        // Begin the transaction
        transaction = new sql.Transaction(pool);
        await transaction.begin();
        console.log(`[Transaction ${transactionID}] Transaction started`);

        // Check if the encomenda already exists based on the estadoID and fornecedorID (not encomendaID)
        const checkEncomendaQuery = `
          SELECT COUNT(*) AS existingOrderCount
          FROM Encomenda
          WHERE estadoID = @estadoID AND fornecedorID = @fornecedorID
        `;
        console.log(`[Transaction ${transactionID}] Checking if encomenda with estadoID ${encomenda.estadoID} and fornecedorID ${encomenda.fornecedorID} already exists...`);

        const existingOrderResult = await transaction.request()
          .input('estadoID', sql.Int, encomenda.estadoID)
          .input('fornecedorID', sql.Int, encomenda.fornecedorID)
          .query(checkEncomendaQuery);

        const existingOrderCount = existingOrderResult.recordset[0].existingOrderCount;
        console.log(`[Transaction ${transactionID}] Existing order count for estadoID ${encomenda.estadoID} and fornecedorID ${encomenda.fornecedorID}: ${existingOrderCount}`);

        // If the encomenda exists, update it; otherwise, insert it
        if (existingOrderCount > 0) {
          console.log(`[Transaction ${transactionID}] Encomenda with estadoID ${encomenda.estadoID} and fornecedorID ${encomenda.fornecedorID} already exists, updating it.`);

          const updateEncomendaQuery = `
            UPDATE Encomenda
            SET
              estadoID = @estadoID,
              fornecedorID = @fornecedorID,
              encomendaCompleta = @encomendaCompleta,
              aprovadoPorAdministrador = @aprovadoPorAdministrador,
              dataEncomenda = @dataEncomenda,
              dataEntrega = @dataEntrega,
              quantidadeEnviada = @quantidadeEnviada,
              adminID = @adminID
            WHERE estadoID = @estadoID AND fornecedorID = @fornecedorID
          `;
          console.log(`[Transaction ${transactionID}] Updating encomenda with estadoID: ${encomenda.estadoID} and fornecedorID: ${encomenda.fornecedorID}...`);

          await transaction.request()
            .input('estadoID', sql.Int, encomenda.estadoID)
            .input('fornecedorID', sql.Int, encomenda.fornecedorID)
            .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta || null)
            .input('aprovadoPorAdministrador', sql.Bit, encomenda.aprovadoPorAdministrador || null)
            .input('dataEncomenda', sql.Date, encomenda.dataEncomenda || null)
            .input('dataEntrega', sql.Date, encomenda.dataEntrega || null)
            .input('quantidadeEnviada', sql.Int, encomenda.quantidadeEnviada || null)
            .input('adminID', sql.Int, encomenda.adminID || null) // Optional field
            .query(updateEncomendaQuery);

          console.log(`[Transaction ${transactionID}] Encomenda updated successfully.`);
        } else {
          // Insert encomenda into the Encomenda table without specifying encomendaID (let DB auto-generate it)
          const insertEncomendaQuery = `
			  INSERT INTO Encomenda (
				estadoID, fornecedorID, encomendaCompleta, aprovadoPorAdministrador,
				dataEncomenda, dataEntrega, quantidadeEnviada, adminID
			  )
			  OUTPUT INSERTED.encomendaID
			  VALUES (
				@estadoID, @fornecedorID, @encomendaCompleta, @aprovadoPorAdministrador,
				@dataEncomenda, @dataEntrega, @quantidadeEnviada, @adminID
			  );
			`;

			console.log(`[Transaction ${transactionID}] Inserting encomenda with estadoID: ${encomenda.estadoID} and fornecedorID: ${encomenda.fornecedorID}...`);

			const result = await transaction.request()
			  .input('estadoID', sql.Int, encomenda.estadoID)
			  .input('fornecedorID', sql.Int, encomenda.fornecedorID)
			  .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta || null)
			  .input('aprovadoPorAdministrador', sql.Bit, encomenda.aprovadoPorAdministrador || null)
			  .input('dataEncomenda', sql.Date, encomenda.dataEncomenda || null)
			  .input('dataEntrega', sql.Date, encomenda.dataEntrega || null)
			  .input('quantidadeEnviada', sql.Int, encomenda.quantidadeEnviada || null)
			  .input('adminID', sql.Int, encomenda.adminID || null) // Optional field
			  .query(insertEncomendaQuery);

			const encomendaID = result.recordset[0].encomendaID;
			console.log(`[Transaction ${transactionID}] Encomenda inserted successfully with ID: ${encomendaID}`);
        }

        // Process associated Medicamentos
        if (encomenda.medicamentos && Array.isArray(encomenda.medicamentos)) {
          console.log(`[Transaction ${transactionID}] Processing medicamentos:`, encomenda.medicamentos);

          for (const medicamento of encomenda.medicamentos) {
            const { medicamentoID } = medicamento;

            if (!medicamentoID) {
              console.log(`[Transaction ${transactionID}] Medicamento missing required fields:`, medicamento);
              throw new Error('Medicamento ID is required for each medicamento');
            }

            const insertMedicamentoEncomendaQuery = `
              INSERT INTO Medicamento_Encomenda (MedicamentoID, EncomendaID)
              VALUES (@medicamentoID, @encomendaID)
            `;
            
            console.log(`[Transaction ${transactionID}] Inserting medicamento ID: ${medicamentoID} for encomenda ID: ${encomenda.estadoID}`);
            await transaction.request()
              .input('medicamentoID', sql.Int, medicamentoID)
              .input('encomendaID', sql.Int, encomendaID) // Automatically generated encomendaID
              .query(insertMedicamentoEncomendaQuery);
            console.log(`[Transaction ${transactionID}] Inserted medicamento ID: ${medicamentoID}`);
          }
        } else {
          console.log(`[Transaction ${transactionID}] No medicamentos to process.`);
        }

        // Commit the transaction
        await transaction.commit();
        console.log(`[Transaction ${transactionID}] Transaction committed successfully.`);
      } catch (error) {
        console.error(`[Transaction ${transactionID}] Error processing encomenda:`, error.message);
        if (transaction) {
          await transaction.rollback();
          console.log(`[Transaction ${transactionID}] Transaction rolled back due to error`);
        }
      }
    }

    // Respond with success
    res.status(201).json({ message: 'All encomendas processed successfully' });
  } catch (error) {
    console.error(`Error processing encomendas:`, error.message);
    res.status(500).json({ error: 'Error processing encomendas', details: error.message });
  }
});

module.exports = router;
