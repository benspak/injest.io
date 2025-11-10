import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { openAIService } from '../services/openai.js';
import { searchService } from '../services/search.js';
const router = express.Router();
router.use(authMiddleware);
// AI generation
router.post('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { prompt, type, contextQuery } = req.body;
        if (!prompt || !type) {
            return res.status(400).json({ error: 'Prompt and type are required' });
        }
        let context = '';
        // If context query is provided, search for relevant items
        if (contextQuery && typeof contextQuery === 'string') {
            const searchResults = await searchService.search({ id: req.user.id, email: req.user.email }, contextQuery, 5);
            const contextItems = searchResults.map((r) => {
                try {
                    const parsed = JSON.parse(r.item.raw);
                    return parsed.title || parsed.subject || '';
                }
                catch {
                    return r.item.raw.substring(0, 200);
                }
            }).join('\n');
            context = `Relevant context from your knowledge base:\n${contextItems}`;
        }
        let generatedContent = '';
        switch (type) {
            case 'draft_email':
                generatedContent = await openAIService.generate(`Write a professional email: ${prompt}`, context);
                break;
            case 'summary':
                generatedContent = await openAIService.generate(`Summarize the following: ${prompt}`, context);
                break;
            case 'reply':
                generatedContent = await openAIService.generate(`Write a reply: ${prompt}`, context);
                break;
            case 'general':
            default:
                generatedContent = await openAIService.generate(prompt, context);
                break;
        }
        res.json({
            type,
            content: generatedContent,
            context: contextQuery ? 'Provided' : 'None',
        });
    }
    catch (error) {
        console.error('Error generating content:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});
export default router;
//# sourceMappingURL=generate.js.map