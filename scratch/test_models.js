
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function list() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // There is no direct listModels in the standard SDK class, 
    // but we can try to fetch from the endpoint manually if needed.
    // However, let's try to just guess some names or check if 2.0-flash works.
    console.log("Checking gemini-2.5-flash...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("test");
    console.log("gemini-2.5-flash works!");
  } catch (e) {
    console.log("gemini-2.0-flash failed:", e.message);
    
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log("Checking gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("test");
        console.log("gemini-1.5-flash works!");
    } catch (e2) {
        console.log("gemini-1.5-flash failed:", e2.message);
    }
  }
}
list();
