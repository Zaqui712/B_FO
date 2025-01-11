const sql = require('mssql');
const { getPool } = require('../../db');

router.post('/receive-encomenda', async (req, res) => {
  const encomenda = req.body.encomenda;

  if (!encomenda || !encomenda.estadoID || !encomenda.fornecedorID) {
    return res.status(400).json({ message: 'Missing required order fields' });
  }

  const pool = await getPool();  // Assuming `getPool` gives you a connection pool

  const transaction = new sql.Transaction(pool);

  try {
    // Start transaction
    await transaction.begin();

    const insertEncomendaQuery = `
      INSERT INTO Encomenda (estadoID, fornecedorID, encomendaCompleta, aprovadoPorAdministrador, dataEncomenda, dataEntrega, quantidadeEnviada)
      OUTPUT INSERTED.encomendaID
      VALUES (@estadoID, @fornecedorID, @encomendaCompleta, @aprovadoPorAdministrador, @dataEncomenda, @dataEntrega, @quantidadeEnviada)
    `;

    // Execute query with transaction
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

    // Insert associated Medicamentos if any
    if (encomenda.medicamentos && Array.isArray(encomenda.medicamentos)) {
      for (const medicamento of encomenda.medicamentos) {
        const { medicamentoID, quantidade } = medicamento;

        if (!medicamentoID || !quantidade) {
          throw new Error('Medicamento ID and quantity are required for each medicamento');
        }

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

    // Commit transaction
    await transaction.commit();

    res.status(201).json({ message: 'Encomenda received and processed successfully', encomendaID });
  } catch (error) {
    console.error('Error processing encomenda:', error.message);
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: 'Error processing encomenda', details: error.message });
  }
});

module.exports = router;
