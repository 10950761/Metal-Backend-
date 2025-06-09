// routes/saleRoutes.js
const express = require("express");
const router = express.Router();
const {
  createSale,
  getSales,
  deleteSale,
  updateSale,
  softDeleteSale,
 deleteOldSales
  
} = require("../controllers/saleController");
const protect = require("../middleware/authMiddleware");

router.post("/", protect, createSale);
router.get("/", protect, getSales);
router.delete("/:id", protect, deleteSale);
router.put("/:id", protect, updateSale);
router.patch("/:id", protect, softDeleteSale);
router.delete("/old", protect, deleteOldSales);


module.exports = router;
