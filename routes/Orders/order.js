const express = require('express');
const cors = require('cors');
const router = express.Router();
const { executeQuery } = require('../../db'); // Import executeQuery from db.js

// Enable CORS for all origins
router.use(cors({
  origin: '*',  // Allow all origins (restrict in production)
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
  e.quantidadeEnviada
FROM Encomenda e
LEFT JOIN Estado es ON e.estadoID = es.estadoID
LEFT JOIN Fornecedor f ON e.fornecedorID = f.fornecedorID
LEFT JOIN Medicamento_Encomenda me ON e.encomendaID = me.EncomendaencomendaID
LEFT JOIN Medicamento m ON me.MedicamentomedicamentoID = m.medicamentoID
ORDER BY e.dataEncomenda DESC;

  `;

  try {
    const results = await executeQuery(query);  // Execute the query using the executeQuery function
    res.status(200).json(results.recordset);  // Return the results as JSON
  } catch (error) {
    console.error('Error fetching orders:', error.message);  // Log the error message
    res.status(500).json({ error: error.message });  // Return the error as JSON
  }
});

module.exports = router;
