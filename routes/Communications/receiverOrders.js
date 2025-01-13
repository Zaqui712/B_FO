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

      if (!encomenda.estadoID || !encomenda.fornecedorID || !encomenda.encomendaID) {
        console.log(`[Transaction ${transactionID}] Missing required fields in encomenda`);
        continue; // Skip to the next encomenda if required fields are missing
      }

      const encomendaID = encomenda.encomendaID;

      let transaction;

      try {
        console.log(`[Transaction ${transactionID}] Starting database transaction...`);

        // Begin the transaction
        transaction = new sql.Transaction(pool);
        await transaction.begin();
        console.log(`[Transaction ${transactionID}] Transaction started`);

        // Check if the encomenda already exists based on the provided encomendaID and estadoID
        const checkEncomendaQuery = `
          SELECT COUNT(*) AS existingOrderCount
          FROM Encomenda
          WHERE encomendaID = @encomendaID AND estadoID = @estadoID
        `;
        console.log(`[Transaction ${transactionID}] Checking if encomenda with ID ${encomendaID} and estadoID ${encomenda.estadoID} already exists...`);

        const existingOrderResult = await transaction.request()
          .input('encomendaID', sql.Int, encomendaID)
          .input('estadoID', sql.Int, encomenda.estadoID)
          .query(checkEncomendaQuery);

        const existingOrderCount = existingOrderResult.recordset[0].existingOrderCount;
        console.log(`[Transaction ${transactionID}] Existing order count for encomendaID ${encomendaID} and estadoID ${encomenda.estadoID}: ${existingOrderCount}`);

        if (existingOrderCount > 0) {
          console.log(`[Transaction ${transactionID}] Encomenda with ID ${encomendaID} and estadoID ${encomenda.estadoID} already exists, discarding it.`);
          await transaction.rollback();
          console.log(`[Transaction ${transactionID}] Transaction rolled back`);
          continue; // Skip to the next encomenda
        }

        // Insert encomenda into the Encomenda table using the provided encomendaID
        const insertEncomendaQuery = `
		  SET IDENTITY_INSERT Encomenda ON;

					  INSERT INTO Encomenda (
			  encomendaID, estadoID, fornecedorID, encomendaCompleta, aprovadoPorAdministrador,
			  dataEncomenda, dataEntrega, quantidadeEnviada, profissionalID, adminID,
			  adminNome, adminUltimoNome, nomeFornecedor, profissionalNome, profissionalUltimoNome, servicoNome
			)
			VALUES (
			  @encomendaID, @estadoID, @fornecedorID, @encomendaCompleta, @aprovadoPorAdministrador,
			  @dataEncomenda, @dataEntrega, @quantidadeEnviada, @profissionalID, @adminID,
			  @adminNome, @adminUltimoNome, @nomeFornecedor, @profissionalNome, @profissionalUltimoNome, @servicoNome
			);


		  SET IDENTITY_INSERT Encomenda OFF;
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
		  .input('profissionalID', sql.Int, encomenda.profissionalID)  // Add this line
		  .input('adminID', sql.Int, encomenda.adminID || null)         // Optional: Pass the adminID if available
		  .input('adminNome', sql.NVarChar, encomenda.adminNome || null)
		  .input('adminUltimoNome', sql.NVarChar, encomenda.adminUltimoNome || null)
		  .input('nomeFornecedor', sql.NVarChar, encomenda.nomeFornecedor)
		  .input('profissionalNome', sql.NVarChar, encomenda.profissionalNome)
		  .input('profissionalUltimoNome', sql.NVarChar, encomenda.profissionalUltimoNome || null)
		  .input('servicoNome', sql.NVarChar, encomenda.servicoNome || null)
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

