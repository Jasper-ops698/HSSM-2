const mongoose = require('mongoose');
const Request = require('../models/Request');
const Service = require('../models/Service');
const sendFCMNotification = require('./firebase'); // Assuming this is for notifications

/**
 * Create a new service request
 */
exports.createRequest = async (req, res) => {
  try {
    const { serviceType, date, time, description, location, attachments } = req.body;

    if (!serviceType || !date || !time || !description || !location) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Retrieve the user's contact information from the database
    const userProfile = req.user;
    const contact = userProfile.phone || userProfile.email;

    // Save the request to the database
    const newRequest = new Request({
      user: req.user._id,  // Assuming the user is authenticated
      serviceType,
      date,
      time,
      description,
      location,
      contact,
      attachments
    });

    await newRequest.save();

    // Optionally send a notification to a service provider
    const serviceProviderToken = ''; // Fetch provider token from your DB (you need to implement this)
    const notificationMessage = {
      notification: {
        title: 'New Service Request',
        body: `You have a new service request for ${serviceType}`,
      },
      token: serviceProviderToken,
    };

    await sendFCMNotification(notificationMessage);

    res.status(201).json({ message: 'Service request created successfully', newRequest });
  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({ message: 'Error creating service request', error: error.message });
  }
};

/**
 * Get all requests for the logged-in user
 */
exports.getUserRequests = async (req, res) => {
  try {
    const requests = await Request.find({ user: req.user._id })
      .populate('user', 'name email phone')
      .select('serviceType date time location contact status attachments createdAt');

    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching user requests:', error);
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
};

/**
 * Update the status of a request
 */
exports.updateRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const request = await Request.findById(id);

    if (!request) return res.status(404).json({ message: 'Request not found' });

    // Verify if the current user is authorized to update the request
    if (request.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to update this request' });
    }

    request.status = status;
    await request.save();

    res.status(200).json(request);
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ message: 'Error updating request', error: error.message });
  }
};

/**
 * Add an image to an existing request
 */
exports.addImageToRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const request = await Request.findById(id);

    if (!request) return res.status(404).json({ message: 'Request not found' });

    // Verify if the current user is authorized to modify the request
    if (request.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to modify this request' });
    }

    // Handle file upload for the image
    if (req.file) {
      // Get the full URL for the image (assuming you are using local storage)
      const imageURL = `${req.protocol}://${req.get('host')}/uploads/${req.file.path}`;
      
      // Add the image URL to the attachments array
      request.attachments.push(imageURL);
    } else {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    await request.save();

    res.status(200).json({ message: 'Image added to request successfully', request });
  } catch (error) {
    console.error('Error adding image to request:', error);
    res.status(500).json({ message: 'Error adding image to request', error: error.message });
  }
};

/**
 * Get all requests for the service provider
 */
exports.getProviderRequests = async (req, res) => {
  try {
    const services = await Service.find({ provider: req.user._id }).select('_id name');
    const serviceIds = services.map((service) => service._id);

    const requests = await Request.find({ serviceType: { $in: serviceIds } })
      .populate('user', 'name email')
      .select('serviceType date time location contact status attachments createdAt');

    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching provider requests:', error);
    res.status(500).json({ message: 'Error fetching provider requests', error: error.message });
  }
};

/**
 * Submit a review for a service request
 */
exports.submitReview = async (req, res) => {
  try {
    const { review, rating } = req.body;
    const requestId = req.params.id;

    if (!review || !rating) {
      return res.status(400).json({ message: 'Review and rating are required.' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    }

    // Find the request by ID
    const request = await Request.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    // Update the review, rating, and status to completed
    request.review = review;
    request.rating = rating;
    request.status = 'completed';
    request.completedAt = Date.now();

    await request.save();

    // Fetch the service provider's token from DB
    const serviceProviderToken = await getServiceProviderToken(request.serviceType); // Implement this to get the token

    const notificationMessage = {
      notification: {
        title: 'Service Request Completed',
        body: `A review has been submitted for your completed service request.`,
      },
      token: serviceProviderToken,
    };

    // Call your FCM service to send the notification
    await sendFCMNotification(notificationMessage);

    res.status(200).json({ message: 'Review submitted successfully', request });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ message: 'Error submitting review', error: error.message });
  }
};
