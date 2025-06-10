const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const saleRoutes = require('./routes/saleRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const stockRoutes = require('./routes/stockRoutes');


dotenv.config();

const app = express();
app.use(cors(
  {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000', 
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }
));
app.use(express.json());

/* ROUTES */

app.use('/api/users', userRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/stock', stockRoutes);


/* CONNECTING TO MONGODB */
const PORT = process.env.PORT || 10000;

mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });  
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });

 
