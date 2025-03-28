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
router.get('/all', async (req, res) => {
  // First query to get order details
  const orderQuery = `
    SELECT 
      e.encomendaSHID AS OrderSHID,
      e.dataEncomenda,
      e.dataEntrega,
      e.encomendaCompleta,
      e.aprovadoPorAdministrador,
      es.estadoID,  -- Include estadoID here without descricao
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
  
  // Second query to get details from Medicamento_Encomenda, excluding EncomendaencomendaID
  const medicamentoQuery = `
    SELECT
      me.EncomendaencomendaID,
      me.MedicamentomedicamentoID,
      m.nomeMedicamento
    FROM Medicamento_Encomenda me
    LEFT JOIN Encomenda e ON me.EncomendaencomendaID = e.encomendaID
    LEFT JOIN Medicamento m ON me.MedicamentomedicamentoID = m.medicamentoID
    ORDER BY me.EncomendaencomendaID;
  `;
  
  try {
    // Run both queries concurrently
    const [orderResults, medicamentoResults] = await Promise.all([
      executeQuery(orderQuery),  // First query: Order details
      executeQuery(medicamentoQuery)  // Second query: Medicamento details
    ]);
    
    // Map medicamentoResults by EncomendaencomendaID for easier lookup
    const medicamentoMap = medicamentoResults.recordset.reduce((acc, item) => {
      if (!acc[item.EncomendaencomendaID]) {
        acc[item.EncomendaencomendaID] = []; // Ensure the entry is an array
      }
      acc[item.EncomendaencomendaID].push({
        MedicamentomedicamentoID: item.MedicamentomedicamentoID,
        nomeMedicamento: item.nomeMedicamento
      });
      return acc;
    }, {});
    
    // Combine orderResults with corresponding medicamentos
    const combinedResults = orderResults.recordset.map(order => {
      const medicamentos = medicamentoMap[order.OrderSHID] || []; // Default to empty array if no medicamentos
      return {
        ...order,
        medicamentos: medicamentos
      };
    });
    
    // Send combined results as a JSON response
    res.status(200).json(combinedResults);  
    
  } catch (error) {
    console.error('Error fetching data:', error.message);  // Log the error message
    res.status(500).json({ error: error.message });  // Return the error as JSON
  }
});

module.exports = router;
