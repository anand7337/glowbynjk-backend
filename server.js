const express = require('express')
const app = express()
const path = require('path')    
const dotenv = require('dotenv') 
dotenv.config({path:path.join(__dirname,'config','.env')})
const PORT = process.env.PORT || 3000   
const banners = require('./routes/adminBanner')         
// import offerRoutes from "./routes/offerRoutes.js";  
const offerRoutes = require('./routes/offerRoutes.js')        
// JSON & urlencoded parsers for non-file requests  
app.use(express.json({ limit: "2mb" }));  
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
              
//////// 
const cors = require('cors')
const bodyParser = require("body-parser");
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5175",
      "https://glowbynjk.vercel.app", // Replace with your frontend URL
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(cors())


const database = require('./config/database')
database()
const morgan = require('morgan')
const productRoutes = require('./routes/productRoutes')
const userRoutes = require('./routes/userLogin')
const userCartRoutes = require('./routes/cart.js')  
const wishlistRoutes = require('./routes/userWishlist')
const blogRoutes = require('./routes/blog')
const productSliderRoutes = require('./routes/productSlider')
const VideocommerceRoutes = require('./routes/videocommerce.js')
const adminRoutes = require('./routes/adminLogin.js')
const promoRoutes = require('./routes/promo.js')
const addressRoutes = require('./routes/userAddress.js')
const smsUserRoutes = require('./routes/sendSMS.js')
const orderRoutes = require("./routes/orderRoutes.js");
const notificationRoutes = require('./routes/notificationRoutes.js')
const adminDashboard = require('./routes/adminDashboard.js')
const paymentRoutes = require("./routes/paymentRoutes");
const whatsappRoutes = require("./routes/whatsapp.js");
const metawhatsappRoutes = require("./routes/metaWhatsappRoutes.js");

app.use(express.static('public'))
// app.use('/banners', express.static(path.join(__dirname, 'public/banners')))
// app.use('/uploads', express.static('uploads'));
app.use(cors())
app.use(morgan('dev'))
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true })); // <-- important for CCAvenue POSTs
app.use(bodyParser.json());
// app.get("/api", async (req, res) => {
//   res.send("Hi I Am Anand");
// });

const io = new Server(server, {
  cors: { origin: "*" }, // adjust for your frontend
});

// Make io globally accessible (or via req.app)
app.set("io", io);

io.on("connection", (socket) => {
  console.log("🟢 Admin dashboard connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Admin dashboard disconnected:", socket.id);
  });
});

// API routes
app.use('/api',banners)
app.use("/api", offerRoutes);
app.use("/api", productRoutes);
app.use("/api", userRoutes)
app.use("/api", userCartRoutes);
app.use("/api", wishlistRoutes);
app.use('/api',blogRoutes);
app.use('/api',productSliderRoutes)
app.use('/api',VideocommerceRoutes)
app.use('/api',adminRoutes)
app.use('/api',promoRoutes)  
app.use('/api',addressRoutes ) 
app.use('/api', smsUserRoutes)
app.use('/api',orderRoutes)
app.use('/api',notificationRoutes)
app.use('/api',adminDashboard)
app.use("/api/payment", paymentRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api", metawhatsappRoutes);


setTimeout(() => {
  require("./controller/orderController"); // then load cron job
  console.log("✅ Cart reminder cron job loaded!");
}, 5000); //

server.listen(PORT,(err) => {
    console.log(`server running successfully ${PORT}`);
})
 
// let latestQR = null;
// let isClientReady = false;

// // Initialize WhatsApp Client
// const client = new Client({
//   authStrategy: new LocalAuth({ clientId: "bot1" }), // persistent session
//   puppeteer: {
//     headless: true,
//     args: [
//       '--no-sandbox',
//       '--disable-setuid-sandbox',
//       '--disable-dev-shm-usage',
//       '--disable-accelerated-2d-canvas',
//       '--no-first-run',
//       '--no-zygote',
//       '--single-process',
//       '--disable-gpu'
//     ],
//     timeout: 0 // disable timeout
//   }
// });

// // --- QR Code generation ---
// client.on('qr', qr => {
//   latestQR = qr;
//   console.log('📱 New QR generated!');
// });

// // --- WhatsApp client ready ---
// client.on('ready', () => {
//   isClientReady = true;
//   console.log('✅ WhatsApp bot ready!');
// });

// // --- Handle disconnections / crashes ---
// client.on("disconnected", (reason) => {
//   console.log("⚠️ WhatsApp disconnected:", reason);
//   latestQR = null;
//   isClientReady = false;
//   console.log("🔄 Reinitializing WhatsApp client...");
//   client.initialize(); // restart session
// });


// client.on('auth_failure', msg => {
//   console.error('❌ Auth failure:', msg);
//   client.initialize(); // try reconnect
// });






// app.post('/api/send-order', async (req, res) => {
//   try {
//     const { phone, orderId, invoiceNumber, cartItems, totalPrice } = req.body;

//     // 1️⃣ Validate input
//     if (!phone || !/^\d{10,15}$/.test(phone)) {
//       return res.status(400).json({
//         success: false,
//         error: "Valid phone number required (digits only, no + or spaces)."
//       });
//     }

//     if (!orderId || !invoiceNumber || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
//       return res.status(400).json({
//         success: false,
//         error: "Missing or invalid order details (orderId, invoiceNumber, cartItems)."
//       });
//     }

//     // 2️⃣ Check WhatsApp client
//     if (!isClientReady) {
//       return res.status(503).json({
//         success: false,
//         error: "WhatsApp client not ready yet. Please wait..."
//       });
//     }

//     const chatId = `${phone}@c.us`;

//     // 3️⃣ Header message
//     const headerMsg = `
// 📦 *Your Order Has Been Placed Successfully!*
// ────────────────────
// 🧾 *Invoice No:* ${invoiceNumber}
// 🆔 *Order ID:* ${orderId}
// 🛍️ *Total Items:* ${cartItems.length}
// 💰 *Total Amount:* ₹${totalPrice}
// ────────────────────
// `;

//     await client.sendMessage(chatId, headerMsg);

//     // 4️⃣ Loop through each product and send image + details
//     for (const item of cartItems) {
//       const caption = `
// 🛒 *${item.title}*
// 💵 Price: ₹${item.price}
// 📦 Qty: ${item.quantity}
// `;

//       if (item.image) {
//         try {
//           const media = await MessageMedia.fromUrl(item.image);
//           await client.sendMessage(chatId, media, { caption });
//         } catch (err) {
//           console.error(`⚠️ Failed to send image for ${item.title}:`, err.message);
//           await client.sendMessage(chatId, caption + "\n⚠️ (Image not available)");
//         }
//       } else {
//         await client.sendMessage(chatId, caption);
//       }
//     }

//     // 5️⃣ Add thank-you + tracking link
//     const trackingUrl = `https://glowbynjk.com/order-tracking/`;
//     const footerMsg = `
// ────────────────────
// 🎉 *Thank you for your order!*
// You can track your order status here 👇
// 🔗 ${trackingUrl}

// Team *Glowbynjk* 🌸
// `;

//     await client.sendMessage(chatId, footerMsg);

//     // 6️⃣ Response
//     res.json({
//       success: true,
//       sent_to: phone,
//       message: "Order details with tracking link sent successfully!"
//     });

//   } catch (error) {
//     console.error("❌ Error sending order message:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });



// // --- API to get QR code for frontend ---
// app.get('/api/qr', async (req, res) => {
//   if (!latestQR) return res.json({ ready: isClientReady, qr: null });

//   try {
//     const qrImage = await QRCode.toDataURL(latestQR);
//     res.json({ ready: isClientReady, qr: qrImage });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


// app.listen(PORT,(err) => {
//     console.log(`server running successfully ${PORT}`);
// })

// // --- Initialize WhatsApp client ---
// client.initialize();

// // --- Global error handling to avoid crashes ---
// process.on('unhandledRejection', (err) => {
//   console.error('Unhandled Rejection:', err);
//   client.initialize();
// });







// // --- Global variables ---
// let client = null;
// let latestQR = null;
// let isClientReady = false;

// // --- Helper: Clear old session folder ---
// const clearSession = (clientId = 'bot1') => {
//   const authPath = path.join(__dirname, 'tokens', clientId);
//   if (fs.existsSync(authPath)) {
//     fs.rmSync(authPath, { recursive: true, force: true });
//     console.log('🗑️ Old session cleared');
//   }
// };

// // --- Function to create and initialize WhatsApp client ---
// const createClient = () => {
//   client = new Client({
//     authStrategy: new LocalAuth({ clientId: "bot1" }),
//     puppeteer: {
//       headless: true,
//       args: [
//         '--no-sandbox',
//         '--disable-setuid-sandbox',
//         '--disable-dev-shm-usage',
//         '--disable-accelerated-2d-canvas',
//         '--no-first-run',
//         '--no-zygote',
//         '--single-process',
//         '--disable-gpu'
//       ],
//       timeout: 0
//     }
//   });

//   client.on('qr', qr => {
//     latestQR = qr;
//     console.log('📱 New QR generated!');
//   });

//   client.on('ready', () => {
//     isClientReady = true;
//     console.log('✅ WhatsApp bot ready!');
//   });

//   client.on('disconnected', async reason => {
//     console.log('⚠️ WhatsApp disconnected:', reason);
//     latestQR = null;
//     isClientReady = false;

//     try {
//       await client.destroy();
//     } catch (err) {
//       console.error('Error destroying client:', err.message);
//     }

//     clearSession('bot1');
//     setTimeout(() => createClient(), 1000);
//   });

//   client.on('auth_failure', async msg => {
//     console.error('❌ Auth failure:', msg);
//     latestQR = null;
//     isClientReady = false;

//     try {
//       await client.destroy();
//     } catch (err) {
//       console.error('Error destroying client:', err.message);
//     }

//     clearSession('bot1');
//     setTimeout(() => createClient(), 1000);
//   });

//   client.initialize();
// };

// // Start first client
// createClient();

// // --- API to get QR code ---
// app.get('/api/qr', async (req, res) => {
//   res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
//   res.setHeader('Pragma', 'no-cache');
//   res.setHeader('Expires', '0');

//   if (!latestQR && !isClientReady) {
//     return res.json({ ready: false, qr: "pending" });
//   }

//   if (!latestQR) return res.json({ ready: isClientReady, qr: null });

//   try {
//     const qrImage = await QRCode.toDataURL(latestQR, {
//       errorCorrectionLevel: 'H',
//       type: 'image/png',
//       width: 250,
//       margin: 1
//     });
//     res.json({ ready: isClientReady, qr: qrImage });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // --- Send Order API ---
// app.post('/api/send-order', async (req, res) => {
//   try {
//     const { phone, orderId, invoiceNumber, cartItems, totalPrice } = req.body;

//     if (!phone || !/^\d{10,15}$/.test(phone)) {
//       return res.status(400).json({ success: false, error: "Valid phone number required." });
//     }

//     if (!orderId || !invoiceNumber || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
//       return res.status(400).json({ success: false, error: "Invalid order details." });
//     }

//     if (!isClientReady) {
//       return res.status(503).json({ success: false, error: "WhatsApp client not ready." });
//     }

//     const chatId = `${phone}@c.us`;

//     const headerMsg = `
// 📦 *Your Order Has Been Placed Successfully!*
// 🧾 *Invoice No:* ${invoiceNumber}
// 🆔 *Order ID:* ${orderId}
// 🛍️ *Total Items:* ${cartItems.length}
// 💰 *Total Amount:* ₹${totalPrice}
// ────────────────────
// `;

//     await client.sendMessage(chatId, headerMsg);

//     for (const item of cartItems) {
//       const caption = `
// 🛒 *${item.title}*
// 💵 Price: ₹${item.price}
// 📦 Qty: ${item.quantity}
// `;

//       if (item.image) {
//         try {
//           const media = await MessageMedia.fromUrl(item.image);
//           await client.sendMessage(chatId, media, { caption });
//         } catch (err) {
//           console.error(`⚠️ Failed to send image for ${item.title}:`, err.message);
//           await client.sendMessage(chatId, caption + "\n⚠️ (Image not available)");
//         }
//       } else {
//         await client.sendMessage(chatId, caption);
//       }
//     }

//     const trackingUrl = `https://glowbynjk.com/order-tracking/`;
//     const footerMsg = `
// 🎉 *Thank you for your order!*
// You can track your order status here 👇
// 🔗 ${trackingUrl}

// Team *Glowbynjk* 🌸
// `;

//     await client.sendMessage(chatId, footerMsg);

//     res.json({
//       success: true,
//       sent_to: phone,
//       message: "Order details with tracking link sent successfully!"
//     });

//   } catch (error) {
//     console.error("❌ Error sending order message:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// // Global error handling
// process.on('unhandledRejection', (err) => {
//   console.error('Unhandled Rejection:', err);
//   try {
//     client && client.destroy();
//   } catch (_) {}
//   createClient();
// });




