// Main Express server for Invoice Application
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { testConnection, db } = require('./config/db');
const invoiceRoutes = require('./routes/invoices');
const productRoutes = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Parse JSON request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
// All invoice operations go through /api/invoices
app.use('/api/invoices', invoiceRoutes);
// All product operations go through /api/products
app.use('/api/products', productRoutes);

// Home route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Invoices list page
app.get('/invoices', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'invoices.html'));
});

// Invoice detail page
app.get('/invoice/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'invoice-detail.html'));
});

// Report page
// app.get('/report.html', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'report.html'));
// });

app.get('/report', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

app.get('/backup', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'File backup is not available with PostgreSQL. Use pg_dump instead.'
  });
});
// Product page
app.get('/products', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'products.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Initialize PostgreSQL database and start server
async function start() {
  try {
    await testConnection();

    await db.query(`CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      description TEXT,
      bag_price NUMERIC(12, 2) DEFAULT 0,
      streamer_price NUMERIC(12, 2) DEFAULT 0,
      box_price NUMERIC(12, 2) DEFAULT 0,
      ctn_price NUMERIC(12, 2) DEFAULT 0,
      middle_unit TEXT NOT NULL CHECK (middle_unit IN ('BOX', 'LINER')),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS invoices (
      id BIGSERIAL PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      total_amount NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.query(`CREATE TABLE IF NOT EXISTS invoice_items (
      id BIGSERIAL PRIMARY KEY,
      invoice_id BIGINT NOT NULL,
      product_id BIGINT,
      sku TEXT,
      description TEXT,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_type TEXT CHECK (unit_type IN ('BAG', 'STREAMER', 'BOX', 'LINER', 'CTN', 'FOC')),
      original_unit TEXT,
      price NUMERIC(12, 2) NOT NULL,
      subtotal NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // Add columns if table was created in an older version
    const columnsToAdd = [
      { col: 'product_id', type: 'BIGINT' },
      { col: 'sku', type: 'TEXT' },
      { col: 'description', type: 'TEXT' },
      { col: 'unit_type', type: 'TEXT' },
      { col: 'original_unit', type: 'TEXT' }
    ];

    for (const col of columnsToAdd) {
      await db.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS ${col.col} ${col.type}`);
    }

    await db.query(`CREATE INDEX IF NOT EXISTS idx_sku ON products(sku)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_product_name ON products(product_name)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_invoice_number ON invoices(invoice_number)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_customer_name ON invoices(customer_name)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoices(created_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_invoice_id ON invoice_items(invoice_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_product_id ON invoice_items(product_id)`);

    const server = app.listen(PORT, () => {
      console.log(`\n✓ Server running at http://localhost:${PORT}`);
      console.log('✓ Open http://localhost:3000 in your browser');
      console.log('✓ Press Ctrl+C to stop the server\n');
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`✗ Port ${PORT} is already in use.`);
        console.error(`Close the other app using port ${PORT} or set PORT in .env to another value.`);
      } else {
        console.error('✗ Server failed to bind port:', err);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

