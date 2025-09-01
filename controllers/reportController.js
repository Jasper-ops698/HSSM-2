const pandoc = require('node-pandoc');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GeneratedReport, Incident, Asset, Task, MeterReading, HospitalProfile } = require('../models/Hssm');

// @desc    Generate a new report using AI and save it
// @route   POST /api/reports/generate
// @access  Private/HSSM-provider
const generateReport = async (req, res) => {
    const { userId } = req.user;
    const { startDate, endDate, title } = req.body;

    if (!startDate || !endDate || !title) {
        return res.status(400).json({ message: 'Start date, end date, and title are required.' });
    }

    // 1. Create a new report with 'pending' status
    const newReport = new GeneratedReport({
        title,
        user: userId,
        status: 'pending',
    });

    try {
        await newReport.save();
        res.status(202).json(newReport); // 202 Accepted

        // 2. Start the generation process in the background
        generateReportInBackground(newReport._id, userId, startDate, endDate, title);

    } catch (error) {
        console.error('Error creating initial report:', error);
        // No response sent here as one might have already been sent.
        // If saving fails, the client won't get a 202, and will know something is wrong.
    }
};

const generateReportInBackground = async (reportId, userId, startDate, endDate, title) => {
    let report;
    try {
        // Set status to 'generating'
        await GeneratedReport.findByIdAndUpdate(reportId, { status: 'generating' });
        report = await GeneratedReport.findById(reportId);

        // Fetch data
        const profile = await HospitalProfile.findOne({ userId });
        const incidents = await Incident.find({ userId, date: { $gte: new Date(startDate), $lte: new Date(endDate) } });
        const assets = await Asset.find({ userId });
        const tasks = await Task.find({ userId, dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } });
        const meterReadings = await MeterReading.find({ userId, date: { $gte: new Date(startDate), $lte: new Date(endDate) } });

        // Construct prompt (using the enhanced version)
        const prompt = `
        Generate a markdown-formatted report for a PowerPoint presentation on Health Systems Support Management.
        The report should be structured with slides, titles, and bullet points, ready for presentation.
        Use fenced divs (:::) to specify slide layouts. Available layouts: 'Title', 'Title and Content', 'Section Header'.
        Include speaker notes for each slide inside a ':::' block with the class 'notes'.

        **Facility Profile:**
        - Mission: ${profile?.mission || 'Not set'}
        - Vision: ${profile?.vision || 'Not set'}
        - Service Charter: ${profile?.serviceCharter || 'Not set'}

        **Operational Data (${startDate} to ${endDate}):**
        - Assets Managed: ${assets.length}
        - Incidents Reported: ${incidents.length}
        - Tasks Managed: ${tasks.length}
        - Meter Readings Taken: ${meterReadings.length}

        **Report Structure:**

        ---

        ::: {layout="Title"}
        # ${title}
        ### Health Systems Support Management Report
        #### Generated on: ${new Date().toLocaleDateString()}
        :::

        ::: {class="notes"}
        Speaker notes: Welcome everyone. This presentation provides an overview of our performance for the specified period.
        :::

        ---

        ::: {layout="Title and Content"}
        # Executive Summary
        - High-level overview of the facility's performance.
        - Key achievements and challenges during this period.
        :::

        ::: {class="notes"}
        Speaker notes: Briefly summarize the key takeaways. Mention one major success and one key challenge.
        :::

        ---

        ::: {layout="Title and Content"}
        # Asset Management Overview
        - Summary of asset status.
        - Mention any critical assets needing attention.
        - (Analyze this data: ${JSON.stringify(assets)})
        :::

        ::: {class="notes"}
        Speaker notes: Discuss the health of our assets. Highlight any equipment that is due for maintenance or replacement.
        :::

        ---

        ::: {layout="Title and Content"}
        # Incident Report Analysis
        - Breakdown of incidents by priority and department.
        - Trends or recurring issues.
        - (Analyze this data: ${JSON.stringify(incidents)})
        :::

        ::: {class="notes"}
        Speaker notes: Talk about the incident trends. Are we seeing more or fewer critical incidents?
        :::

        ---

        ::: {layout="Title and Content"}
        # Task Management & Productivity
        - Summary of task completion rates.
        - Highlight any overdue or high-priority tasks.
        - (Analyze this data: ${JSON.stringify(tasks)})
        :::

        ::: {class="notes"}
        Speaker notes: Explain our team's productivity. Address any bottlenecks in task completion.
        :::

        ---

        ::: {layout="Title and Content"}
        # Utility Consumption Insights
        - Analysis of meter readings.
        - Suggestions for energy or water conservation.
        - (Analyze this data: ${JSON.stringify(meterReadings)})
        :::

        ::: {class="notes"}
        Speaker notes: Discuss our utility usage. Are there opportunities to be more efficient?
        :::

        ---

        ::: {layout="Title and Content"}
        # Actionable Recommendations
        - Suggest concrete steps for improvement based on the data.
        - Propose preventive maintenance schedules or new protocols.
        :::

        ::: {class="notes"}
        Speaker notes: This is a critical slide. Clearly outline the next steps we should take.
        :::

        ---

        ::: {layout="Section Header"}
        # Q&A
        :::

        ::: {class="notes"}
        Speaker notes: Open the floor for questions.
        :::
    `;

        // Call AI
        const aiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] }
        );

        const markdownContent = aiResponse.data.candidates[0].content.parts[0].text;

        // Update report to 'completed'
        report.markdownContent = markdownContent;
        report.status = 'completed';
        await report.save();

    } catch (error) {
        console.error('Error generating report in background:', error);
        if (report) {
            report.status = 'failed';
            report.error = error.message || 'An unknown error occurred during generation.';
            await report.save();
        }
    }
};

// @desc    Get all reports for the logged-in user
// @route   GET /api/reports
// @access  Private/HSSM-provider
const getReports = async (req, res) => {
    try {
        const reports = await GeneratedReport.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get a single report by ID
// @route   GET /api/reports/:id
// @access  Private/HSSM-provider
const getReportById = async (req, res) => {
    try {
        const report = await GeneratedReport.findById(req.params.id);
        if (!report || report.user.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Report not found' });
        }
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update a report's markdown content
// @route   PUT /api/reports/:id
// @access  Private/HSSM-provider
const updateReport = async (req, res) => {
    try {
        const { markdownContent, title } = req.body;
        const report = await GeneratedReport.findById(req.params.id);

        if (!report || report.user.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Report not found' });
        }

        report.markdownContent = markdownContent || report.markdownContent;
        report.title = title || report.title;
        report.updatedAt = Date.now();

        const updatedReport = await report.save();
        res.json(updatedReport);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a report
// @route   DELETE /api/reports/:id
// @access  Private/HSSM-provider
const deleteReport = async (req, res) => {
    try {
        const report = await GeneratedReport.findById(req.params.id);
        if (!report || report.user.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Report not found' });
        }
        await report.remove();
        res.json({ message: 'Report removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Download a report as a PowerPoint file
// @route   GET /api/reports/:id/download
// @access  Private/HSSM-provider
const downloadReport = async (req, res) => {
    try {
        const report = await GeneratedReport.findById(req.params.id);
        if (!report || report.user.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Report not found' });
        }

        const markdown = report.markdownContent;
        const outputPath = path.join(__dirname, '..', 'uploads', `${report._id}.pptx`);
        const referenceDocPath = path.join(__dirname, '..', 'templates', 'reference.pptx');
        
        // Ensure the uploads directory exists
        const uploadsDir = path.dirname(outputPath);
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        let pandocArgs = `-f markdown -t pptx -o "${outputPath}"`;

        // Use a reference document for styling if it exists
        if (fs.existsSync(referenceDocPath)) {
            pandocArgs += ` --reference-doc="${referenceDocPath}"`;
        }


        pandoc(markdown, pandocArgs, (err, result) => {
            if (err) {
                console.error('Pandoc error:', err);
                // Note for the developer: This error often means the pandoc executable is not in the system's PATH.
                return res.status(500).send('Error converting file. Please ensure Pandoc is installed on the server and that the reference document is valid.');
            }
            
            res.download(outputPath, `${report.title.replace(/ /g, '_')}.pptx`, (downloadErr) => {
                // Clean up the generated file after download
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
                if(downloadErr) {
                    console.error("File download error:", downloadErr);
                }
            });
        });

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Server error during download.' });
    }
};


module.exports = {
    generateReport,
    getReports,
    getReportById,
    updateReport,
    deleteReport,
    downloadReport,
};
