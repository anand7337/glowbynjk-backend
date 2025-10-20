// controllers/orderController.js
const Order = require('../model/Order.js')
const User = require('../model/userLogin.js')
const { sendOrderEmail , sendShippingEmail, sendDeliveredEmail, sendCancelledEmail} = require("../utils/sendEmail.js");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const querystring = require("querystring");
const { encryptCCA, decryptCCA } = require("../utils/ccavenue");
const Address = require("../model/userAddress.js");
const Cart = require('../model/cart.js')
const { Client, LocalAuth, MessageMedia } =  require("whatsapp-web.js");
const QRCode = require("qrcode");
const path = require("path")
const fs = require("fs")
const cron = require("node-cron");



const dotenv = require('dotenv')
dotenv.config();
const winston = require('winston')



const workingKey = process.env.CCAVENUE_WORKING_KEY;
const accessCode = process.env.CCAVENUE_ACCESS_CODE;
const merchantId = process.env.CCAVENUE_MERCHANT_ID;
const redirectUrl = process.env.CCAVENUE_REDIRECT_URL; // Your callback URL

// let client = null;
// let latestQR = null;
// let isClientReady = false;

//message limit start//


let client;
let latestQR = null;
let isClientReady = false;

// 🧠 Winston Logger Setup (File + Console)
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "whatsapp.log" }),
  ],
});

// 🧹 Clear Old Session (on Auth Fail / Logout)
const clearSession = (clientId = "bot1") => {
  const authPath = path.join(process.cwd(), "tokens", clientId);
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log(`🗑️ Old session for ${clientId} cleared`);
  }
};



// 🚀 Initialize WhatsApp Client
const createClient = () => {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: "bot1" }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", (qr) => {
    latestQR = qr;
    logger.info("📱 New WhatsApp QR generated!");
  });

client.on("ready", () => {
  isClientReady = true;
  console.log("✅ WhatsApp client is ready!");
});
client.on("disconnected", () => console.log("⚠️ Client disconnected"));
client.on("auth_failure", () => console.log("❌ Auth failure"));


  client.on("disconnected", async (reason) => {
    logger.warn(`⚠️ WhatsApp disconnected: ${reason}`);
    latestQR = null;
    isClientReady = false;
    try {
      await client.destroy();
    } catch {}
    clearSession("bot1");
    setTimeout(createClient, 3000);
  });

  client.on("auth_failure", async (msg) => {
    logger.error("❌ Auth failure:", msg);
    latestQR = null;
    isClientReady = false;
    try {
      await client.destroy();
    } catch {}
    clearSession("bot1");
    setTimeout(createClient, 3000);
  });

  client.initialize();
};

// 🟢 Start Immediately
createClient();

// 🧾 API: Get QR Code for Scanning
 const getQR = async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (!latestQR && !isClientReady) {
    return res.json({ ready: false, qr: "pending" });
  }

  if (!latestQR) return res.json({ ready: isClientReady, qr: null });

  try {
    const qrImage = await QRCode.toDataURL(latestQR, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 250,
      margin: 1,
    });
    res.json({ ready: isClientReady, qr: qrImage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 📱 API: Get WhatsApp Client Info
 const getClientInfo = async (req, res) => {
  if (!client || !isClientReady) {
    return res.status(400).json({ message: "Client not ready" });
  }

  try {
    const info = client.info;
    res.json({
      pushname: info.pushname,
      phoneNumber: info.me.user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔒 API: Logout WhatsApp and Reset QR
const logoutWhatsApp = async (req, res) => {
  try {
    console.log("🚪 Attempting WhatsApp logout...");

    if (client) {
      try {
        // Force WhatsApp session logout
        await client.logout();
        console.log("✅ client.logout() success");
      } catch (logoutErr) {
        console.warn("⚠️ client.logout() failed:", logoutErr.message);
      }

      try {
        await client.destroy();
        console.log("✅ client.destroy() success");
      } catch (destroyErr) {
        console.warn("⚠️ client.destroy() failed:", destroyErr.message);
      }
    }

    // Wait a second for Puppeteer to fully close
    await new Promise((r) => setTimeout(r, 1000));

    // Clear session folder
    clearSession("bot1");

    // Reset variables
    client = null;
    latestQR = null;
    isClientReady = false;

    // Reinitialize client
    setTimeout(() => createClient(), 1500);

    return res.status(200).json({
      success: true,
      message: "✅ WhatsApp logged out successfully. QR will regenerate.",
    });
  } catch (err) {
    console.error("❌ Logout failed:", err);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
      error: err.message,
    });
  }
};





//message end//
// 🧹 Helper to clear old session

// const clearSession = (clientId = "bot1") => {
//   const authPath = path.join(process.cwd(), "tokens", clientId);
//   if (fs.existsSync(authPath)) {
//     fs.rmSync(authPath, { recursive: true, force: true });
//     console.log("🗑️ Old session cleared");
//   }
// };

// // 🚀 Initialize WhatsApp Client
// const createClient = () => {
//   client = new Client({
//     authStrategy: new LocalAuth({ clientId: "bot1" }),
//     puppeteer: {
//       headless: true,
//       args: [
//         "--no-sandbox",
//         "--disable-setuid-sandbox",
//         "--disable-dev-shm-usage",
//         "--disable-accelerated-2d-canvas",
//         "--no-first-run",
//         "--no-zygote",
//         "--single-process",
//         "--disable-gpu",
//       ],
//     },
     
//   });

//   client.on("qr", (qr) => {
//     latestQR = qr;
//     console.log("📱 New QR generated!");
//   });

//   client.on("ready", () => {
//     isClientReady = true;
//     console.log("✅ WhatsApp client is ready!");
//   });

//   client.on("disconnected", async (reason) => {
//     console.log("⚠️ Disconnected:", reason);
//     latestQR = null;
//     isClientReady = false;
//     try {
//       await client.destroy();
//     } catch {}
//     clearSession("bot1");
//     setTimeout(() => createClient(), 2000);
//   });

//   client.on("auth_failure", async (msg) => {
//     console.error("❌ Auth failure:", msg);
//     latestQR = null;
//     isClientReady = false;
//     try {
//       await client.destroy();
//     } catch {}
//     clearSession("bot1");
//     setTimeout(() => createClient(), 2000);
//   });

//   client.initialize();
// };

// // start immediately
// createClient();

// // 🧾 Controller: Get QR API
//  const getQR = async (req, res) => {
//   res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
//   res.setHeader("Pragma", "no-cache");
//   res.setHeader("Expires", "0");

//   if (!latestQR && !isClientReady) {
//     return res.json({ ready: false, qr: "pending" });
//   }

//   if (!latestQR) return res.json({ ready: isClientReady, qr: null });

//   try {
//     const qrImage = await QRCode.toDataURL(latestQR, {
//       errorCorrectionLevel: "H",
//       type: "image/png",
//       width: 250,
//       margin: 1,
//     });
//     res.json({ ready: isClientReady, qr: qrImage });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };


// const getClientInfo = async (req, res) => {
//   if (!client || !isClientReady) {
//     return res.status(400).json({ message: "Client not ready" });
//   }

//   try {
//     const info = await client.info; // contains user info
//     res.json({
//       pushname: info.pushname,        // e.g., "Admin Name"
//       phoneNumber: info.me.user,      // e.g., "919876543210"
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };


// // 🔒 Controller: Logout API
// const logoutWhatsApp = async (req, res) => {
//   if (!client) {
//     return res.status(400).json({ message: "WhatsApp client not initialized" });
//   }

//   try {
//     // Destroy client and clear session
//     await client.destroy();
//     client = null;
//     latestQR = null;
//     isClientReady = false;
//     clearSession("bot1");

//     // Immediately start new client to generate fresh QR
//     setTimeout(createClient, 500);

//     res.status(200).json({ message: "Logout successful. QR reset." });
//   } catch (err) {
//     console.error("❌ Logout error:", err);
//     res.status(500).json({ message: "Logout failed", error: err.message });
//   }
// };


// const placeOrder = async (req, res) => {
//   try {
//     const { userId, cartItems, totalAmount, paymentMethod, addressId } = req.body;

//     if (!userId || !cartItems || cartItems.length === 0 || !addressId) {
//       return res.status(400).json({ message: "Invalid order data" });
//     }
//      // Generate unique order number
//     // const datePart = new Date().toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
//     const randomPart = Math.floor(1000 + Math.random() * 9000); // 4-digit random
//     const orderNumber = `ORD-${randomPart}`;

//     // ✅ Create new order
//     const order = new Order({
//       userId,
//       addressId,
//       cartItems,
//       totalAmount,
//       paymentMethod,
//       orderNumber
//     });

//     await order.save();

//     // ✅ Add reward points
//     const pointsEarned = Math.floor(totalAmount / 1000) * 10;
//     if (pointsEarned > 0) {
//       await User.findByIdAndUpdate(userId, {
//         $inc: { rewardPoints: pointsEarned }
//       });
//     }
//     res.status(201).json({
//       message: "Order placed successfully",
//       order,
//       pointsEarned
//     });
//   } catch (error) {
//     console.error("Error placing order:", error);
//     res.status(500).json({ message: "Order placement failed" });
//   }
// };

// ✅ Get all orders for a user
 const generateInvoiceNumber = async () => {
  // Find the latest order sorted by creation date descending
  const latestOrder = await Order.findOne().sort({ createdAt: -1 }).exec();

  if (!latestOrder || !latestOrder.invoiceNumber) {
    return "INV001GL"; // first order
  }

  // Extract the numeric part from the latest invoice
  const latestNumber = parseInt(latestOrder.invoiceNumber.match(/\d+/)[0], 10);
  const newNumber = latestNumber + 1;

  // Pad number to 3 digits
  const paddedNumber = String(newNumber).padStart(3, "0");
  return `INV${paddedNumber}GL`;
};

//main-frontend
// const placeOrder = async (req, res) => {
//   try {
//     const { userId, cartItems, totalAmount, paymentMethod, addressId, address, discountAmount,giftUsedAmount,rewardPoints } = req.body;

//     if (!cartItems || cartItems.length === 0) {
//       return res.status(400).json({ message: "No items in cart" });
//     }

//     // Generate order number
//     const randomPart = Math.floor(1000 + Math.random() * 9000);
//     // const orderNumber = `ORD-${randomPart}`;
//     const orderNumber = `${randomPart}`;
  
//     // Generate unique invoice number
//     const invoiceNumber = await generateInvoiceNumber();

//     // Prepare order data
//     const orderData = {
//       cartItems,
//       totalAmount,
//       paymentMethod,
//       orderNumber,
//       invoiceNumber,
//       discountAmount,
//       giftUsedAmount,
//       rewardPoints
//     };

//     if (userId && addressId) {
//       // Logged-in user
//       orderData.userId = userId;
//       orderData.addressId = addressId;
//     } else if (address) {
//       // Guest checkout
//       orderData.guestAddress = address; // store full address directly
//     } else {
//       return res.status(400).json({ message: "Address data missing" });
//     }

//     // ✅ Create order
//     const order = new Order(orderData);
//     await order.save();

//     // ✅ Reward points only for logged-in users
//     let pointsEarned = 0;
//     if (userId) {
//       pointsEarned = Math.floor(totalAmount / 1000) * 10;
//       if (pointsEarned > 0) {
//         await User.findByIdAndUpdate(userId, { $inc: { rewardPoints: pointsEarned } });
//       }
//     }

//     res.status(201).json({
//       message: "Order placed successfully",
//       order,
//       pointsEarned,
//     });
//   } catch (error) {
//     console.error("Error placing order:", error);
//     res.status(500).json({ message: "Order placement failed" });
//   }
// };




const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order
const createRazorpayOrder = async (req, res) => {
  try {
    const { totalAmount } = req.body;
    if (!totalAmount) return res.status(400).json({ message: "Amount required" });

    const options = {
      amount: totalAmount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create Razorpay order" });
  }
};
// Verify payment & place order
const placeOrderAfterPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      cartItems,
      totalAmount,
      paymentMethod,
      addressId,
      address,
      discountAmount,
      giftUsedAmount,
      rewardPoints
    } = req.body;

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    if (!cartItems || cartItems.length === 0) return res.status(400).json({ message: "No items in cart" });

    const orderNumber = `${Math.floor(1000 + Math.random() * 9000)}`;
    const invoiceNumber = await generateInvoiceNumber();

    const orderData = {
      cartItems,
      totalAmount,
      paymentMethod,
      orderNumber,
      invoiceNumber,
      paymentId: razorpay_payment_id,
      discountAmount,
      giftUsedAmount,
      rewardPoints
    };

    let customerEmail = "";

    if (userId && addressId) {
      orderData.userId = userId;
      orderData.addressId = addressId;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      customerEmail = user.email;

      // Reward points
      // const pointsEarned = Math.floor(totalAmount / 1000) * 10;
      // if (pointsEarned > 0) {
      //   await User.findByIdAndUpdate(userId, { $inc: { rewardPoints: pointsEarned } });
      // }


      // === REDEEM POINTS LOGIC ===
  const pointsNeededToRedeem = 10000;
  const redeemValue = 500; // rupees
  let amountToRedeem = 0;

  if (rewardPoints && user.rewardPoints >= pointsNeededToRedeem) {
    const pointsPerRupee = redeemValue / pointsNeededToRedeem;
    amountToRedeem = Math.floor(user.rewardPoints * pointsPerRupee);

    // Reset user points after redemption
    user.rewardPoints = 0;
    await user.save();

    console.log(`Redeemed ₹${amountToRedeem} for user ${user.email}`);
  }

  // === EARN POINTS LOGIC ===
  const pointsEarned = Math.floor(totalAmount / 1000) * 10;
  if (pointsEarned > 0) {
    await User.findByIdAndUpdate(userId, { $inc: { rewardPoints: pointsEarned } });
  }


      // Clear cart in DB after successful order
      user.cart = [];
      await user.save();

    } else if (address) {
      orderData.guestAddress = address;
      customerEmail = address.billing?.email || "";
    } else {
      return res.status(400).json({ message: "Address data missing" });
    }

    const order = new Order(orderData);
    await order.save();

    if (customerEmail) {
      sendOrderEmail(customerEmail, order)
        .then(() => console.log("Order email sent"))
        .catch(err => console.error("Failed to send order email:", err));
    }

    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    console.error("Order placement error:", error);
    res.status(500).json({ message: "Order placement failed" });
  }
};

//ccavenue start//
   


function encryptCCAVenue(plainText) {
  const key = crypto.createHash("md5").update(workingKey).digest();
  const iv = Buffer.from([
    0x00, 0x01, 0x02, 0x03,
    0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b,
    0x0c, 0x0d, 0x0e, 0x0f
  ]);
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decryptCCAVenue(encText) {
  const key = crypto.createHash("md5").update(workingKey).digest();
  const iv = Buffer.from([
    0x00, 0x01, 0x02, 0x03,
    0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b,
    0x0c, 0x0d, 0x0e, 0x0f
  ]);
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  let decrypted = decipher.update(encText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

//
// =========================================================
// ✅ 1. PLACE ORDER — Generate encrypted data for CCAvenue
// =========================================================

 const placeOrderAfterCCAvenue = async (req, res) => {
  try {
    const {
      userId,
      addressId,
      guestAddress,
      cartItems,
      totalAmount,
      paymentMethod,
      discountAmount,
      giftUsedAmount,
      rewardPoints
    } = req.body;

    // ✅ Generate unique order number
    const orderNumber = `${Math.floor(1000 + Math.random() * 9000)}`;
    const redirectUrl = `${process.env.BACKEND_URL}/api/ccav-response`; 
    const cancelUrl = `${process.env.BACKEND_URL}/api/ccav-response`;

    // ----------------------------------------
    // 1️⃣ Prepare billing & shipping details
    // ----------------------------------------
    let billing = {};
    let shipping = {};

    if (userId && addressId) {
      const userAddress = await Address.findById(addressId);
      if (!userAddress)
        return res.status(400).json({ message: "Address not found" });

      billing = userAddress.billing || {};
      shipping =
        userAddress.shipToDifferentAddress && userAddress.shipping
          ? userAddress.shipping
          : billing;
    } else if (guestAddress) {
      billing = guestAddress.billing || {};
      shipping =
        guestAddress.shipToDifferentAddress && guestAddress.shipping
          ? guestAddress.shipping
          : billing;
    } else {
      return res.status(400).json({ message: "Address information missing" });
    }

    // ----------------------------------------
    // 2️⃣ Encode merchant_param1 as Base64 JSON
    // ----------------------------------------
    const merchantData = {
      userId,
      addressId,
      guestAddress,
      cartItems,
      totalAmount,
      paymentMethod,
      discountAmount,
      giftUsedAmount,
      rewardPoints,
      orderNumber
    };
    const merchant_param1 = Buffer.from(
      JSON.stringify(merchantData)
    ).toString("base64");

    // ----------------------------------------
    // 3️⃣ Prepare full CCAvenue data
    // ----------------------------------------
    const ccavData = {
      merchant_id: process.env.CCAVENUE_MERCHANT_ID,
      order_id: orderNumber,
      currency: "INR",
      amount: totalAmount.toFixed(2),
      redirect_url: redirectUrl,
      cancel_url: cancelUrl,
      language: "EN",
      merchant_param1: merchant_param1,

      // Billing info
      billing_name: `${billing.firstName || ""} ${billing.lastName || ""}`.trim(),
      billing_address: [billing.streetAddress, billing.apartment]
        .filter(Boolean)
        .join(", "),
      billing_city: billing.city || "",
      billing_state: billing.state || "",
      billing_zip: billing.pincode || "",
      billing_country: "India",
      billing_tel: billing.phone || "",
      billing_email: billing.email || "",

      // Shipping info
      delivery_name: `${shipping.firstName || ""} ${shipping.lastName || ""}`.trim(),
      delivery_address: [shipping.streetAddress, shipping.apartment]
        .filter(Boolean)
        .join(", "),
      delivery_city: shipping.city || "",
      delivery_state: shipping.state || "",
      delivery_zip: shipping.pincode || "",
      delivery_country: "India",
      delivery_tel: shipping.phone || billing.phone || "",
      delivery_email: shipping.email || billing.email || ""
    };

    // ----------------------------------------
    // 4️⃣ Encrypt data with AES
    // ----------------------------------------
    const plainText = Object.entries(ccavData)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const encRequest = encryptCCAVenue(plainText);

    // ----------------------------------------
    // 5️⃣ Send encrypted response to frontend
    // ----------------------------------------
    return res.status(200).json({
      success: true,
      orderId: orderNumber,
      encRequest, // 🔑 frontend uses this for hidden input
      accessCode: process.env.CCAVENUE_ACCESS_CODE // From .env
    });
  } catch (error) {
    console.error("CCAvenue Checkout Init Error:", error);
    res.status(500).json({ message: "Failed to initialize CCAvenue payment" });
  }
};

//
// =========================================================
// ✅ 2. RESPONSE HANDLER — CCAvenue callback
// =========================================================


//maiin

// const ccavResponse = async (req, res) => {
//   try {
//     const encResp = req.body.encResp;
//     const decrypted = decryptCCAVenue(encResp);
//     const response = Object.fromEntries(decrypted.split("&").map(p => p.split("=")));
//     const paymentStatusRaw = response.order_status; // Success / Failure / Aborted
//     const paymentId = response.tracking_id || response.bank_ref_no || null;
//     const orderNumber = Math.floor(1000 + Math.random() * 9000);

//     // Decode merchant_param1
//     let meta = {};
//     try {
//       const decoded = Buffer.from(response.merchant_param1, "base64").toString("utf8");
//       meta = JSON.parse(decoded);
//     } catch (err) {
//       console.error("❌ merchant_param1 JSON parse failed:", err);
//     }

//     // Map CCAvenue status to our enums
//     const paymentStatusMap = { Success: "Success", Failure: "Failed", Aborted: "Cancelled" };
//     const paymentStatus = paymentStatusMap[paymentStatusRaw] || "Pending";
//     const orderStatusMap = { Success: "Processing", Failed: "Pending", Cancelled: "Cancelled" };
//     const status = orderStatusMap[paymentStatus] || "Pending";

//     // Save order in DB
//     const newOrder = new Order({
//       orderNumber,
//       invoiceNumber: await generateInvoiceNumber(),
//       userId: meta.userId || null,
//       addressId: meta.addressId || null,
//       guestAddress: meta.guestAddress || null,
//       cartItems: meta.cartItems || [],
//       totalAmount: meta.totalAmount || 0,
//       paymentMethod: meta.paymentMethod || "CCAvenue",
//       discountAmount: meta.discountAmount || 0,
//       giftUsedAmount: meta.giftUsedAmount || 0,
//       rewardPoints: meta.rewardPoints || 0,
//       paymentStatus,
//       paymentId,
//       paymentDetails: response,
//       status
//     });

//    const order =  await newOrder.save();
//     console.log(`✅ Order saved: ${newOrder._id}, paymentStatus: ${paymentStatus}, status: ${status}`);

//         let customerEmail = "";

//  if (meta.userId) {
//   const user = await User.findById(meta.userId);
//   if (user) {
//      customerEmail = user.email;
//     // === REDEEM POINTS LOGIC ===
//     const pointsNeededToRedeem = 10000;
//     const redeemValue = 500; // rupees
//     let amountToRedeem = 0;

//     // Use actual user's current points
//     if (user.rewardPoints >= pointsNeededToRedeem) {
//       const pointsPerRupee = redeemValue / pointsNeededToRedeem;
//       amountToRedeem = Math.floor(user.rewardPoints * pointsPerRupee);

//       // Reset points after redemption
//       user.rewardPoints = 0;
//       await user.save();
//       console.log(`Redeemed ₹${amountToRedeem} for user ${user.email}`);
//     }

    

//     // === EARN POINTS LOGIC ===
//     const pointsEarned = Math.floor(meta.totalAmount / 1000) * 10;
//     if (pointsEarned > 0) {
//       user.rewardPoints += pointsEarned;
//       await user.save();
//       console.log(`Earned ${pointsEarned} points for user ${user.email}`);
//     }

//  // ✅ Clear Cart in Cart collection
//     await Cart.findOneAndUpdate(
//       { userId: meta.userId },
//       { $set: { items: [] } }
//     );
//     console.log(`✅ Cleared cart for user ${user.email}`);
//   }
// }



//  // ✅ Send custom email only if payment success
//     if (paymentStatus === "Success" && customerEmail) {
//       try {
//         // Generate invoice PDF
//         await sendOrderEmail(customerEmail, order);
//         console.log(`📧 Invoice email sent to ${customerEmail}`);
//       } catch (emailErr) {
//         console.error("❌ Error sending invoice email:", emailErr);
//       }
//     }


//         // ✅ Redirect user to frontend based on payment status
//     const FRONTEND_URL = process.env.CLIENT_URL || "http://localhost:5175";
//     if (paymentStatus === "Success") {
//       return res.redirect(`${FRONTEND_URL}/payment-success?order=${newOrder.orderNumber}`);
//     } else {
//       return res.redirect(`${FRONTEND_URL}/payment-failed?order=${newOrder.orderNumber}`);
//     }
//     // return res.status(200).send("Order processed successfully");
//   } catch (error) {
//     console.error("CCAvenue Callback Error:", error);
//     res.status(500).send("Error processing CCAvenue response");
//         return res.redirect(`${FRONTEND_URL}/payment-failed`);
//   }
// };
const whatsappsend = async (req, res) => {
try {
    const { phone, orderId, invoiceNumber, cartItems, totalPrice } = req.body;

    if (!phone || !/^\d{10,15}$/.test(phone)) {
      return res.status(400).json({ success: false, error: "Valid phone number required." });
    }

    if (!orderId || !invoiceNumber || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid order details." });
    }

    if (!isClientReady) {
      return res.status(503).json({ success: false, error: "WhatsApp client not ready." });
    }

    const chatId = `${phone}@c.us`;

    const headerMsg = `
📦 *Your Order Has Been Placed Successfully!*
🧾 *Invoice No:* ${invoiceNumber}
🆔 *Order ID:* ${orderId}
🛍️ *Total Items:* ${cartItems.length}
💰 *Total Amount:* ₹${totalPrice}
────────────────────
`;

    await client.sendMessage(chatId, headerMsg);

    for (const item of cartItems) {
      const caption = `
🛒 *${item.title}*
💵 Price: ₹${item.price}
📦 Qty: ${item.quantity}
`;

      if (item.image) {
        try {
          const media = await MessageMedia.fromUrl(item.image);
          await client.sendMessage(chatId, media, { caption });
        } catch (err) {
          console.error(`⚠️ Failed to send image for ${item.title}:`, err.message);
          await client.sendMessage(chatId, caption + "\n⚠️ (Image not available)");
        }
      } else {
        await client.sendMessage(chatId, caption);
      }
    }

    const trackingUrl = `https://glowbynjk.com/order-tracking/`;
    const footerMsg = `
🎉 *Thank you for your order!*
You can track your order status here 👇
🔗 ${trackingUrl}

Team *Glowbynjk* 🌸
`;

    await client.sendMessage(chatId, footerMsg);

    res.json({
      success: true,
      sent_to: phone,
      message: "Order details with tracking link sent successfully!"
    });

  } catch (error) {
    console.error("❌ Error sending order message:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

const ccavResponse = async (req, res) => {
  try {
    const encResp = req.body.encResp;
    const decrypted = decryptCCAVenue(encResp);

    // ===== Parse CCAvenue response =====
    const response = Object.fromEntries(
      decrypted.split("&").map(p => p.split("="))
    );
    const paymentStatusRaw = response.order_status; // Success / Failure / Aborted
    const paymentId = response.tracking_id || response.bank_ref_no || null;
    // const orderNumber = Math.floor(1000 + Math.random() * 9000);
    
    // ===== Decode merchant_param1 =====
    let meta = {};
    try {
      const decoded = Buffer.from(response.merchant_param1, "base64").toString("utf8");
      meta = JSON.parse(decoded);
    } catch (err) {
      console.error("❌ merchant_param1 JSON parse failed:", err);
    }

    // ===== Normalize payment status =====
    const paymentStatusMap = { Success: "Success", Failure: "Failed", Aborted: "Cancelled" };
    const paymentStatus = paymentStatusMap[paymentStatusRaw] || "Pending";

    const orderStatusMap = { Success: "Processing", Failed: "Pending", Cancelled: "Cancelled" };
    const status = orderStatusMap[paymentStatus] || "Pending";

    // ===== CREATE ORDER =====
    const newOrder = new Order({
       orderNumber : meta.orderNumber, 
      invoiceNumber: await generateInvoiceNumber(),
      userId: meta.userId || null,
      addressId: meta.addressId || null,
      guestAddress: meta.guestAddress || null,
      cartItems: meta.cartItems || [],
      totalAmount: meta.totalAmount || 0,
      paymentMethod: meta.paymentMethod || "CCAvenue",
      discountAmount: meta.discountAmount || 0,
      giftUsedAmount: meta.giftUsedAmount || 0,
      rewardPoints: meta.rewardPoints || 0,
      paymentStatus,
      paymentId,
      paymentDetails: response,
      status
    });

    const savedOrder = await newOrder.save();
    console.log(`✅ Order saved: ${savedOrder._id}, paymentStatus: ${paymentStatus}, status: ${status}`);

    // ===== Admin dashboard notification via Socket.IO =====
    const io = req.app.get("io");
    io.emit("newOrder", {
      orderNumber: savedOrder.orderNumber,
      invoiceNumber: savedOrder.invoiceNumber,
      totalAmount: savedOrder.totalAmount,
      paymentStatus,
      userId: savedOrder.userId,
      createdAt: savedOrder.createdAt,
    });

    // ===== BILLING & SHIPPING =====
    let billing = {};
    let shipping = {};

    // 1️⃣ Logged-in user
    if (savedOrder.addressId) {
      const address = await Address.findById(savedOrder.addressId).lean();
      if (address) {
        billing = { ...(address.billing || {}) };
        shipping = { ...(address.shipping || billing) }; // fallback
      }
    }

    // 2️⃣ Guest user fallback (only if empty)
    if (savedOrder.guestAddress) {
      const guest = savedOrder.guestAddress;
      if (!billing || Object.keys(billing).length === 0) {
        billing = { ...(guest.billing || {}) };
      }
      if (!shipping || Object.keys(shipping).length === 0) {
        shipping = { ...(guest.shipping || billing) }; // fallback
      }
    }

    billing = billing || {};
    shipping = shipping || {};

    // Merge into order for PDF/email
    const order = { ...savedOrder.toObject(), billing, shipping };

    console.log("Billing Address:", billing);
    console.log("Shipping Address:", shipping);

    // ===== CUSTOMER EMAIL =====
    let customerEmail = "";
    if (savedOrder.userId) {
      const user = await User.findById(savedOrder.userId);
      if (user) customerEmail = user.email || "";
    } else if (savedOrder.guestAddress) {
      customerEmail = billing.email || shipping.email || "";
    }

    // ===== SEND EMAIL =====
    if (paymentStatus === "Success" && customerEmail) {
      try {
        await sendOrderEmail(customerEmail, order);
        console.log(`📧 Invoice email sent to ${customerEmail}`);
      } catch (emailErr) {
        console.error("❌ Error sending invoice email:", emailErr);
      }
    } else {
      console.warn("⚠️ Skipping email — missing customer email or payment not successful");
    }

    // ===== REWARD POINTS & CART CLEAR =====
    if (savedOrder.userId) {
      const user = await User.findById(savedOrder.userId);
      if (user) {
        // Redeem points
        const pointsNeededToRedeem = 10000;
        const redeemValue = 500; // rupees
        if (user.rewardPoints >= pointsNeededToRedeem) {
          const pointsPerRupee = redeemValue / pointsNeededToRedeem;
          const amountToRedeem = Math.floor(user.rewardPoints * pointsPerRupee);
          user.rewardPoints = 0;
          await user.save();
          console.log(`Redeemed ₹${amountToRedeem} for ${user.email}`);
        }

        // Earn points
        const pointsEarned = Math.floor(savedOrder.totalAmount / 1000) * 10;
        if (pointsEarned > 0) {
          user.rewardPoints += pointsEarned;
          await user.save();
          console.log(`Earned ${pointsEarned} points for ${user.email}`);
        }

        // Clear cart
   await Cart.findOneAndUpdate(
  { userId: savedOrder.userId },
  {
    $set: {
      items: [],        // clear all cart items
      phone: "",        // clear phone number
      email: ""         // clear email
    }
  }
);

        // await Cart.findOneAndUpdate({ userId: savedOrder.userId }, { $set: { items: [] } });
        console.log(`✅ Cleared cart for ${user.email}`);
      }
    }


// ===== WHATSAPP ORDER MESSAGE =====


try {
  if ( client && isClientReady) {
    const phone = meta.phone || billing.phone || shipping.phone;

    if (phone) {
      let cleanedPhone = phone.replace(/\D/g, ""); // remove all non-digit characters

// If number already starts with "91" and has 12 digits, keep it
if (cleanedPhone.startsWith("91") && cleanedPhone.length === 12) {
  cleanedPhone = cleanedPhone;
}
// If number has only 10 digits, add "91" prefix
else if (cleanedPhone.length === 10) {
  cleanedPhone = "91" + cleanedPhone;
}
// (Optional) Handle unexpected formats
else {
  console.error("Invalid phone number format:", phone);
}

const chatId = `${cleanedPhone}@c.us`;

      const cartItems = meta.cartItems || [];

      // 🧾 Header Message
      const headerMsg = `
📦 *Your Order Has Been Placed Successfully!*
🧾 *Invoice No:* ${savedOrder.invoiceNumber}
🆔 *Order ID:* ${savedOrder.orderNumber}
🛍️ *Total Items:* ${cartItems.length}
💰 *Total Amount:* ₹${savedOrder.totalAmount}
────────────────────
`;

      await client.sendMessage(chatId, headerMsg.trim());

      // 🛒 Send each cart item
      for (const item of cartItems) {
        const caption = `
🛒 *${item.title}*
💵 Price: ₹${item.price}
📦 Qty: ${item.quantity}
`;
console.log("Sending image URL:", item.image);

        if (item.image) {
const baseUrl = process.env.BACKEND_URL; // or your live domain
const imageUrl = `${item.image}`; 

try {
  const media = await MessageMedia.fromUrl(imageUrl);
  await client.sendMessage(chatId, media, { caption: caption.trim() });
} catch (err) {
  console.error(`⚠️ Failed to send image for ${item.title}:`, err.message);
  await client.sendMessage(chatId, caption.trim() + "\n⚠️ (Image not available)");
}
        } else {
          await client.sendMessage(chatId, caption.trim());
        }
      }

      // 🔗 Footer message with tracking link
      const trackingUrl = process.env.TRACKING_URL;
      const footerMsg = `
🎉 *Thank you for your order!*
You can track your order status here 👇
🔗 ${trackingUrl}

Team *Glowbynjk* 🌸
`;
      await client.sendMessage(chatId, footerMsg.trim());
      console.log(`✅ WhatsApp order message sent to ${phone}`);
    } else {
      console.warn("⚠️ No phone number found for WhatsApp message");
    }
  } else {
    console.warn("⚠️ WhatsApp client not ready or payment not successful");
  }
} catch (whatsappErr) {
  console.error("❌ Error sending WhatsApp message:", whatsappErr);
}




// try {
//     if (!client || !isClientReady) {
//       logger.warn("⚠️ WhatsApp client not ready or payment not successful");
//       return;
//     }

//     const phone = meta.phone || billing.phone || shipping.phone;
//     if (!phone) {
//       logger.warn("⚠️ No phone number found for WhatsApp message");
//       return;
//     }

//     let cleanedPhone = phone.replace(/\D/g, "");
//     if (cleanedPhone.startsWith("91") && cleanedPhone.length === 12) {
//       cleanedPhone = cleanedPhone;
//     } else if (cleanedPhone.length === 10) {
//       cleanedPhone = "91" + cleanedPhone;
//     } else {
//       logger.error("❌ Invalid phone number format:", phone);
//       return;
//     }

//     const chatId = `${cleanedPhone}@c.us`;
//     const cartItems = meta.cartItems || [];

//     // 🧾 Header Message
//     const headerMsg = `
// 📦 *Your Order Has Been Placed Successfully!*
// 🧾 *Invoice No:* ${savedOrder.invoiceNumber}
// 🆔 *Order ID:* ${savedOrder.orderNumber}
// 🛍️ *Total Items:* ${cartItems.length}
// 💰 *Total Amount:* ₹${savedOrder.totalAmount}
// ────────────────────
// `.trim();

//     await client.sendMessage(chatId, headerMsg);

//     // 🛒 Send Each Cart Item
//     const baseUrl = process.env.BACKEND_URL;
//     for (const item of cartItems) {
//       const caption = `
// 🛒 *${item.title}*
// 💵 Price: ₹${item.price}
// 📦 Qty: ${item.quantity}
// `.trim();

//       if (item.image) {
//         const imageUrl = `${baseUrl}/products/${item.image}`;
//         try {
//           const media = await MessageMedia.fromUrl(imageUrl);
//           await client.sendMessage(chatId, media, { caption });
//         } catch (err) {
//           logger.error(`⚠️ Failed to send image for ${item.title}: ${err.message}`);
//           await client.sendMessage(chatId, caption + "\n⚠️ (Image not available)");
//         }
//       } else {
//         await client.sendMessage(chatId, caption);
//       }
//     }

//     // 🔗 Footer Message
//     const trackingUrl = process.env.TRACKING_URL;
//     const footerMsg = `
// 🎉 *Thank you for your order!*
// You can track your order status here 👇
// 🔗 ${trackingUrl}

// Team *Glowbynjk* 🌸
// `.trim();

//     await client.sendMessage(chatId, footerMsg);
//     logger.info(`✅ WhatsApp order message sent to ${phone}`);
//   } catch (whatsappErr) {
//     logger.error("❌ Error sending WhatsApp message:", whatsappErr);
//   }





    // ===== REDIRECT =====
 
 
 
    const FRONTEND_URL = process.env.CLIENT_URL;
    return res.redirect(
      paymentStatus === "Success"
        ? `${FRONTEND_URL}/payment-success?order=${savedOrder.orderNumber}`
        : `${FRONTEND_URL}/payment-failed?order=${savedOrder.orderNumber}`
    );

  } catch (err) {
    console.error("CCAvenue Callback Error:", err);
    const FRONTEND_URL = process.env.CLIENT_URL;
    return res.redirect(`${FRONTEND_URL}/payment-failed`);
  }
};









// Place order & prepare CCAvenue
//  const placeOrderAfterCCAvenue = async (req, res) => {
//   try {
//     const {
//       userId,
//       addressId,
//       address,
//       cartItems,
//       totalAmount,
//       paymentMethod,
//       discountAmount,
//       giftUsedAmount,
//       rewardPoints,
//     } = req.body;

//     const orderNumber = `ORD${Date.now()}`;
//     const invoiceNumber = `INV${Date.now()}GL`;

//     // Save order in DB
//     const order = new Order({
//       userId: userId || null,
//       addressId: addressId || null,
//       guestAddress: !userId ? address : null,
//       cartItems,
//       totalAmount,
//       paymentMethod,
//       discountAmount: discountAmount || 0,
//       giftUsedAmount: giftUsedAmount || 0,
//       rewardPoints: rewardPoints || 0,
//       orderNumber,
//       invoiceNumber,
//       paymentStatus: "Pending",
//       createdAt: new Date(),
//     });
//     await order.save();

//     // Flatten billing & shipping
//     const billing = address?.billing || {};
//     const shipping =
//       address?.shipToDifferentAddress && address?.shipping
//         ? {
//             firstName: address.shipping.firstName || "",
//             lastName: address.shipping.lastName || "",
//             streetAddress: address.shipping.streetAddress || "",
//             apartment: address.shipping.apartment || "",
//             city: address.shipping.city || "",
//             state: address.shipping.state || "",
//             pincode: address.shipping.pincode || "",
//           }
//         : {
//             firstName: billing.firstName || "",
//             lastName: billing.lastName || "",
//             streetAddress: billing.streetAddress || "",
//             apartment: billing.apartment || "",
//             city: billing.city || "",
//             state: billing.state || "",
//             pincode: billing.pincode || "",
//           };

//     // Prepare CCAvenue payload
//     const ccavData = {
//       merchant_id: process.env.CCAVENUE_MERCHANT_ID,
//       order_id: orderNumber,
//       currency: "INR",
//       amount: totalAmount.toFixed(2),
//       redirect_url: redirectUrl,
//       cancel_url: redirectUrl,
//       language: "EN",

//       // Billing
//       billing_name: `${billing.firstName || ""} ${billing.lastName || ""}`,
//       billing_address:
//         billing.streetAddress + (billing.apartment ? ", " + billing.apartment : ""),
//       billing_city: billing.city || "",
//       billing_state: billing.state || "",
//       billing_zip: billing.pincode || "",
//       billing_country: "India",
//       billing_tel: billing.phone || "",
//       billing_email: billing.email || "",

//       // Shipping
//       shipping_name: `${shipping.firstName} ${shipping.lastName}`,
//       shipping_address:
//         shipping.streetAddress + (shipping.apartment ? ", " + shipping.apartment : ""),
//       shipping_city: shipping.city,
//       shipping_state: shipping.state,
//       shipping_zip: shipping.pincode,
//       shipping_country: "India",
//     };

//     // Convert to key=value&key=value format
//     const plainText = Object.entries(ccavData)
//       .map(([k, v]) => `${k}=${v}`)
//       .join("&");

//     const encRequest = encryptCCAVenue(plainText);

//     res.status(200).json({ encRequest, accessCode, orderId: order._id });
//   } catch (err) {
//     console.error("Place Order CCAvenue Error:", err);
//     res.status(500).json({ message: "Failed to create CCAvenue order" });
//   }
// };






// Place Order + Generate CCAvenue EncRequest
//  const placeOrderAfterCCAvenue = async (req, res) => {
//   try {
//     const {
//       userId,
//       addressId,
//       address,
//       cartItems,
//       totalAmount,
//       paymentMethod,
//       discountAmount,
//       giftUsedAmount,
//       rewardPoints
//     } = req.body;

//     const redirectUrl = `http://localhost:5175`; // Your frontend success/fail URL

//     // Generate unique order & invoice numbers
//     const orderNumber = `ORD${Date.now()}`;
//     const invoiceNumber = `INV${Date.now()}GL`;

//     // Save order in DB
//     const orderData = {
//       userId: userId || null,
//       addressId: addressId || null,
//       guestAddress: !userId ? address : null,
//       cartItems,
//       totalAmount,
//       paymentMethod,
//       discountAmount: discountAmount || 0,
//       giftUsedAmount: giftUsedAmount || 0,
//       rewardPoints: rewardPoints || 0,
//       orderNumber,
//       invoiceNumber,
//       paymentStatus: "Pending",
//       createdAt: new Date()
//     };

//     const order = new Order(orderData);
//     await order.save();

//     // Determine billing & shipping addresses
//     const billing = (address?.billing) || (address?.guestAddress?.billing) || {};
//     const shipping = (address?.shipToDifferentAddress && address?.shipping && Object.keys(address.shipping).length > 0)
//       ? address.shipping
//       : (address?.guestAddress?.shipToDifferentAddress && address?.guestAddress?.shipping && Object.keys(address.guestAddress.shipping || {}).length > 0)
//         ? address.guestAddress.shipping
//         : billing;

//     // Prepare CCAvenue payload (use delivery_* for shipping)
//     const ccavData = {
//       merchant_id: process.env.CCAVENUE_MERCHANT_ID,
//       order_id: orderNumber,
//       currency: "INR",
//       amount: totalAmount.toFixed(2),
//       redirect_url: redirectUrl,
//       cancel_url: redirectUrl,
//       language: "EN",

//       // Billing
//       billing_name: `${billing.firstName || ""} ${billing.lastName || ""}`.trim(),
//       billing_address: [billing.streetAddress, billing.apartment].filter(Boolean).join(", "),
//       billing_city: billing.city || "",
//       billing_state: billing.state || "",
//       billing_zip: billing.pincode || "",
//       billing_country: "India",
//       billing_tel: billing.phone || "",
//       billing_email: billing.email || "",

//       // Shipping (delivery_*)
//       delivery_name: `${shipping.firstName || ""} ${shipping.lastName || ""}`.trim(),
//       delivery_address: [shipping.streetAddress, shipping.apartment].filter(Boolean).join(", "),
//       delivery_city: shipping.city || "",
//       delivery_state: shipping.state || "",
//       delivery_zip: shipping.pincode || "",
//       delivery_country: "India",
//       delivery_tel: shipping.phone || billing.phone || "",
//       delivery_email: shipping.email || billing.email || ""
//     };

//     // Convert to key=value format and encrypt
//     const plainText = Object.entries(ccavData).map(([k, v]) => `${k}=${v}`).join("&");
//     const encRequest = encryptCCAVenue(plainText);

//     res.status(200).json({
//       encRequest,
//       accessCode: process.env.CCAVENUE_ACCESS_CODE,
//       orderId: order._id,
//       orderNumber
//     });

//   } catch (err) {
//     console.error("Place Order CCAvenue Error:", err);
//     res.status(500).json({ message: "Failed to create CCAvenue order" });
//   }
// };




//end//

const placeOrder = async (req, res) => {
  try {
    const { userId, cartItems, totalAmount, paymentMethod, addressId, address, discountAmount, giftUsedAmount, rewardPoints } = req.body;

    if (!cartItems || cartItems.length === 0)
      return res.status(400).json({ message: "No items in cart" });

    const orderNumber = `${Math.floor(1000 + Math.random() * 9000)}`;
    const invoiceNumber = await generateInvoiceNumber();

    const orderData = {
      cartItems,
      totalAmount,
      paymentMethod,
      orderNumber,
      invoiceNumber,
      discountAmount,
      giftUsedAmount,
      rewardPoints
    };

    let customerEmail = "";

    if (userId && addressId) {
      orderData.userId = userId;
      orderData.addressId = addressId;

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      customerEmail = user.email;

      // Reward points
      if (totalAmount) {
        const pointsEarned = Math.floor(totalAmount / 1000) * 10;
        if (pointsEarned > 0)
          await User.findByIdAndUpdate(userId, { $inc: { rewardPoints: pointsEarned } });
      }

    } else if (address) {
      orderData.guestAddress = address;
      customerEmail = address.billing?.email || "";
    } else {
      return res.status(400).json({ message: "Address data missing" });
    }

    const order = new Order(orderData);
    await order.save();

    // ✅ Send email asynchronously (does NOT block response)
    if (customerEmail) {
      sendOrderEmail(customerEmail, order)
        .then(() => console.log("Order email sent"))
        .catch(err => console.error("Failed to send order email:", err));
    }

    // Respond immediately
    res.status(201).json({ message: "Order placed successfully", order });

  } catch (error) {
    console.error("Order placement error:", error);
    res.status(500).json({ message: "Order placement failed" });
  }
};



const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};


// ✅ Get all orders (for admin)
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId", "name email")   // Populate user info
      .populate("addressId")              // Populate address if saved
      .sort({ createdAt: -1 });           // Latest orders first

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};


// ✅ Get single order details
// ✅ This works if you send the _id
const getSingleOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("cartItems.productId")
      .populate("userId", "firstName email phone") // only return selected fields
      .populate("addressId"); // full address document
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ message: "Failed to fetch order" });
  }
};


// ✅ Update order status (for admin use)
//  const updateOrderStatus = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { status } = req.body;
//     const order = await Order.findByIdAndUpdate(
//       orderId,
//       { status },
//       { new: true }
//     );
//     res.json({ message: "Order status updated", order });
//   } catch (error) {
//     console.error("Error updating order status:", error);
//     res.status(500).json({ message: "Failed to update order status" });
//   }
// };

// ✅ Admin: Update order status, estimated delivery, and shipping details main-admin
// const updateOrderStatus = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { status, estimatedDelivery, shippingProvider, shippingPhone } = req.body;

//     const updateFields = {};
//     if (status) updateFields.status = status;
//     if (estimatedDelivery) updateFields.estimatedDelivery = new Date(estimatedDelivery);
//     if (shippingProvider) updateFields.shippingProvider = shippingProvider;
//     if (shippingPhone) updateFields.shippingPhone = shippingPhone;

//     const order = await Order.findByIdAndUpdate(orderId, updateFields, { new: true });

//     if (!order) return res.status(404).json({ message: "Order not found" });

//     res.json({ message: "Order updated successfully", order });
//   } catch (error) {
//     console.error("Error updating order:", error);
//     res.status(500).json({ message: "Failed to update order" });
//   }
// };


  
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, estimatedDelivery, shippingProvider, shippingPhone } = req.body;

    const updateFields = {};
    if (status) updateFields.status = status;
    if (estimatedDelivery) updateFields.estimatedDelivery = new Date(estimatedDelivery);
    if (shippingProvider) updateFields.shippingProvider = shippingProvider;
    if (shippingPhone) updateFields.shippingPhone = shippingPhone;

    const order = await Order.findByIdAndUpdate(orderId, updateFields, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });

    let customerEmail = "";
    if (order.userId) {
      const user = await User.findById(order.userId);
      customerEmail = user?.email;
    } else if (order.guestAddress) {
      customerEmail = order.guestAddress.billing?.email || "";
    }

    if (customerEmail) {
      // Send emails asynchronously (do not block response)
      if (status === "Shipped" && !order.shippingEmailSent) {
        sendShippingEmail(customerEmail, order)
          .then(() => console.log("Shipping email sent"))
          .catch(err => console.error("Shipping email error:", err));

        order.shippingEmailSent = true;
      }

      if (status === "Delivered" && !order.deliveredEmailSent) {
        sendDeliveredEmail(customerEmail, order)
          .then(() => console.log("Delivered email sent"))
          .catch(err => console.error("Delivered email error:", err));

        order.deliveredEmailSent = true;
      }

      if (status === "Cancelled" && !order.cancelledEmailSent) {
        sendCancelledEmail(customerEmail, order)
          .then(() => console.log("Cancelled email sent"))
          .catch(err => console.error("Cancelled email error:", err));

        order.cancelledEmailSent = true;
      }

      // Save updated email flags without waiting for email sending
      await order.save();
    }

    res.json({ message: "Order updated successfully", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update order" });
  }
};






// DELETE a single order by ID
const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find and delete the order
    const deletedOrder = await Order.findByIdAndDelete(orderId);

    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order deleted successfully", order: deletedOrder });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Failed to delete order" });
  }
};



//  const trackOrder = async (req, res) => {
//   try {
//     const { orderNumber, email, userId } = req.method === "POST" ? req.body : req.query;

//     if (!orderNumber) {
//       return res.status(400).json({ message: "Order number required" });
//     }

//     let query = { orderNumber };

//     if (userId) {
//       query.userId = userId;
//     } else if (email) {
//       query["guestAddress.billing.email"] = email;
//     }

//     const order = await Order.findOne(query).populate("cartItems.productId");

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     res.json(order);
//   } catch (error) {
//     console.error("Error tracking order:", error);
//     res.status(500).json({ message: "Failed to fetch order" });
//   }
// };

// const trackOrder = async (req, res) => {
//   try {
//     const { orderNumber, email, userId, addressId } = req.method === "POST" ? req.body : req.query;

//     if (!orderNumber) {
//       return res.status(400).json({ message: "Order number required" });
//     }

//     let query = { orderNumber };

//     if (userId) {
//       // Logged-in user: use userId (and optionally addressId if provided)
//       query.userId = userId;
//       if (addressId) {
//         query.addressId = addressId;
//       }
//     } else if (email) {
//       // Guest user: match by guest billing email
//       query["guestAddress.billing.email"] = email;
//     } else {
//       return res.status(400).json({ message: "Email or User ID required" });
//     }

//     const order = await Order.findOne(query).populate("cartItems.productId");

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     res.json(order);
//   } catch (error) {
//     console.error("Error tracking order:", error);
//     res.status(500).json({ message: "Failed to fetch order" });
//   }
// };

const trackOrder = async (req, res) => {
  try {
    const { orderNumber, email } = req.body;

    if (!orderNumber || !email) {
      return res.status(400).json({ message: "Order number and email are required" });
    }

    // Find order by orderNumber
    const order = await Order.findOne({ orderNumber }).populate("userId", "email");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ✅ Verify email (either guestAddress.billing.email OR user email)
    const orderEmail =
      order.guestAddress?.billing?.email ||
      order.userId?.email;

    if (!orderEmail || orderEmail.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ message: "Email does not match this order" });
    }

    return res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      cartItems: order.cartItems,
      createdAt: order.createdAt,
    });
  } catch (err) {
    console.error("Track Order Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const orderGetId = async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate("cartItems.productId"); 

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
}





// cron.schedule("* * * * *", async () => {
  cron.schedule("0 */10 * * *", async () => {
  console.log("🕕 Running WhatsApp cart reminder job...");

  if (!isClientReady) {
    console.log("❌ WhatsApp client not ready, skipping reminder job.");
    return;
  }
 
  try {
      // 📅 Calculate 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 1);
    const activeCarts = await Cart.find({
      items: { $exists: true, $not: { $size: 0 } },
      phone: { $exists: true, $ne: "" },
      // reminderSent: false, // ✅ only send once
      $or: [
        { reminderSent: false },
        { reminderSent: { $exists: false } } // handle older carts
      ],
      createdAt: { $gte: threeDaysAgo }  // only carts created within last 3 days
    });

      if (!activeCarts.length) {
      console.log("ℹ️ No carts found with items in the last 3 days.");
      return;
    }
    
    for (const cart of activeCarts) {
      let cleanedPhone = cart.phone.toString().replace(/\D/g, ""); // remove non-digits

      // ✅ Normalize number format
      if (cleanedPhone.startsWith("91") && cleanedPhone.length === 12) {
        // already correct
      } else if (cleanedPhone.length === 10) {
        cleanedPhone = "91" + cleanedPhone; // add +91
      } else {
        console.log(`⚠️ Skipping invalid phone: ${cart.phone}`);
        continue; // skip invalid numbers
      }

      const chatId = `${cleanedPhone}@c.us`;
      const cartItems = cart.items;
      const totalPrice = cartItems.reduce((sum, i) => sum + (i.prices * i.quantity), 0);

      // Header message
      const headerMsg = `
🛍️ *You left items in your cart!*
Don't miss out — complete your purchase now at *Glowbynjk* 🌸
────────────────────
🧾 *Items in your cart:* ${cartItems.length}
💰 *Total Amount:* ₹${totalPrice}
────────────────────
`;
      await client.sendMessage(chatId, headerMsg);

      // Send each product (image + details)
      for (const item of cartItems) {
        const caption = `
✨ *${item.title || item.productName}*
📦 ${item.netQuantity}
💵 ₹${item.prices}
🛒 Qty: ${item.quantity}
`;
       const baseUrl = process.env.BACKEND_URL; // or your live domain
        const imageUrl = item.images && item.images[0]
          ? `${item.images[0]}`
          : null;

        if (imageUrl) {
          try {
            const media = await MessageMedia.fromUrl(imageUrl);
            await client.sendMessage(chatId, media, { caption });
          } catch (err) {
            console.error(`⚠️ Failed to send image for ${item.title}:`, err.message);
            await client.sendMessage(chatId, caption + "\n⚠️ (Image not available)");
          }
        } else {
          await client.sendMessage(chatId, caption);
        }
      }

      // Footer
      const footerMsg = `
🕒 Your cart is waiting!
Tap below to complete your purchase now 👇
🔗 ${process.env.FRONTENDSHOP_URL}

💖 Team *Glowbynjk*
`;

      await client.sendMessage(chatId, footerMsg);
      console.log(`✅ Cart reminder sent to ${cleanedPhone}`);

         // 🟢 Mark reminder as sent
      await Cart.updateOne(
        { _id: cart._id },
        { $set: { reminderSent: true, reminderSentAt: new Date() } }
      );
    }

  } catch (error) {
    console.error("❌ Error sending cart reminder:", error);
  }
  });


module.exports = {getClientInfo,logoutWhatsApp,whatsappsend,getQR,ccavResponse,placeOrderAfterCCAvenue,placeOrder,orderGetId,trackOrder,placeOrderAfterPayment,createRazorpayOrder, getUserOrders, getSingleOrder, updateOrderStatus, getAllOrders, deleteOrder }