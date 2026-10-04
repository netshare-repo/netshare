import express from "express";
import {
  getProducts,
  getProductById,
  createMarketplaceOrder,
  getMyOrders,
  getAdminProducts,
  createProduct,
  updateProduct,
  getAllMarketplaceOrders,
  updateOrderStatus,
} from "../controllers/marketplaceController.js";

import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// USER / NODE PARTICIPANT / CLIENT ROUTES
router.get(
  "/products",
  protect,
  getProducts
);

router.get(
  "/products/:id",
  protect,
  getProductById
);

router.post(
  "/orders",
  protect,
  allowRoles("node_participant", "platform_client", "both"),
  createMarketplaceOrder
);

router.get(
  "/my-orders",
  protect,
  allowRoles("node_participant", "platform_client", "both"),
  getMyOrders
);

// ADMIN ROUTES
router.get(
  "/admin/products",
  protect,
  allowRoles("admin"),
  getAdminProducts
);

router.post(
  "/admin/products",
  protect,
  allowRoles("admin"),
  createProduct
);

router.put(
  "/admin/products/:id",
  protect,
  allowRoles("admin"),
  updateProduct
);

router.get(
  "/admin/orders",
  protect,
  allowRoles("admin"),
  getAllMarketplaceOrders
);

router.put(
  "/admin/orders/:id/status",
  protect,
  allowRoles("admin"),
  updateOrderStatus
);

export default router;