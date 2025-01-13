const express = require('express');
const { getPool } = require('../../db'); // Assuming this is your database pool
const mssql = require('mssql'); // Assuming you're using mssql package
const router = express.Router();

// POST route for processing encomendas
router.post('/', async (req, res) => {
  const encomendas = req.body.encomendas;

  try {
    const pool = await getPool(); // Get the connection pool from your getPool function

    // Loop through each encomenda and insert into the Encomenda table
    for (const encomenda of encomendas) {
      // Check if an Encomenda with the same estadoID and fornecedorID already exists
      const existingEncomenda = await pool.request()
        .input('estadoID', mssql.Int, encomenda.estadoID)
        .input('fornecedorID', mssql.Int, encomenda.fornecedorID)
        .query(`
          SELECT COUNT(*) AS count
          FROM Encomenda
          WHERE estadoID = @estadoID AND fornecedorID = @fornecedorID
        `);

      if (existingEncomenda.recordset[0].count > 0) {
        // If an Encomenda already exists, skip the insert (or handle as needed)
        console.log(`Encomenda with estadoID ${encomenda.estadoID} and fornecedorID ${encomenda.fornecedorID} already exists.`);
        continue; // Or handle it as needed
      }

      // Insert into Encomenda table if it doesn't already exist
      // Check if encomendaSHID is provided, and if not, let the database generate it
			  const encomendaResult = await pool.request()
		  .input('encomendaSHID', mssql.Int, encomenda.encomendaSHID || null)
		  .input('estadoID', mssql.Int, encomenda.estadoID)
		  .input('fornecedorID', mssql.Int, encomenda.fornecedorID)
		  .input('quantidadeEnviada', mssql.Int, encomenda.quantidadeEnviada)
		  .query(`
			INSERT INTO Encomenda (encomendaSHID, estadoID, fornecedorID, quantidadeEnviada)
			OUTPUT INSERTED.encomendaSHID
			VALUES (@encomendaSHID, @estadoID, @fornecedorID, @quantidadeEnviada)
		  `);

      const encomendaSHID = encomendaResult.recordset[0].encomendaSHID;

      // Loop through each medicamento in the encomenda and insert into Medicamento_Encomenda table
      for (const medicamento of encomenda.medicamentos) {
        // Insert into Medicamento_Encomenda relationship table
        await pool.request()
		  .input('medicamentoID', mssql.Int, medicamento.medicamentoID)
		  .input('encomendaSHID', mssql.Int, encomendaSHID)  // Use encomendaSHID here
		  .query(`
			INSERT INTO Medicamento_Encomenda (MedicamentomedicamentoID, EncomendaencomendaID)
			VALUES (@medicamentoID, @encomendaSHID)
		  `);
      }
    }

    res.status(201).json({ message: 'Encomendas processed successfully' });

  } catch (err) {
    console.error('Error processing encomendas:', err);
    res.status(500).json({ error: 'Failed to process encomendas' });
  }
});

module.exports = router;
