// Product management JavaScript
let allProducts = [];

// Initialize page
document.addEventListener("DOMContentLoaded", function () {
  loadProducts();

  // Form submission
  document
    .getElementById("productForm")
    .addEventListener("submit", handleAddProduct);
  document
    .getElementById("editForm")
    .addEventListener("submit", handleEditProduct);
});

// Load all products
async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    const result = await response.json();

    if (result.success) {
      allProducts = result.data;
      displayProducts();
    } else {
      showError("Failed to load products");
    }
  } catch (error) {
    showError("Error loading products: " + error.message);
  }
}

// Display products in grid
function displayProducts() {
  const productsList = document.getElementById("productsList");

  if (allProducts.length === 0) {
    productsList.innerHTML = `
    <div class="no-products">
    No products yet. Add a new product to get started.
    </div>`;
    return;
  }
  productsList.style.display = "grid";

  productsList.innerHTML = allProducts
    .map(
      (product) => `
    <div class="product-card">
      <h3>${product.sku}</h3>
      <div class="product-info">
        <strong>${product.product_name}</strong>
        ${product.description ? `<p>${product.description}</p>` : ""}
      </div>
      <div class="product-prices">
        <div class="price-row">
          <span>BAG:</span>
          <span>$${parseFloat(product.bag_price || 0).toFixed(2)}</span>
        </div>
        ${
          parseFloat(product.streamer_price || 0).toFixed(2) != 0
            ? `
          <div class="price-row">
            <span>STREAMER:</span>
            <span>$${parseFloat(product.streamer_price || 0).toFixed(2)}</span>
          </div>
        `
            : ""
        }
        <div class="price-row">
          <span style="text-transform: uppercase;">${product.middle_unit}:</span>
          <span>$${parseFloat(product.box_price || 0).toFixed(2)}</span>
        </div>
        <div class="price-row">
          <span>CTN:</span>
          <span>$${parseFloat(product.ctn_price || 0).toFixed(2)}</span>
        </div>
      </div>
      <div class="product-actions">
        <button class="btn-edit" onclick="openEditModal(${product.id})">Edit</button>
        <button class="btn-delete" onclick="deleteProduct(${product.id})">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");
}

// Handle add product form submission
async function handleAddProduct(e) {
  e.preventDefault();
  const productData = {
    sku: document.getElementById("sku").value.trim(),
    productName: document.getElementById("productName").value.trim(),
    description: document.getElementById("description").value.trim(),
    bagPrice: parseFloat(document.getElementById("bagPrice").value) || 0,
    streamerPrice:
      parseFloat(document.getElementById("streamerPrice").value) || 0,
    boxPrice: parseFloat(document.getElementById("boxPrice").value) || 0,
    ctnPrice: parseFloat(document.getElementById("ctnPrice").value) || 0,
    middleUnit: document.getElementById("middleUnit").value,
  };

  // Validation
  if (!productData.sku || !productData.productName) {
    showError("SKU and Product Name are required");
    return;
  }
  if (
    productData.bagPrice < 0 ||
    productData.streamerPrice < 0 ||
    productData.boxPrice < 0 ||
    productData.ctnPrice < 0
  ) {
    showError("Prices cannot be negative");
    return;
  }

  try {
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productData),
    });

    const result = await response.json();

    if (result.success) {
      showSuccess("Product added successfully!");
      document.getElementById("productForm").reset();
      loadProducts();
    } else {
      showError(result.message || "Failed to add product");
    }
  } catch (error) {
    showError("Error adding product: " + error.message);
  }
}

// Open edit modal
function openEditModal(productId) {
  const product = allProducts.find((p) => String(p.id) === String(productId));
  document.getElementById("editStreamerPrice").value = 0;
  document.getElementById("editStreamerPrice").parentElement.style.display = 'block';
  if (!product) {
    showError("Product not found");
    return;
  }

  document.getElementById("editProductId").value = product.id;
  document.getElementById("editProductName").value = product.product_name;
  document.getElementById("editDescription").value = product.description || "";

  // ✅ MATCH EDIT FORM
  document.getElementById("editBagPrice").value = product.bag_price || 0;
  if (product.streamer_price == 0){
    document.getElementById("editStreamerPrice").parentElement.style.display = 'none';
  }else{
    document.getElementById("editStreamerPrice").value = product.streamer_price || 0;
  }
  document.getElementById("editBoxLabel").textContent =
    `${product.middle_unit.charAt(0) + product.middle_unit.slice(1).toLowerCase()} Price ($)`;
  document.getElementById("editBoxPrice").value = product.box_price || 0;
  document.getElementById("editCtnPrice").value = product.ctn_price || 0;
  document.getElementById("editModal").classList.add("active");
}

// Close edit modal
function closeEditModal() {
  document.getElementById("editModal").classList.remove("active");
}

// Handle edit product form submission
async function handleEditProduct(e) {
  e.preventDefault();

  const productId = document.getElementById("editProductId").value;

  const productData = {
    productName: document.getElementById("editProductName").value.trim(),
    description: document.getElementById("editDescription").value.trim(),

    // ✅ MATCH EDIT INPUTS
    bagPrice: parseFloat(document.getElementById("editBagPrice").value) || 0,
    streamerPrice:
      parseFloat(document.getElementById("editStreamerPrice").value) || 0,
    boxPrice: parseFloat(document.getElementById("editBoxPrice").value) || 0,
    ctnPrice: parseFloat(document.getElementById("editCtnPrice").value) || 0,
  };

  if (!productData.productName) {
    showError("Product Name is required");
    return;
  }

  if (
    productData.bagPrice < 0 ||
    productData.streamerPrice < 0 ||
    productData.boxPrice < 0 ||
    productData.ctnPrice < 0
  ) {
    showError("Prices cannot be negative");
    return;
  }

  try {
    const response = await fetch(`/api/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productData),
    });

    const result = await response.json();

    if (result.success) {
      showSuccess("Product updated successfully!");
      closeEditModal();
      loadProducts();
    } else {
      showError(result.message || "Failed to update product");
    }
  } catch (error) {
    showError("Error updating product: " + error.message);
  }
}

// Delete product
async function deleteProduct(productId) {
  if (!confirm("Are you sure you want to delete this product?")) {
    return;
  }

  try {
    const response = await fetch(`/api/products/${productId}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.success) {
      showSuccess("Product deleted successfully!");
      loadProducts();
    } else {
      showError(result.message || "Failed to delete product");
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    showError("Error deleting product: " + error.message);
  }
}

// Show success message
function showSuccess(message) {
  const msgDiv = document.getElementById("successMsg");
  msgDiv.textContent = message;
  msgDiv.style.display = "block";

  setTimeout(() => {
    msgDiv.style.display = "none";
  }, 3000);
}

// Show error message
function showError(message) {
  const msgDiv = document.getElementById("errorMsg");
  msgDiv.textContent = message;
  msgDiv.style.display = "block";

  setTimeout(() => {
    msgDiv.style.display = "none";
  }, 3000);
}

// Close modal when clicking outside
window.addEventListener("click", function (event) {
  const modal = document.getElementById("editModal");
  if (event.target === modal) {
    closeEditModal();
  }
});
