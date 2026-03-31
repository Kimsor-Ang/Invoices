// Invoice model - handles all database operations for invoices (PostgreSQL)
const { db } = require('../config/db');

class Invoice {
  static async generateInvoiceNumber() {
    const todayDate = new Date().toISOString().slice(0, 10);
    const todayCompact = todayDate.replace(/-/g, '');

    const result = await db.query(
      `SELECT COALESCE(
          MAX(CAST(RIGHT(invoice_number, 3) AS INTEGER)),
          0
        ) AS last_sequence
       FROM invoices
       WHERE created_at::date = $1::date
         AND invoice_number LIKE $2`,
      [todayDate, `INV-${todayCompact}-%`]
    );

    const nextSequence = Number(result.rows[0]?.last_sequence || 0) + 1;
    const sequenceNumber = String(nextSequence).padStart(3, '0');
    return `INV-${todayCompact}-${sequenceNumber}`;
  }

  static async create(invoiceData) {
    const client = await db.connect();

    try {
      const invoiceNumber = await this.generateInvoiceNumber();
      await client.query('BEGIN');

      const invoiceResult = await client.query(
        `INSERT INTO invoices (invoice_number, customer_name, total_amount, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [invoiceNumber, invoiceData.customerName, invoiceData.totalAmount]
      );

      const invoiceId = invoiceResult.rows[0].id;

      for (const item of invoiceData.items) {
        await client.query(
          `INSERT INTO invoice_items
            (invoice_id, product_id, sku, description, item_name, quantity, unit_type, original_unit, price, subtotal, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
          [
            invoiceId,
            item.productId || null,
            item.sku || '',
            item.description || '',
            item.name,
            item.quantity,
            item.unitType || '',
            item.originalUnit || '',
            item.price,
            item.subtotal
          ]
        );
      }

      await client.query('COMMIT');
      return {
        success: true,
        invoiceId,
        invoiceNumber,
        message: 'Invoice saved successfully'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getAllInvoices() {
    const result = await db.query(
      `SELECT id, invoice_number, customer_name, total_amount, created_at
       FROM invoices
       ORDER BY created_at DESC`
    );
    return result.rows || [];
  }

  static async getInvoiceById(id) {
    const invoiceResult = await db.query(
      `SELECT id, invoice_number, customer_name, total_amount, created_at
       FROM invoices
       WHERE id = $1`,
      [id]
    );

    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      return null;
    }

    const itemsResult = await db.query(
      `SELECT sku, description, item_name, quantity, price, subtotal, unit_type, original_unit
       FROM invoice_items
       WHERE invoice_id = $1
       ORDER BY product_id`,
      [id]
    );

    return {
      ...invoice,
      items: itemsResult.rows || []
    };
  }

  static async addProduct(productData) {
    const result = await db.query(
      `INSERT INTO products
        (sku, product_name, description, bag_price, streamer_price, box_price, ctn_price, middle_unit, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        productData.sku,
        productData.productName,
        productData.description,
        productData.bagPrice,
        productData.streamerPrice,
        productData.boxPrice,
        productData.ctnPrice,
        productData.middleUnit
      ]
    );

    return {
      success: true,
      productId: result.rows[0].id,
      message: 'Product added successfully'
    };
  }

  static async getAllProducts() {
    const result = await db.query(
      `SELECT * FROM products
       ORDER BY id ASC`
    );
    return result.rows || [];
  }

  static async getProductBySku(sku) {
    const result = await db.query(
      `SELECT * FROM products
       WHERE sku = $1`,
      [sku]
    );
    return result.rows[0] || null;
  }

  static async getProductById(id) {
    const result = await db.query(
      `SELECT * FROM products
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async updateProduct(id, productData) {
    const result = await db.query(
      `UPDATE products
       SET product_name = $1,
           description = $2,
           bag_price = $3,
           streamer_price = $4,
           box_price = $5,
           ctn_price = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [
        productData.productName,
        productData.description,
        productData.bagPrice,
        productData.streamerPrice,
        productData.boxPrice,
        productData.ctnPrice,
        id
      ]
    );

    return {
      success: true,
      message: 'Product updated successfully',
      affectedRows: result.rowCount
    };
  }

  static async deleteProduct(id) {
    const result = await db.query('DELETE FROM products WHERE id = $1', [id]);
    return {
      success: true,
      message: 'Product deleted successfully',
      affectedRows: result.rowCount
    };
  }

  static async deleteInvoice(id) {
    const result = await db.query('DELETE FROM invoices WHERE id = $1', [id]);
    return {
      success: true,
      message: 'Invoice deleted successfully',
      affectedRows: result.rowCount
    };
  }
}

module.exports = Invoice;
