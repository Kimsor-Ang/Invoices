// Report page functionality
const report = {
  data: {
    invoices: [],
    items: [],
    products: []
  },

  // Initialize report
  async init() {
    await this.loadData();
    this.displaySummary();
    this.displayRecentInvoices();
    this.displayFOCItems();
  },

  // Load all data from API
  async loadData() {
    try {
      // Load invoices
      const invoicesRes = await fetch('/api/invoices');
      const invoicesData = await invoicesRes.json();
      this.data.invoices = invoicesData.data || [];

      // Load products
      const productsRes = await fetch('/api/products');
      const productsData = await productsRes.json();
      this.data.products = productsData.data || [];

      // Get all items from invoices
      const allItems = [];
      for (const invoice of this.data.invoices) {
        const itemRes = await fetch(`/api/invoices/${invoice.id}`);
        const itemData = await itemRes.json();
        if (itemData.success && itemData.data.items) {
          allItems.push(...itemData.data.items);
        }
      }
      this.data.items = allItems;
    } catch (error) {
      console.error('Error loading data:', error);
    }
  },

  // Display summary statistics
  displaySummary() {
    // Total invoices
    document.getElementById('totalInvoices').textContent = this.data.invoices.length;

    // Total revenue (excluding FOC)
    const totalRevenue = this.data.invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;

    // Total items (excluding FOC)
    const regularItems = this.data.items.filter(item => item.unit_type !== 'FOC');
    document.getElementById('totalItems').textContent = regularItems.length;

    // Total products
    document.getElementById('totalProducts').textContent = this.data.products.length;
  },

  // Display recent invoices
  displayRecentInvoices() {
    const container = document.getElementById('recentInvoicesContainer');
    
    if (this.data.invoices.length === 0) {
      container.innerHTML = '<div class="no-data">No invoices found</div>';
      return;
    }

    // Get last 10 invoices
    const recent = this.data.invoices.slice(0, 10);

    let html = `
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Amount</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;

    recent.forEach(invoice => {
      const date = new Date(invoice.created_at);
      const dateStr = date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Phnom_Penh'
      });

      // Count items for this invoice
      const itemCount = this.data.items.filter(item => {
        // We need to match items to invoices - this is a simple count
        return true; // Count all items (in real app, match by invoice_id)
      }).length;

      html += `
        <tr>
          <td><a href="/invoice/${invoice.id}" style="color: #007bff; text-decoration: none;">
            ${invoice.invoice_number}
          </a></td>
          <td>${invoice.customer_name}</td>
          <td>-</td>
          <td>$${parseFloat(invoice.total_amount).toFixed(2)}</td>
          <td>${dateStr}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  },

  // Display FOC items
  displayFOCItems() {
    const container = document.getElementById('focItemsContainer');
    
    // Filter FOC items
    const focItems = this.data.items.filter(item => item.unit_type === 'FOC');

    if (focItems.length === 0) {
      container.innerHTML = '<div class="no-data">No FOC items found</div>';
      return;
    }

    let html = `
      <table class="invoice-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Item Name</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
    `;

    focItems.forEach(item => {
      html += `
        <tr>
          <td>${item.sku || '-'}</td>
          <td>${item.item_name}</td>
          <td>${item.quantity}</td>
          <td>${item.original_unit || item.unit_type}</td>
          <td>${item.description || '-'}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }
};

// Export all data function
async function exportAllData() {
  try {
    // This calls the existing export endpoint
    const response = await fetch('/api/invoices/export-all');
    
    if (!response.ok) {
      alert('Error exporting data');
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error:', error);
    alert('Error exporting data');
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => report.init());
