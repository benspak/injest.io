import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';
import { zipCodeToCity } from '../utils/zipToCity.js';
import { indexingService } from '../services/indexing.js';
import { ItemModel } from '../models/Item.js';
import { normalizeItem } from '../utils/itemNormalization.js';
const router = express.Router();
// Reserved usernames that cannot be used
const RESERVED_USERNAMES = ['admin', 'api', 'settings', 'profile', 'profiles', 'auth', 'login', 'logout', 'signup', 'signin'];
// Validate username format
function validateUsername(username) {
    if (!username || username.trim().length === 0) {
        return { valid: false, error: 'Username is required' };
    }
    const trimmed = username.trim();
    if (trimmed.length < 3) {
        return { valid: false, error: 'Username must be at least 3 characters' };
    }
    if (trimmed.length > 30) {
        return { valid: false, error: 'Username must be at most 30 characters' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
    }
    if (RESERVED_USERNAMES.includes(trimmed.toLowerCase())) {
        return { valid: false, error: 'This username is reserved and cannot be used' };
    }
    return { valid: true };
}
// Validate URL format and domain
function validateSocialUrl(url, allowedDomains) {
    if (!url || url.trim().length === 0) {
        return { valid: true }; // Optional field
    }
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        // Check if hostname matches any allowed domain or is a subdomain
        const matches = allowedDomains.some(domain => {
            return hostname === domain || hostname.endsWith(`.${domain}`);
        });
        if (!matches) {
            return { valid: false, error: `URL must be from one of: ${allowedDomains.join(', ')}` };
        }
        return { valid: true };
    }
    catch {
        return { valid: false, error: 'Invalid URL format' };
    }
}
// Validate headline length
function validateHeadline(headline) {
    if (!headline || headline.trim().length === 0) {
        return { valid: true }; // Optional field
    }
    const trimmed = headline.trim();
    if (trimmed.length > 100) {
        return { valid: false, error: 'Headline must be at most 100 characters' };
    }
    return { valid: true };
}
// Validate bio length
function validateBio(bio) {
    if (!bio || bio.trim().length === 0) {
        return { valid: true }; // Optional field
    }
    const trimmed = bio.trim();
    if (trimmed.length > 250) {
        return { valid: false, error: 'Bio must be at most 250 characters' };
    }
    return { valid: true };
}
// Validate company length
function validateCompany(company) {
    if (!company || company.trim().length === 0) {
        return { valid: true }; // Optional field
    }
    const trimmed = company.trim();
    if (trimmed.length > 200) {
        return { valid: false, error: 'Company must be at most 200 characters' };
    }
    return { valid: true };
}
// Validate project title length
function validateProjectTitle(title) {
    if (!title || title.trim().length === 0) {
        return { valid: true }; // Optional field
    }
    const trimmed = title.trim();
    if (trimmed.length > 200) {
        return { valid: false, error: 'Project title must be at most 200 characters' };
    }
    return { valid: true };
}
// Validate project description length
function validateProjectDescription(description) {
    if (!description || description.trim().length === 0) {
        return { valid: true }; // Optional field
    }
    const trimmed = description.trim();
    if (trimmed.length > 500) {
        return { valid: false, error: 'Project description must be at most 500 characters' };
    }
    return { valid: true };
}
// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: {shortHash}.{ext}
        // Using a shorter hash instead of full UUIDs to keep filename reasonable
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
        if (!allowedExts.includes(ext)) {
            cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'), '');
            return;
        }
        // Generate a shorter unique identifier (16 bytes = 22 chars in base64url)
        const randomBytes = crypto.randomBytes(16);
        const shortId = randomBytes.toString('base64url');
        const filename = `${shortId}${ext}`;
        cb(null, filename);
    },
});
const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only JPG, PNG, and WebP images are allowed.'));
        }
    },
});
// GET /api/profiles/me - Get own profile (auth required)
// This must come BEFORE /:username route to avoid matching "me" as a username
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await UserModel.findById(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ profile: user });
    }
    catch (error) {
        console.error('Error fetching own profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
// PUT /api/profiles/me - Update own profile (auth required)
router.put('/me', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
    try {
        const userId = req.user.id;
        const { public_username, first_name, last_name, headline, bio, company, project_title, project_description, zip_code, x_profile_url, youtube_url, github_url, linkedin_url, } = req.body;
        const updates = {};
        // Validate and update username
        if (public_username !== undefined) {
            const validation = validateUsername(public_username);
            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }
            // Check if username is already taken (case-insensitive)
            const existingUser = await UserModel.findByPublicUsername(public_username.trim());
            if (existingUser && existingUser.id !== userId) {
                res.status(400).json({ error: 'Username is already taken' });
                return;
            }
            updates.public_username = public_username.trim() || null;
        }
        // Update name fields
        if (first_name !== undefined) {
            updates.first_name = first_name?.trim() || null;
        }
        if (last_name !== undefined) {
            updates.last_name = last_name?.trim() || null;
        }
        if (headline !== undefined) {
            const validation = validateHeadline(headline);
            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }
            updates.headline = headline?.trim() || null;
        }
        if (bio !== undefined) {
            const validation = validateBio(bio);
            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }
            updates.bio = bio?.trim() || null;
        }
        if (company !== undefined) {
            const validation = validateCompany(company);
            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }
            updates.company = company?.trim() || null;
        }
        if (project_title !== undefined) {
            const validation = validateProjectTitle(project_title);
            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }
            updates.project_title = project_title?.trim() || null;
        }
        if (project_description !== undefined) {
            const validation = validateProjectDescription(project_description);
            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }
            updates.project_description = project_description?.trim() || null;
        }
        if (zip_code !== undefined) {
            const trimmedZip = zip_code?.trim() || null;
            updates.zip_code = trimmedZip;
            // Fetch city from zip code
            if (trimmedZip) {
                try {
                    const city = await zipCodeToCity(trimmedZip);
                    updates.city = city;
                }
                catch (error) {
                    console.error('Error fetching city for zip code:', error);
                    // Continue without city if lookup fails
                    updates.city = null;
                }
            }
            else {
                updates.city = null;
            }
        }
        // Validate and update social links
        if (x_profile_url !== undefined) {
            const validation = validateSocialUrl(x_profile_url, ['x.com', 'twitter.com']);
            if (!validation.valid) {
                res.status(400).json({ error: `X profile: ${validation.error}` });
                return;
            }
            updates.x_profile_url = x_profile_url?.trim() || null;
        }
        if (youtube_url !== undefined) {
            const validation = validateSocialUrl(youtube_url, ['youtube.com', 'youtu.be']);
            if (!validation.valid) {
                res.status(400).json({ error: `YouTube: ${validation.error}` });
                return;
            }
            updates.youtube_url = youtube_url?.trim() || null;
        }
        if (github_url !== undefined) {
            const validation = validateSocialUrl(github_url, ['github.com']);
            if (!validation.valid) {
                res.status(400).json({ error: `GitHub: ${validation.error}` });
                return;
            }
            updates.github_url = github_url?.trim() || null;
        }
        if (linkedin_url !== undefined) {
            const validation = validateSocialUrl(linkedin_url, ['linkedin.com']);
            if (!validation.valid) {
                res.status(400).json({ error: `LinkedIn: ${validation.error}` });
                return;
            }
            updates.linkedin_url = linkedin_url?.trim() || null;
        }
        // Handle avatar upload
        if (req.file) {
            // Construct avatar URL relative to uploads directory
            const avatarPath = path.join('avatars', req.file.filename);
            updates.avatar_url = avatarPath;
            // Optionally delete old avatar if it exists
            const currentUser = await UserModel.findById(userId);
            if (currentUser?.avatar_url) {
                const oldAvatarPath = path.join(process.env.UPLOAD_DIR || './uploads', currentUser.avatar_url);
                if (fs.existsSync(oldAvatarPath)) {
                    fs.unlink(oldAvatarPath, (err) => {
                        if (err) {
                            console.error('Error deleting old avatar:', err);
                        }
                    });
                }
            }
        }
        // Update profile
        const updatedUser = await UserModel.updateProfile(userId, updates);
        // Index user profile for search
        indexingService.indexUser(updatedUser).catch((error) => {
            console.warn('[Profiles] Failed to index user profile after update:', error);
        });
        res.json({ profile: updatedUser });
    }
    catch (error) {
        console.error('Error updating profile:', error);
        // Clean up uploaded file on error
        if (req.file) {
            const filePath = req.file.path;
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error('Error cleaning up uploaded file:', err);
                    }
                });
            }
        }
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                res.status(400).json({ error: 'Avatar file is too large. Maximum size is 5MB.' });
                return;
            }
            res.status(400).json({ error: `File upload error: ${error.message}` });
            return;
        }
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
// PUT /api/profiles/me/privacy - Toggle profile privacy (auth required)
router.put('/me/privacy', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { profile_private } = req.body;
        if (typeof profile_private !== 'boolean') {
            res.status(400).json({ error: 'profile_private must be a boolean' });
            return;
        }
        const updatedUser = await UserModel.updateProfile(userId, { profile_private });
        // Index user profile for search (even privacy changes should re-index)
        indexingService.indexUser(updatedUser).catch((error) => {
            console.warn('[Profiles] Failed to index user profile after privacy update:', error);
        });
        res.json({ profile: updatedUser });
    }
    catch (error) {
        console.error('Error updating profile privacy:', error);
        res.status(500).json({ error: 'Failed to update profile privacy' });
    }
});
// GET /api/profiles/user/:userId/username - Get public username by user ID (no auth required)
router.get('/user/:userId/username', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            res.status(400).json({ error: 'User ID is required' });
            return;
        }
        const user = await UserModel.findById(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Only return username if profile is public
        if (user.profile_private) {
            res.status(403).json({ error: 'This profile is private' });
            return;
        }
        if (!user.public_username) {
            res.status(404).json({ error: 'User does not have a public username' });
            return;
        }
        res.json({ username: user.public_username });
    }
    catch (error) {
        console.error('Error fetching username by user ID:', error);
        res.status(500).json({ error: 'Failed to fetch username' });
    }
});
// GET /api/profiles/:username/collections - Get posted collections for a profile (no auth required)
router.get('/:username/collections', async (req, res) => {
    try {
        const { username } = req.params;
        if (!username) {
            res.status(400).json({ error: 'Username is required' });
            return;
        }
        const user = await UserModel.findByPublicUsername(username);
        if (!user) {
            res.status(404).json({ error: 'Profile not found' });
            return;
        }
        // Check if profile is private
        if (user.profile_private) {
            res.status(403).json({ error: 'This profile is private' });
            return;
        }
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const { CollectionModel } = await import('../models/Collection.js');
        const { CollectionItemModel } = await import('../models/CollectionItem.js');
        const collections = await CollectionModel.findPostedCollectionsByOwner(user.id, limit, offset);
        // Get item counts for each collection
        const collectionsWithCounts = await Promise.all(collections.map(async (collection) => {
            const itemCount = await CollectionItemModel.countByCollection(collection.id);
            return {
                ...collection,
                item_count: itemCount,
            };
        }));
        res.json({ collections: collectionsWithCounts });
    }
    catch (error) {
        console.error('Error fetching profile collections:', error);
        res.status(500).json({ error: 'Failed to fetch profile collections' });
    }
});
// GET /api/profiles/:username/items - Get posted items for a profile (no auth required)
router.get('/:username/items', async (req, res) => {
    try {
        const { username } = req.params;
        if (!username) {
            res.status(400).json({ error: 'Username is required' });
            return;
        }
        const user = await UserModel.findByPublicUsername(username);
        if (!user) {
            res.status(404).json({ error: 'Profile not found' });
            return;
        }
        // Check if profile is private
        if (user.profile_private) {
            res.status(403).json({ error: 'This profile is private' });
            return;
        }
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const items = await ItemModel.findPostedItemsByOwner(user.id, limit, offset);
        const normalizedItems = items.map((item) => normalizeItem(item));
        res.json({ items: normalizedItems });
    }
    catch (error) {
        console.error('Error fetching profile items:', error);
        res.status(500).json({ error: 'Failed to fetch profile items' });
    }
});
// GET /api/profiles/:username - Public profile endpoint (no auth required)
// This must come AFTER /me routes to avoid matching "me" as a username
router.get('/:username', async (req, res) => {
    try {
        const { username } = req.params;
        if (!username) {
            res.status(400).json({ error: 'Username is required' });
            return;
        }
        const user = await UserModel.findByPublicUsername(username);
        if (!user) {
            res.status(404).json({ error: 'Profile not found' });
            return;
        }
        // Check if profile is private
        if (user.profile_private) {
            res.status(403).json({ error: 'This profile is private' });
            return;
        }
        // Return public profile data (exclude sensitive fields)
        const publicProfile = {
            id: user.id,
            public_username: user.public_username,
            first_name: user.first_name,
            last_name: user.last_name,
            headline: user.headline,
            bio: user.bio,
            company: user.company,
            project_title: user.project_title,
            project_description: user.project_description,
            city: user.city,
            avatar_url: user.avatar_url,
            x_profile_url: user.x_profile_url,
            youtube_url: user.youtube_url,
            github_url: user.github_url,
            linkedin_url: user.linkedin_url,
            created_at: user.created_at,
        };
        res.json({ profile: publicProfile });
    }
    catch (error) {
        console.error('Error fetching public profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
export default router;
//# sourceMappingURL=profiles.js.map