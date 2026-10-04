import MarketplaceProduct from "../models/MarketplaceProduct.js";
import MarketplaceOrder from "../models/MarketplaceOrder.js";
import AdminLog from "../models/AdminLog.js";
import { deductCredits, addCredits } from "../services/walletService.js";

// ============================
// USER / NODE PARTICIPANT APIs
// ============================

// GET /api/marketplace/products
export const getProducts = async (req, res) => {
  try {
    const { search, category } = req.query;
    const query = { status: "active", stock: { $gt: 0 } };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (category) {
      query.category = category;
    }

    const products = await MarketplaceProduct.find(query).sort({ createdAt: -1 });

    return res.json({ products });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch marketplace products",
      error: error.message,
    });
  }
};

// GET /api/marketplace/products/:id
export const getProductById = async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    return res.json({ product });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// POST /api/marketplace/orders
export const createMarketplaceOrder = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        message: "productId is required",
      });
    }

    const product = await MarketplaceProduct.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    if (product.status !== "active") {
      return res.status(400).json({
        message: "Product is not available",
      });
    }

    if (product.stock <= 0) {
      return res.status(400).json({
        message: "Product is out of stock",
      });
    }

    await deductCredits({
      userId: req.user._id,
      taskId: null,
      amount: product.requiredCredits,
      description: `Marketplace purchase: ${product.name}`,
    });

    const order = await MarketplaceOrder.create({
      userId: req.user._id,
      productId: product._id,
      productName: product.name,
      creditsSpent: product.requiredCredits,
      status: "pending",
    });

    product.stock -= 1;
    await product.save();

    return res.status(201).json({
      message: "Marketplace order created successfully",
      order,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Marketplace order failed",
      error: error.message,
    });
  }
};

// GET /api/marketplace/my-orders
export const getMyOrders = async (req, res) => {
  try {
    const orders = await MarketplaceOrder.find({
      userId: req.user._id,
    })
      .populate("productId")
      .sort({ createdAt: -1 });

    return res.json({ orders });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch marketplace orders",
      error: error.message,
    });
  }
};

// ============================
// ADMIN APIs
// ============================

// GET /api/marketplace/admin/products
export const getAdminProducts = async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (category) {
      query.category = category;
    }
    if (status) {
      query.status = status;
    }

    const products = await MarketplaceProduct.find(query).sort({ createdAt: -1 });

    return res.json({ products });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch admin marketplace products",
      error: error.message,
    });
  }
};

// POST /api/marketplace/admin/products
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      requiredCredits,
      imageUrl,
      stock,
      status,
    } = req.body;

    if (!name || !description || !requiredCredits) {
      return res.status(400).json({
        message: "name, description and requiredCredits are required",
      });
    }

    const product = await MarketplaceProduct.create({
      name,
      description,
      category,
      requiredCredits,
      imageUrl,
      stock,
      status,
    });

    await AdminLog.create({
      adminId: req.user._id,
      action: "CREATE_MARKETPLACE_PRODUCT",
      details: `Admin created marketplace product: ${product.name}`,
      targetType: "system",
      targetId: product._id,
    });

    return res.status(201).json({
      message: "Marketplace product created successfully",
      product,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create marketplace product",
      error: error.message,
    });
  }
};

// PUT /api/marketplace/admin/products/:id
export const updateProduct = async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const {
      name,
      description,
      category,
      requiredCredits,
      imageUrl,
      stock,
      status,
    } = req.body;

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (category !== undefined) product.category = category;
    if (requiredCredits !== undefined)
      product.requiredCredits = requiredCredits;
    if (imageUrl !== undefined) product.imageUrl = imageUrl;
    if (stock !== undefined) product.stock = stock;
    if (status !== undefined) product.status = status;

    await product.save();

    await AdminLog.create({
      adminId: req.user._id,
      action: "UPDATE_MARKETPLACE_PRODUCT",
      details: `Admin updated marketplace product: ${product.name}`,
      targetType: "system",
      targetId: product._id,
    });

    return res.json({
      message: "Marketplace product updated successfully",
      product,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update marketplace product",
      error: error.message,
    });
  }
};

// GET /api/marketplace/admin/orders
export const getAllMarketplaceOrders = async (req, res) => {
  try {
    const { status, userId, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (userId) query.userId = userId;
    
    // Simplistic search just by order id if search is provided
    if (search && search.length === 24) {
       query._id = search;
    }

    const orders = await MarketplaceOrder.find(query)
      .populate("userId", "name email role")
      .populate("productId")
      .populate("fulfilledBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({ orders });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch marketplace orders",
      error: error.message,
    });
  }
};

// PUT /api/marketplace/admin/orders/:id/status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, fulfilmentNote } = req.body;

    const allowedStatus = ["pending", "fulfilled", "cancelled", "rejected"];

    if (!status || !allowedStatus.includes(status)) {
      return res.status(400).json({
        message: "Valid status is required",
      });
    }

    const order = await MarketplaceOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Marketplace order not found",
      });
    }

    order.status = status;
    order.fulfilmentNote = fulfilmentNote || order.fulfilmentNote;

    if (status === "fulfilled") {
      order.fulfilledBy = req.user._id;
      order.fulfilledAt = new Date();
    } else if (status === "cancelled" || status === "rejected") {
      // Process refund only once
      if (!order.refundedAt) {
        const wallet = await addCredits({
          userId: order.userId,
          amount: order.creditsSpent,
          description: `Refund for marketplace order ${order._id} (${status})`,
        });
        
        order.refundedAt = new Date();
        order.refundedCredits = order.creditsSpent;
        // Ideally we'd grab the newly created transaction ID here, 
        // but addCredits doesn't return it currently. We can just set it to null or fetch it.
        // We'll leave refundTransactionId empty since walletService handles the creation.
      }
    }

    await order.save();

    await AdminLog.create({
      adminId: req.user._id,
      action: "UPDATE_MARKETPLACE_ORDER",
      details: `Admin updated marketplace order ${order._id} to ${status}`,
      targetType: "system",
      targetId: order._id,
    });

    return res.json({
      message: "Marketplace order status updated successfully",
      order,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update marketplace order status",
      error: error.message,
    });
  }
};