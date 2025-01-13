const express = require('express');
const cors = require('cors');  // Import cors
const router = express.Router();
const { executeQuery } = require('../../db'); // Database connection pool

// Enable CORS for all origins
router.use(cors({
  origin: '*',  // Allow all origins (you can restrict this to specific domains in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// READ - Route to check all orders and their details
router.get('/', async (req, res) => {
  const query = `
    SELECT 
        e.encomendaID,
        e.dataEncomenda,
        e.dataEntrega,
        e.encomendaCompleta,
        e.aprovadoPorAdministrador,
        es.descricao AS estado,
        f.nomeFornecedor,
        f.contactoFornecedor,
        m.nomeMedicamento,
        me.quantidadeEnviada
    FROM Encomenda e
    JOIN Estado es ON e.estadoID = es.estadoID
    JOIN Fornecedor f ON e.fornecedorID = f.fornecedorID
    JOIN Medicamento_Encomenda me ON e.encomendaID = me.EncomendaencomendaID
    JOIN Medicamento m ON me.MedicamentomedicamentoID = m.medicamentoID
    ORDER BY e.dataEncomenda DESC;
  `;

  try {
    const results = await executeQuery(query);  // Execute query from db.js
    res.status(200).json(results.recordset);  // Send the results as a JSON response
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
