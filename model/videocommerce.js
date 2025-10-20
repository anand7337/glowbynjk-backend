const mongoose = require('mongoose');

const productSliderSchema = new mongoose.Schema({
  productname: { type: String, required: true },
  title: { type: String, required: true },
  priceone: { type: String, required: true },
  pricetwo: { type: String },
  productvideo: { type: String }, 
}, { timestamps: true });

module.exports = mongoose.model('Videocommerce', productSliderSchema);
