const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const saleRoutes = require('./routes/saleRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const stockRoutes = require('./routes/stockRoutes');
const notificationRoutes = require('./routes/notificationRoutes')

dotenv.config();

const app = express();

app.use(cors());

app.use(express.json());

/* ROUTES */
app.use('/api/users', userRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/notifications', notificationRoutes)

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