import express from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { emailService } from '../services/email.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed as attachments'));
    } else {
      cb(null, true);
    }
  },
});

router.post(
  '/',
  authMiddleware,
  upload.single('image'),
  async (req: AuthRequest, res: express.Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { title, message } = req.body as { title?: string; message?: string };
      const trimmedTitle = title?.trim() ?? '';
      const trimmedMessage = message?.trim() ?? '';

      if (!trimmedTitle) {
        return res.status(400).json({ error: 'Title is required' });
      }
      if (!trimmedMessage) {
        return res.status(400).json({ error: 'Message is required' });
      }

      await emailService.sendFeedbackEmail({
        title: trimmedTitle,
        message: trimmedMessage,
        userEmail: req.user.email,
        image: req.file
          ? {
              buffer: req.file.buffer,
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
            }
          : undefined,
      });

      res.json({ success: true, message: 'Feedback sent successfully' });
    } catch (error: any) {
      console.error('Error sending feedback email:', error);

      if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: error.message });
      }

      if (error instanceof Error && error.message.includes('image files')) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to send feedback' });
    }
  }
);

export default router;
