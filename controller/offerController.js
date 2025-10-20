const Offer = require('../model/offer.js');

// ===============================
// Create Offer
// ===============================
const createOffer = async (req, res) => {
  try {
    const { title, productName, content } = req.body;
    const bannerImages = req.files?.bannerImages?.map(file => file.path) || [];
    const logo = req.files?.logo?.[0]?.path || null;
    const productImage = req.files?.productImage?.[0]?.path || null;

    const newOffer = new Offer({
      title,
      productName,
      content,
      bannerImages,
      logo,
      productImage
    });

    await newOffer.save();
    res.status(201).json({ success: true, data: newOffer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===============================
// Get All Offers
// ===============================
const getOffers = async (req, res) => {
  try {
    const offers = await Offer.find();
    res.json({ success: true, data: offers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===============================
// Update Offer
// ===============================
const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, productName, content } = req.body;

    // handle new files if uploaded
    const bannerImages = req.files?.bannerImages?.map(file => file.path);
    const logo = req.files?.logo?.[0]?.path;
    const productImage = req.files?.productImage?.[0]?.path;

    // build update object
    const updateData = { title, productName, content };
    if (bannerImages && bannerImages.length > 0) updateData.bannerImages = bannerImages;
    if (logo) updateData.logo = logo;
    if (productImage) updateData.productImage = productImage;

    const updatedOffer = await Offer.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedOffer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    res.json({ success: true, data: updatedOffer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===============================
// Delete Offer
// ===============================
const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOffer = await Offer.findByIdAndDelete(id);

    if (!deletedOffer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    res.json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOffer,
  getOffers,
  updateOffer,
  deleteOffer
};
