const OpenAI = require('openai');
const UserBook = require('../models/UserBook');
const DeepReview = require('../models/DeepReview');
const Book = require('../models/Book');
const SocialActivity = require('../models/SocialActivity');
const achievementController = require('./achievementController');

const SYSTEM_PROMPT = `You are Bubo, a strict Socratic tutor and cognitive depth evaluator for a deep reading platform. 
Your ONLY job is to evaluate the quality of a reader's written synthesis of pages they just read.

You will receive: Book Title, Author, Pages Read (range), and the User's Text.

EVALUATION CRITERIA - be STRICT:
- GUIDING state: text is too short (<100 words), superficial, merely summarizes plot without reflection, lacks personal insight, or shows no critical thinking. Return this when the reader hasn't truly engaged with the material.
- APPROVED state: text demonstrates genuine reflection, analysis, connection to broader ideas, personal insight, critical questions raised, or synthesis of themes. Must be substantive (>100 words with quality content).

COGNITIVE DEPTH SCORE (0-100) - only calculated for APPROVED:
- 60-70: Basic reflection, some personal connection
- 71-80: Good analysis, identifies themes, raises questions  
- 81-90: Strong critical thinking, multiple connections, original insights
- 91-100: Exceptional synthesis, profound reflection, philosophical depth

Respond ONLY in this exact JSON format:
{
  "state": "APPROVED" | "GUIDING",
  "cognitiveDepth": <number 0-100, 0 if GUIDING>,
  "feedback": "<2-3 sentences of specific, actionable feedback referencing the book content>",
  "encouragement": "<1 short sentence in the voice of a wise owl mascot>"
}`;

const getMockResponse = (reviewText) => {
  const wordCount = reviewText.trim().split(/\s+/).length;
  if (wordCount < 100) {
    return {
      state: 'GUIDING',
      cognitiveDepth: 0,
      feedback: 'Your synthesis is too brief to demonstrate genuine engagement with the material. Try to explore the themes, connect ideas to your own experience, or raise critical questions about what you read.',
      encouragement: 'Every great thinker started with curiosity — dig deeper, young owl!'
    };
  }
  const depth = Math.min(95, Math.max(60, 60 + Math.floor(wordCount / 10)));
  return {
    state: 'APPROVED',
    cognitiveDepth: depth,
    feedback: 'Your synthesis shows thoughtful engagement with the material. You have identified key themes and connected them to broader ideas. Consider pushing further into the philosophical implications of what you have read.',
    encouragement: 'Excellent reflection — your mind soars like an owl in the night!'
  };
};

exports.submitReview = async (req, res) => {
  const { userBookId, pageFrom, pageTo, reviewText } = req.body;
  if (!userBookId || !pageFrom || !pageTo || !reviewText) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const userBook = await UserBook.findOne({ _id: userBookId, userId: req.user._id }).populate('bookId');
    if (!userBook) return res.status(404).json({ message: 'UserBook not found' });

    const book = userBook.bookId;
    let aiResult;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      const openai = new OpenAI({ apiKey });
      const userMessage = `Book: "${book.title}" by ${book.author}\nPages Read: ${pageFrom}-${pageTo}\n\nReader's Synthesis:\n${reviewText}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      aiResult = JSON.parse(completion.choices[0].message.content);
    } else {
      aiResult = getMockResponse(reviewText);
    }

    const status = aiResult.state === 'APPROVED' ? 'approved' : 'guiding';
    const cognitiveDepth = aiResult.state === 'APPROVED' ? (aiResult.cognitiveDepth || 0) : 0;

    const deepReview = new DeepReview({
      userId: req.user._id,
      userBookId,
      pageFrom,
      pageTo,
      reviewText,
      cognitiveDepth,
      status,
      aiResponse: aiResult
    });
    await deepReview.save();

    if (status === 'approved') {
      await UserBook.findByIdAndUpdate(userBookId, {
        currentPage: pageTo,
        updatedAt: Date.now(),
        $push: { deepReviews: { pageFrom, pageTo, reviewText, cognitiveDepth, status, aiResponse: aiResult } }
      });

      await SocialActivity.create({
        userId: req.user._id,
        type: 'review_approved',
        bookId: book._id,
        pages: pageTo - pageFrom,
        cognitiveDepth,
        message: `validated ${pageTo - pageFrom} pages of "${book.title}" with ${cognitiveDepth}% Cognitive Depth`
      });

      await achievementController.checkAndUnlockAchievements(req.user._id);
    }

    res.json({ deepReview, aiResult });
  } catch (err) {
    console.error('Deep review error:', err);
    res.status(500).json({ message: 'Failed to submit review', error: err.message });
  }
};

exports.getReviewHistory = async (req, res) => {
  const { userBookId } = req.params;
  try {
    const reviews = await DeepReview.find({ userId: req.user._id, userBookId }).sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get review history', error: err.message });
  }
};
