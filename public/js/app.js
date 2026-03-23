// Invoice form application logic
const app = {
  products: [],

  // Initialize the application
  async init() {
    // Load products first
    await this.loadProducts();

    // Generate initial invoice number
    this.generateInvoiceNumber();

    // Add first empty item row
    this.addItemRow();

    // Listen to form submission
    document.getElementById("invoiceForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const isSaved = await this.submitForm();
      if (isSaved) {
        this.resetItemRow();
        this.addItemRow();
        this.generateInvoiceNumber();
        this.updateTotal();
      }
    });

    // Listen to reset button
    document.getElementById("invoiceForm").addEventListener("reset", () => {
      setTimeout(() => {
        this.resetItemRow();
        this.addItemRow();
        this.generateInvoiceNumber();
        this.updateTotal();
      }, 0);
    });
  },

  // Load products from server
  async loadProducts() {
    try {
      const response = await fetch("/api/products");
      const result = await response.json();

      if (result.success) {
        this.products = result.data;
      } else {
        console.error("Failed to load products:", result.message);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    }
  },

  // Generate invoice number (will come from server in real scenario)
  generateInvoiceNumber() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const date = String(today.getDate()).padStart(2, "0");
    const timestamp = Date.now() % 10000; // Last 4 digits of timestamp
    const invoiceNo = `INV-${year}${month}${date}-${String(timestamp).padStart(4, "0")}`;
    document.getElementById("invoiceNumber").value = invoiceNo;
  },

  // Add a new item row to the form
  addItemRow() {
    const container = document.getElementById("itemsContainer");

    const itemRow = document.createElement("div");
    itemRow.className = "item-row item-card";

    const productOptions = this.products
      .map(
        (p) =>
          `<option value="${p.id}" 
            data-name="${p.product_name}"
            data-sku="${p.sku}"
            data-bag="${p.bag_price}"
            data-streamer="${p.streamer_price}"
            data-box="${p.box_price}"
            data-ctn="${p.ctn_price}"
            data-middle="${p.middle_unit}">
            ${p.sku} - ${p.product_name}
          </option>`,
      ).join("");

    itemRow.innerHTML = `
    <div>
      <!-- PRODUCT -->
      <div>
        <label>Product</label>
        <select class="item-product" onchange="app.onProductSelect(this)">
          <option value="">Select Product</option>
          ${productOptions}
        </select>
      </div>

      <!-- UNIT -->
      <div>
        <label>Unit Type</label>
        <select class="item-unit-select" onchange="app.onUnitChange(this)">
          <option value="">Select Unit</option>
        </select>

        <input type="hidden" class="item-unit-type">
        <input type="hidden" class="item-foc-unit">
      </div>

      <!-- PRICE -->
      <div>
        <label>Price</label>
        <input type="number" class="item-price" readonly>
      </div>

      <!-- QTY -->
      <div>
        <label>Qty</label>
        <input type="number" class="item-quantity" value="1"
          onchange="app.updateTotal()"
          oninput="app.updateSubtotal(this.closest('.item-row'))">
      </div>

      <!-- SUBTOTAL -->
      <div>
        <label>Subtotal</label>
        <div class="item-subtotal">$ 0.00</div>
      </div>

      <button type="button" class="btn-remove" onclick="app.removeItemRow(this)">🗑️</button>
    </div>
  `;

    container.appendChild(itemRow);
  },
  onUnitChange(selectElement) {
    const itemRow = selectElement.closest(".item-row");
    const productSelect = itemRow.querySelector(".item-product");
    const option = productSelect.options[productSelect.selectedIndex];

    if (!option.value) {
      this.showMessage("Select product first", "error");
      return;
    }

    const prices = {
      BAG: parseFloat(option.dataset.bag) || 0,
      STREAMER: parseFloat(option.dataset.streamer) || 0,
      BOX: parseFloat(option.dataset.box),
      LINER: parseFloat(option.dataset.box) || 0, // reuse same price
      CTN: parseFloat(option.dataset.ctn) || 0,
    };

    let value = selectElement.value;
    let isFOC = value.startsWith("FOC_");

    let unit = isFOC ? value.replace("FOC_", "") : value;

    let price = isFOC ? 0 : prices[unit] || 0;

    itemRow.querySelector(".item-unit-type").value = isFOC ? "FOC" : unit;
    itemRow.querySelector(".item-foc-unit").value = unit;
    itemRow.querySelector(".item-price").value = price.toFixed(2);

    this.updateSubtotal(itemRow);
    this.updateTotal();
  },
  // add new to reset item rows
  resetItemRow() {
    const container = document.getElementById("itemsContainer");
    container.innerHTML = "";
  },

  // Remove an item row
  removeItemRow(button) {
    const container = document.getElementById("itemsContainer");

    // Don't allow removing if only one item exists
    if (container.querySelectorAll(".item-row").length <= 1) {
      this.showMessage("At least one item is required", "error");
      return;
    }

    button.closest(".item-row").remove();
    this.updateTotal();
  },

  // Handle product selection
  onProductSelect(selectElement) {
    const itemRow = selectElement.closest(".item-row");
    const unitSelect = itemRow.querySelector(".item-unit-select");
    const option = selectElement.options[selectElement.selectedIndex];
    console.log(option.dataset.streamer)
    if (!option.value) return;

    const middleUnit = option.dataset.middle || "BOX"; // BOX or LINER
    // <option value="FOC_BAG">FOC (BAG)</option>
    // 🔥 Build dynamic unit list
    unitSelect.innerHTML = `
    <option value="">Select Unit</option>
    <option value="BAG">BAG</option>
    ${option.dataset.streamer != 0 ? `<option value="STREAMER">STREAMER</option>` : ""}
    
    <option value="${middleUnit}">${middleUnit}</option>
    <option value="CTN">CTN</option>
    
    ${option.dataset.streamer != 0 ? `<option value="FOC_STREAMER">FOC (STREAMER)</option>` : ""}
    <option value="FOC_${middleUnit}">FOC (${middleUnit})</option>
    <option value="FOC_CTN">FOC (CTN)</option>
  `;

    // Reset
    itemRow.querySelector(".item-price").value = "";
    itemRow.querySelector(".item-unit-type").value = "";
    itemRow.querySelector(".item-foc-unit").value = "";

    this.updateSubtotal(itemRow);
    this.updateTotal();
  },

  // Update FOC unit selection
  updateFOCUnit(selectElement) {
    const itemRow = selectElement.closest(".item-row");
    const focUnit = selectElement.value;
    itemRow.querySelector(".item-foc-unit").value = focUnit;
    this.updateSubtotal(itemRow);
    this.updateTotal();
  },

  // Handle unit type selection
  selectUnitType(button, event) {
    event.preventDefault();

    const itemRow = button.closest(".item-row");
    const unitType = button.dataset.type;
    const selectElement = itemRow.querySelector(".item-product");
    const productId = selectElement.value;

    if (!productId) {
      this.showMessage("Please select a product first", "error");
      return;
    }

    // Find the product
    const product = this.products.find((p) => p.id == productId);
    if (!product) {
      this.showMessage("Product not found", "error");
      return;
    }

    // Deselect all buttons and hide FOC dropdown by default
    itemRow.querySelectorAll(".unit-btn").forEach((btn) => {
      btn.style.background = "";
      btn.style.color = "";
    });
    itemRow.querySelector(".foc-unit-selector").style.display = "none";

    // if a regular unit (BOX/CTN) selected, enable FOC button
    if (unitType === "BOX" || unitType === "CTN") {
      const focBtn = itemRow.querySelector('.unit-btn[data-type="FOC"]');
      if (focBtn) focBtn.disabled = false;
    }

    // Select the clicked button
    if (unitType === "FOC") {
      button.style.background = "#ff9800";
      button.style.color = "white";
      // Show FOC unit selector
      itemRow.querySelector(".foc-unit-selector").style.display = "block";
    } else {
      button.style.background = "#007bff";
      button.style.color = "white";
    }

    // Set the price based on unit type
    let price = 0;
    if (unitType === "BOX") {
      price = product.box_price;
      itemRow.querySelector(".item-foc-unit").value = "BOX";
    } else if (unitType === "CTN") {
      price = product.ctn_price;
      itemRow.querySelector(".item-foc-unit").value = "CTN";
    } else if (unitType === "FOC") {
      price = 0;
      // FOC unit is selected via dropdown, default to what's in dropdown if already set
      if (!itemRow.querySelector(".item-foc-unit").value) {
        itemRow.querySelector(".item-foc-unit").value =
          itemRow.querySelector(".foc-unit-select").value || "BOX";
      }
    }

    itemRow.querySelector(".item-price").value = price.toFixed(2);
    itemRow.querySelector(".item-unit-type").value = unitType;
    // Update subtotal
    this.updateSubtotal(itemRow);
    this.updateTotal();
  },

  // Remove an item row
  reset(button) {
    const container = document.getElementById("itemsContainer");

    // Don't allow removing if only one item exists
    if (container.querySelectorAll(".item-row").length <= 1) {
      this.showMessage("At least one item is required", "error");
      return;
    }

    button.closest(".item-row").remove();
    this.updateTotal();
  },

  // Update subtotal for an item row
  updateSubtotal(itemRow) {
    const qty = parseFloat(itemRow.querySelector(".item-quantity").value) || 0;
    const price = parseFloat(itemRow.querySelector(".item-price").value) || 0;
    const subtotal = qty * price;

    const subtotalDiv = itemRow.querySelector(".item-subtotal");
    subtotalDiv.textContent = `$ ${subtotal.toFixed(2)}`;
  },

  // Update total amount
  updateTotal() {
    const itemRows = document.querySelectorAll(".item-row");
    let total = 0;

    itemRows.forEach((row) => {
      const qty = parseFloat(row.querySelector(".item-quantity").value) || 0;
      const price = parseFloat(row.querySelector(".item-price").value) || 0;
      total += qty * price;
      this.updateSubtotal(row);
    });

    document.getElementById("totalAmount").textContent =
      `$ ${total.toFixed(2)} = ៛ ${total * 4000}`;
  },

  // Submit the invoice form
  async submitForm() {
    // Use default customer name
    const customerName = "Customer";

    // Get all items
    const items = [];
    document.querySelectorAll(".item-row").forEach((row) => {
      const selectElement = row.querySelector(".item-product");
      const productId = selectElement.value;
      const quantity = parseFloat(row.querySelector(".item-quantity").value);
      const price = parseFloat(row.querySelector(".item-price").value) || 0;
      const unitType = row.querySelector(".item-unit-type").value;
      const originalUnit =
        row.querySelector(".item-foc-unit").value || unitType;

      // Allow items with unit type selected or FOC with base unit
      if (productId && quantity && unitType) {
        const product = this.products.find((p) => p.id == productId);
        items.push({
          productId: productId,
          name: product.product_name,
          sku: product.sku,
          description: product.description,
          quantity: quantity,
          price: price,
          unitType: unitType,
          originalUnit: originalUnit,
          subtotal: quantity * price,
        });
      }
    });

    if (items.length === 0) {
      this.showMessage(
        "Please add at least one item with a unit type or FOC selected",
        "error",
      );
      return false;
    }

    const hasFocItem = items.some((item) => item.unitType === "FOC");
    const hasBuyingUnit = items.some((item) => item.unitType !== "FOC");
    if (hasFocItem && !hasBuyingUnit) {
      this.showMessage("Can't save invoice with FOC only. Add buying unit first.", "error");
      return false;
    }

    // Calculate total
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    // Prepare invoice data
    const invoiceData = {
      customerName: customerName,
      totalAmount: totalAmount,
      items: items,
    };

    try {
      // Send to server
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoiceData),
      });

      const result = await response.json();

      if (result.success) {
        this.showMessage(
          `✓ Invoice ${result.invoiceNumber} saved successfully! Ready to print.`,
          "success",
        );
        this.displayReceipt(
          result.invoiceId,
          result.invoiceNumber,
          invoiceData,
        );
        return true;
      } else {
        this.showMessage("Error: " + result.message, "error");
        return false;
      }
    } catch (error) {
      console.error("Error:", error);
      this.showMessage("Error saving invoice", "error");
      return false;
    }
  },

  // Helper function to format dates in Cambodia timezone (ICT - UTC+7)
  formatCambodiaDate(date) {
    const options = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Phnom_Penh",
    };
    return date.toLocaleString("en-US", options);
  },

  // Display receipt preview for printing
  displayReceipt(invoiceId, invoiceNumber, invoiceData) {
    const today = new Date();
    const dateStr = this.formatCambodiaDate(today);

    let itemsHTML = "";
    invoiceData.items.forEach((item) => {
      // show quantity with unit clearly
      let line;
      const unitDisplay =
        item.unitType === "FOC" ? item.originalUnit : item.unitType;
      if (item.unitType === "FOC") {
        line = `${item.quantity} ${unitDisplay} - FOC`;
      } else {
        line = `${item.quantity} ${unitDisplay} @ $${item.price.toFixed(2)}`;
      }
      itemsHTML += `
        <div class="item-line">
          <span class="item-name">${item.sku} - ${item.name}${item.description ? " (" + item.description + ")" : ""}</span>
          <span class="item-qty-price">${line}</span>
        </div>
        ${item.unitType !== "FOC" ? `<div class="item-line" style="text-align: right; font-weight: bold;">$${item.subtotal.toFixed(2)}</div>` : ""}
      `;
    });

    const receiptHTML = `
      <div class="receipt">
        <div class="receipt-header">
          INVOICE
        </div>
        <div class="receipt-number">Inv #: ${invoiceNumber}</div>
        <div class="receipt-date">Date: ${dateStr}</div>

        <div class="receipt-items">
          ${itemsHTML}
        </div>

        <div class="receipt-totals">
          <div class="total-row">
            <span>TOTAL</span>
            <span>$${invoiceData.totalAmount.toFixed(2)}</span>
          </div>
          <div class="total-amount">
            $${invoiceData.totalAmount.toFixed(2)} (៛ ${(invoiceData.totalAmount * 4000).toFixed(0)})
            </div>
          <div class="total-amount">
            
          </div>
        </div>

        <div class="receipt-footer">
          Thank You!
          Visit Again
        </div>
      </div>
    `;

    const receiptContainer = document.getElementById("receiptContainer");
    receiptContainer.innerHTML = receiptHTML;
    receiptContainer.style.display = "block";

    // Add print button
    const printBtn = document.createElement("button");
    printBtn.className = "btn btn-primary btn-print";
    printBtn.style.display = "block";
    printBtn.style.margin = "20px auto";
    printBtn.innerHTML = "🖨️ Print or Save as PDF";
    printBtn.onclick = () => {
      // Navigate to invoice detail page where user can print
      window.location.href = `/invoice/${invoiceId}`;
    };
    receiptContainer.appendChild(printBtn);

    // Scroll to receipt
    setTimeout(() => {
      receiptContainer.scrollIntoView({ behavior: "smooth" });
    }, 300);
  },

  // Show message to user
  showMessage(message, type) {
    const container = document.getElementById("messageContainer");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    container.innerHTML = "";
    container.appendChild(messageDiv);

    // Auto-remove success messages after 5 seconds
    if (type === "success") {
      setTimeout(() => {
        messageDiv.remove();
      }, 5000);
    }
  },
};

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => app.init());
