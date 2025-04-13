const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize the Google Generative AI with your API key
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Helper function to get a debate response from Gemini
async function getDebateResponse(messages, topic, stance) {
  try {
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Prepare the conversation history
    const chatHistory = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    // Create a chat session
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1000,
      },
    });

    // Prepare the system prompt based on the debate stance
    let systemPrompt = `You are a virtual debate partner discussing the topic: "${topic}". `;
    
    if (stance === 'for') {
      systemPrompt += `You should argue strongly FOR this position with compelling arguments, evidence, and persuasive rhetoric. Challenge the user's opposing viewpoints respectfully but firmly.`;
    } else if (stance === 'against') {
      systemPrompt += `You should argue strongly AGAINST this position with compelling arguments, evidence, and persuasive rhetoric. Challenge the user's supporting viewpoints respectfully but firmly.`;
    } else {
      systemPrompt += `You should play devil's advocate, challenging the user's arguments regardless of which side they take. Provide balanced perspectives and help them strengthen their reasoning.`;
    }

    // Send the message to the model
    const result = await chat.sendMessage(systemPrompt);
    const response = result.response;
    
    return response.text();
  } catch (error) {
    console.error('Error getting response from Gemini:', error);
    throw new Error('Failed to get response from AI');
  }
}

module.exports = { getDebateResponse };
