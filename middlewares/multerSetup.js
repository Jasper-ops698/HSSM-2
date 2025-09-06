const multer = require('multer');

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save the images in the 'uploads' folder
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.mimetype.split('/')[1]); // E.g., image-161617384.jpg
  }
});

// Set up file filter for image files
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|gif/;
  const isValidFile = allowedFileTypes.test(file.mimetype);
  if (isValidFile) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Set up file filter for document files (PDF, DOC, DOCX, etc.)
const documentFileFilter = (req, file, cb) => {
  const allowedFileTypes = /pdf|doc|docx|txt|rtf/;
  const isValidFile = allowedFileTypes.test(file.mimetype) || allowedFileTypes.test(file.originalname.split('.').pop());
  if (isValidFile) {
    cb(null, true);
  } else {
    cb(new Error('Only document files (PDF, DOC, DOCX, TXT, RTF) are allowed!'), false);
  }
};

// Set up upload middleware with file size limit and filter
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max file size 5MB
});

// Set up document upload middleware
const uploadDocument = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max file size 10MB for documents
});

module.exports = upload;
module.exports.uploadDocument = uploadDocument;
