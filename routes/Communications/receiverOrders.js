const express = require('express');
const router = express.Router();
const { getPool } = require('../../db'); // Assuming you have a database pool function

// POST route to receive encomenda
router.post('/receive-encomenda', async (req, res) => {
  const encomenda = req.body.encomenda;

  // Check if the encomenda data is valid
  if (!encomenda || !encomenda.estadoID || !encomenda.fornecedorID) {
    return res.status(400).json({ message: 'Missing required order fields' });
  }

  const pool = await getPool();
  const transaction = pool.transaction();

  try {
    // Start transaction
    await transaction.begin();

    // Insert into Encomenda Table
    const insertEncomendaQuery = `
      INSERT INTO Encomenda (estadoID, fornecedorID, encomendaCompleta, aprovadoPorAdministrador, dataEncomenda, dataEntrega, quantidadeEnviada)
      OUTPUT INSERTED.encomendaID
      VALUES (@estadoID, @fornecedorID, @encomendaCompleta, @aprovadoPorAdministrador, @dataEncomenda, @dataEntrega, @quantidadeEnviada)
    `;
    const encomendaResult = await transaction.request()
      .input('estadoID', encomenda.estadoID)
      .input('fornecedorID', encomenda.fornecedorID)
      .input('encomendaCompleta', encomenda.encomendaCompleta || null)
      .input('aprovadoPorAdministrador', encomenda.aprovadoPorAdministrador || null)
      .input('dataEncomenda', encomenda.dataEncomenda || null)
      .input('dataEntrega', encomenda.dataEntrega || null)
      .input('quantidadeEnviada', encomenda.quantidadeEnviada || null)
      .query(insertEncomendaQuery);

    const encomendaID = encomendaResult.recordset[0].encomendaID;

    // Insert associated Medicamentos if any
    if (encomenda.medicamentos && Array.isArray(encomenda.medicamentos)) {
      for (const medicamento of encomenda.medicamentos) {
        const { medicamentoID, quantidade } = medicamento;

        // Ensure medicamentoID and quantidade are present
        if (!medicamentoID || !quantidade) {
          throw new Error('Medicamento ID and quantity are required for each medicamento');
        }

        const insertMedicamentoEncomendaQuery = `
          INSERT INTO Medicamento_Encomenda (MedicamentomedicamentoID, EncomendaencomendaID)
          VALUES (@medicamentoID, @encomendaID)
        `;
        await transaction.request()
          .input('medicamentoID', medicamentoID)
          .input('encomendaID', encomendaID)
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
