// API routes for invoice operations (SQLite)
const express = require("express");
const router = express.Router();
const Invoice = require("../models/Invoice");
const ExcelJS = require("exceljs");
const { db } = require("../config/db");

// Helper function to format date in Cambodia timezone
function formatCambodiaDateTime(dateString) {
  const date = new Date(dateString);
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Phnom_Penh",
  });

  const parts = formatter.formatToParts(date);
  const formatted = {};
  parts.forEach((part) => {
    formatted[part.type] = part.value;
  });

  return `${formatted.month}/${formatted.day}/${formatted.year}, ${formatted.hour}:${formatted.minute}:${formatted.second}`;
}

// POST /api/invoices - Save new invoice
router.post("/", async (req, res) => {
  try {
    const invoiceData = req.body;

    // Validation
    if (
      !invoiceData.customerName ||
      !invoiceData.items ||
      invoiceData.items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer name and items are required",
      });
    }

    const hasFocItem = invoiceData.items.some((item) => item.unitType === "FOC");
    const hasBuyingUnit = invoiceData.items.some((item) => item.unitType !== "FOC");
    if (hasFocItem && !hasBuyingUnit) {
      return res.status(400).json({
        success: false,
        message: "Can't save invoice with FOC only. Add buying unit first.",
      });
    }

    // Save invoice to database
    const result = await Invoice.create(invoiceData);
    res.json(result);
  } catch (error) {
    console.error("Error saving invoice:", error);
    res.status(500).json({
      success: false,
      message: "Error saving invoice",
      error: error.message,
    });
  }
});

// GET /api/invoices - Get all invoices
router.get("/", async (req, res) => {
  try {
    const invoices = await Invoice.getAllInvoices();
    res.json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: error.message,
    });
  }
});

// GET /api/invoices/export-all - Export all invoices to Excel
router.get("/export-all", async (req, res) => {
  try {
    // Get all invoices
    const invoices = await Invoice.getAllInvoices();

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // ===== INVOICES SHEET =====
    const invoicesSheet = workbook.addWorksheet("Invoices");
    invoicesSheet.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Invoice #", key: "invoice_number", width: 20 },
      { header: "Customer", key: "customer_name", width: 20 },
      { header: "Total Amount", key: "total_amount", width: 15 },
      { header: "Date", key: "created_at", width: 25 },
    ];

    invoices.forEach((invoice) => {
      invoicesSheet.addRow({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        total_amount: invoice.total_amount,
        created_at: formatCambodiaDateTime(invoice.created_at),
      });
    });

    // Style header row
    invoicesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    invoicesSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    invoicesSheet.getColumn("total_amount").numFmt = "$#,##0.00";

    // ===== ITEMS SHEET =====
    const itemsSheet = workbook.addWorksheet("Items");
    const itemsResult = await db.query(
      `
        SELECT 
          ii.invoice_id,
          ii.sku,
          ii.item_name,
          ii.description,
          ii.quantity,
          ii.unit_type,
          ii.original_unit,
          ii.price,
          ii.subtotal,
          i.invoice_number
        FROM invoice_items ii
        LEFT JOIN invoices i ON ii.invoice_id = i.id
        ORDER BY ii.invoice_id DESC, ii.id
      `,
    );
    const items = itemsResult.rows || [];

    itemsSheet.columns = [
      { header: "Invoice #", key: "invoice_number", width: 20 },
      { header: "SKU", key: "sku", width: 12 },
      { header: "Item Name", key: "item_name", width: 20 },
      { header: "Description", key: "description", width: 20 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Unit Type", key: "unit_type", width: 12 },
      { header: "Unit", key: "original_unit", width: 10 },
      { header: "Price", key: "price", width: 12 },
      { header: "Subtotal", key: "subtotal", width: 12 },
    ];

    items.forEach((item) => {
      itemsSheet.addRow({
        invoice_number: item.invoice_number,
        sku: item.sku,
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit_type: item.unit_type,
        original_unit: item.original_unit,
        price: item.price,
        subtotal: item.subtotal,
      });
    });

    itemsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    itemsSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    itemsSheet.getColumn("price").numFmt = "$#,##0.00";
    itemsSheet.getColumn("subtotal").numFmt = "$#,##0.00";

    // ===== PRODUCTS SHEET =====
    const productsSheet = workbook.addWorksheet("Products");

    const productsResult = await db.query(
      `
    SELECT *
    FROM products
    ORDER BY sku ASC
  `,
    );
    const products = productsResult.rows || [];

    // ✅ HEADERS (MATCH DB)
    productsSheet.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "SKU", key: "sku", width: 15 },
      { header: "Product Name", key: "product_name", width: 25 },
      { header: "Description", key: "description", width: 30 },

      { header: "Bag Price", key: "bag_price", width: 12 },
      { header: "Streamer Price", key: "streamer_price", width: 15 },
      { header: "Box/Liner Price", key: "box_price", width: 15 },
      { header: "CTN Price", key: "ctn_price", width: 12 },

      { header: "Middle Unit", key: "middle_unit", width: 12 },
      { header: "Created", key: "created_at", width: 20 },
    ];

    // ✅ ADD DATA (FIX: streamer_price was missing)
    products.forEach((product) => {
      productsSheet.addRow({
        id: product.id,
        sku: product.sku,
        product_name: product.product_name,
        description: product.description,

        bag_price: product.bag_price || 0,
        streamer_price: product.streamer_price || 0,
        box_price: product.box_price || 0,
        ctn_price: product.ctn_price || 0,

        middle_unit: product.middle_unit,
        created_at: formatCambodiaDateTime(product.created_at),
      });
    });

    // ✅ STYLE HEADER
    const headerRow = productsSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };

    // ✅ FIX: correct column keys (NO unit_price anymore)
    productsSheet.getColumn("bag_price").numFmt = "$#,##0.00";
    productsSheet.getColumn("streamer_price").numFmt = "$#,##0.00";
    productsSheet.getColumn("box_price").numFmt = "$#,##0.00";
    productsSheet.getColumn("ctn_price").numFmt = "$#,##0.00";

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    // Send as download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Invoice_Export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting invoices:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting invoices",
      error: error.message,
    });
  }
});

// GET /api/invoices/:id - Get single invoice with items
router.get("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.getInvoiceById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching invoice",
      error: error.message,
    });
  }
});

// DELETE /api/invoices/:id - Delete invoice
router.delete("/:id", async (req, res) => {
  try {
    const result = await Invoice.deleteInvoice(req.params.id);
    res.json(result);
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting invoice",
      error: error.message,
    });
  }
});

module.exports = router;
