// View invoice details and print
const invoiceDetail = {
  invoiceId: null,
  invoice: null,

  // Initialize the page
  init() {
    // Extract invoice ID from URL
    const url = new URL(window.location.href);
    const pathParts = url.pathname.split('/');
    this.invoiceId = pathParts[pathParts.length - 1];

    if (!this.invoiceId || this.invoiceId === 'invoice-detail.html') {
      this.showMessage('Error: Invalid invoice ID', 'error');
      return;
    }

    this.loadInvoice();
  },

  // Load invoice details from server
  async loadInvoice() {
    const loadingContainer = document.getElementById('loadingContainer');
    const actionButtons = document.getElementById('actionButtons');
    const invoiceDisplay = document.getElementById('invoiceDisplay');

    loadingContainer.style.display = 'block';
    actionButtons.style.display = 'none';
    invoiceDisplay.innerHTML = '';

    try {
      const response = await fetch(`/api/invoices/${this.invoiceId}`);
      const result = await response.json();

      loadingContainer.style.display = 'none';

      if (result.success) {
        this.invoice = result.data;
        this.displayInvoice();
        actionButtons.style.display = 'block';
      } else {
        this.showMessage('Invoice not found', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      loadingContainer.style.display = 'none';
      this.showMessage('Error loading invoice', 'error');
    }
  },

  // Helper function to format dates in Cambodia timezone (ICT - UTC+7)
  formatCambodiaDate(date) {
    const options = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Phnom_Penh'
    };
    return new Date(date).toLocaleString('en-US', options);
  },

  // Display invoice in receipt format
  displayInvoice() {
    const invoice = this.invoice;
    const date = new Date(invoice.created_at);
    const dateStr = this.formatCambodiaDate(date);

    let itemsHTML = '';
    invoice.items.forEach(item => {
      // determine unit display (FOC handled via original_unit)
      let unitDisplay = item.unit_type === 'FOC' ? item.original_unit : item.unit_type;
      if (!unitDisplay) unitDisplay = '';
      let line = '';
      if (item.unit_type === 'FOC') {
        line = `${item.quantity} ${unitDisplay} - FOC (FREE)`;
      } else {
        line = `${item.quantity} ${unitDisplay} @ $${parseFloat(item.price).toFixed(2)}`;
      }

      itemsHTML += `
        <div class="item-line">
          <span class="item-name">${item.sku ? item.sku + ' - ' : ''}${item.item_name}${item.description ? ' (' + item.description + ')' : ''}</span>
          <span class="item-qty-price">${line}</span>
        </div>
        ${item.unit_type !== 'FOC' ? `<div class="item-line" style="text-align: right; font-weight: bold;">$${parseFloat(item.subtotal).toFixed(2)}</div>` : ''}
        <br/>
        `;
    });

    const receiptHTML = `
      <div class="receipt" id="printableReceipt">
        <div class="receipt-header">
          INVOICE
        </div>
        <div class="receipt-number">Inv #: ${invoice.invoice_number}</div>
        <div class="receipt-date">Date: ${dateStr}</div>
        
        <div class="receipt-customer">
         Customer: ${invoice.customer_name}
        </div>

        <div class="receipt-items">
          ${itemsHTML}
        </div>

        <div class="receipt-totals">
          <div class="total-row">
            <span>TOTAL</span>
            <span>$${parseFloat(invoice.total_amount).toFixed(2)}</span>
          </div>
          <div class="total-amount">
            $${parseFloat(invoice.total_amount).toFixed(2)} (៛ ${(parseFloat(invoice.total_amount) * 4000).toFixed(0)})
          </div>
        </div>

        <div class="receipt-footer">
          Thank You!
          Visit Again
        </div>
      </div>
    `;

    document.getElementById('invoiceDisplay').innerHTML = receiptHTML;
  },

  // Print invoice
  printInvoice() {
    window.print();
  },

  // Delete invoice
  async deleteInvoice() {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${this.invoiceId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        this.showMessage('✓ Invoice deleted. Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = '/invoices';
        }, 2000);
      } else {
        this.showMessage('Error: ' + result.message, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      this.showMessage('Error deleting invoice', 'error');
    }
  },

  // Show message
  showMessage(message, type) {
    const container = document.getElementById('messageContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    container.innerHTML = '';
    container.appendChild(messageDiv);
  }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => invoiceDetail.init());
