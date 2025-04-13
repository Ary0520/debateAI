const express = require('express');
const router = express.Router();
const Debate = require('../models/Debate');
const { getDebateResponse } = require('../utils/geminiApi');

// Get all debates for a user
router.get('/debates', async (req, res) => {
  try {
    const userId = req.query.userId; // In a real app, get this from authenticated session
    
    let query = {};
    if (userId) {
      query.user = userId;
    }
    
    const debates = await Debate.find(query)
      .sort({ updatedAt: -1 })
      .select('topic stance createdAt updatedAt isActive');
    
    res.json(debates);
  } catch (error) {
    console.error('Error fetching debates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific debate by ID
router.get('/debates/:id', async (req, res) => {
  try {
    const debate = await Debate.findById(req.params.id);
    
    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }
    
    res.json(debate);
  } catch (error) {
    console.error('Error fetching debate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new debate
router.post('/debates', async (req, res) => {
  try {
    const { topic, stance, userId } = req.body;
    
    if (!topic) {
      return res.status(400).json({ message: 'Topic is required' });
    }
    
    const newDebate = new Debate({
      topic,
      stance: stance || 'neutral',
      user: userId || null,
      messages: []
    });
    
    // Generate an initial message from the AI to start the debate
    const initialPrompt = `Let's debate about "${topic}". I'll ${
      stance === 'for' ? 'argue for this position' : 
      stance === 'against' ? 'argue against this position' : 
      'play devil\'s advocate'
    }. Please start by sharing your initial thoughts.`;
    
    const aiResponse = await getDebateResponse(
      [{ role: 'user', content: initialPrompt }],
      topic,
      stance
    );
    
    // Add the initial messages to the debate
    newDebate.messages.push(
      { role: 'user', content: initialPrompt },
      { role: 'assistant', content: aiResponse }
    );
    
    await newDebate.save();
    res.status(201).json(newDebate);
  } catch (error) {
    console.error('Error creating debate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a message to a debate
router.post('/debates/:id/messages', async (req, res) => {
  try {
    const { content } = req.body;
    const debateId = req.params.id;
    
    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    // Find the debate
    const debate = await Debate.findById(debateId);
    
    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }
    
    if (!debate.isActive) {
      return res.status(400).json({ message: 'This debate has been closed' });
    }
    
    // Add the user message
    debate.messages.push({
      role: 'user',
      content
    });
    
    // Get AI response
    const aiResponse = await getDebateResponse(
      debate.messages,
      debate.topic,
      debate.stance
    );
    
    // Add the AI response
    debate.messages.push({
      role: 'assistant',
      content: aiResponse
    });
    
    // Save the updated debate
    await debate.save();
    
    res.json({
      debateId: debate._id,
      messages: debate.messages.slice(-2) // Return just the new messages
    });
  } catch (error) {
    console.error('Error adding message to debate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Close a debate
router.put('/debates/:id/close', async (req, res) => {
  try {
    const debate = await Debate.findById(req.params.id);
    
    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }
    
    debate.isActive = false;
    await debate.save();
    
    res.json({ message: 'Debate closed successfully', debate });
  } catch (error) {
    console.error('Error closing debate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
