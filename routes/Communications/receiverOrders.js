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
      // Insert into Encomenda table (excluding nomeFornecedor and profissionalNome)
      const encomendaResult = await pool.request()
        .input('estadoID', mssql.Int, encomenda.estadoID)
        .input('fornecedorID', mssql.Int, encomenda.fornecedorID)
        .input('quantidadeEnviada', mssql.Int, encomenda.quantidadeEnviada)
        .query(`
          INSERT INTO Encomenda (estadoID, fornecedorID, quantidadeEnviada)
          OUTPUT INSERTED.encomendaID
          VALUES (@estadoID, @fornecedorID, @quantidadeEnviada)
        `);

      const encomendaID = encomendaResult.recordset[0].encomendaID;

      // Loop through each medicamento in the encomenda and insert into Medicamento_Encomenda table
      for (const medicamento of encomenda.medicamentos) {
        // Insert into Medicamento_Encomenda relationship table
        await pool.request()
          .input('medicamentoID', mssql.Int, medicamento.medicamentoID)
          .input('encomendaID', mssql.Int, encomendaID)
          .query(`
            INSERT INTO Medicamento_Encomenda (MedicamentomedicamentoID, EncomendaencomendaID)
            VALUES (@medicamentoID, @encomendaID)
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
