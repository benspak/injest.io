# Injest.io RAG System - Complete Codebase Specification

## Project Overview

Build a complete knowledge recall system (RAG - Retrieval Augmented Generation) that allows users to ingest content via email and web interface, automatically index it with vector embeddings for semantic search, and generate AI-powered insights. The system uses email as the primary ingestion method with a web interface for additional content capture and management.

## System Architecture

### Technology Stack

**Backend (`/api`)**
- Runtime: Node.js with TypeScript
- Framework: Express.js 4.x
- Database: PostgreSQL with pgvector extension (vector dimension: 3072 for text-embedding-3-large)
- Authentication: JWT (JSON Web Tokens)
- AI Services: OpenAI API (embeddings, GPT-4-turbo-preview)
- Email Service: Resend API
- File Upload: Multer 2.x
- Module System: ES Modules (ESM) - `"type": "module"` in package.json

**Frontend (`/frontend`)**
- Framework: Next.js 14+ with App Router
- Language: TypeScript
- UI Library: ShadCN UI components (Radix UI primitives)
- Styling: Tailwind CSS 3.x
- State Management: React hooks with localStorage for auth
- Notifications: Sonner (toast notifications)

### Project Structure

```
/
├── api/                    # Backend Express API
│   ├── src/
│   │   ├── config/        # Database, auth config
│   │   ├── middleware/    # Auth middleware
│   │   ├── models/        # Database models (User, Item, Embedding, Task)
│   │   ├── routes/        # Express route handlers
│   │   ├── services/      # Business logic services
│   │   ├── utils/         # Utility functions
│   │   └── migrations/    # Migration runner scripts
│   ├── migrations/        # SQL migration files
│   ├── uploads/           # File upload directory
│   ├── dist/              # Compiled TypeScript output
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # Next.js frontend
│   ├── app/               # Next.js App Router pages
│   ├── components/        # React components
│   ├── lib/               # API client, auth utilities
│   ├── package.json
│   └── tsconfig.json
└── render.yaml            # Render.com deployment config
```

## Database Schema

### PostgreSQL Setup Requirements
- Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- Use UUID primary keys (gen_random_uuid())
- Timestamps with timezone (TIMESTAMP WITH TIME ZONE)
- Automatic updated_at triggers

### Tables

**users**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);
```

**items** (Unified content storage - supports emails, notes, links, files, tasks)
```sql
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),                    -- Optional: 'note', 'link', 'file', 'email', 'task'
    raw TEXT,                            -- Optional: JSON string for backward compatibility
    title VARCHAR(500),                  -- Unified: title/subject
    description TEXT,                   -- Unified: description/body/content
    url TEXT,                            -- For links
    attachments JSONB,                   -- Array of file metadata: [{filename, originalname, mimetype, size}]
    notes TEXT,                          -- User-added notes
    clean TEXT,                          -- AI-generated summary
    tags TEXT[],                         -- AI-generated tags array
    source VARCHAR(500),                 -- Source identifier (e.g., 'web', 'email:user@example.com')
    embedding_id UUID,                   -- Foreign key to embeddings table
    link_metadata JSONB,                 -- Link preview metadata: {title, description, url, image}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_owner_id ON items(owner_id);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_created_at ON items(created_at DESC);
CREATE INDEX idx_items_url ON items(url) WHERE url IS NOT NULL;
CREATE INDEX idx_items_attachments ON items USING GIN (attachments) WHERE attachments IS NOT NULL;
CREATE INDEX idx_items_title ON items(title) WHERE title IS NOT NULL;
```

**embeddings** (Vector storage for semantic search)
```sql
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    embedding vector(3072),               -- text-embedding-3-large dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_embeddings_item_id ON embeddings(item_id);
-- Note: For large datasets, consider adding HNSW index:
-- CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

**tasks** (Separate table for task management)
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    title VARCHAR(500),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_item_id ON tasks(item_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

**Triggers** (Auto-update updated_at)
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Backend Implementation Details

### Configuration Files

**api/package.json**
```json
{
  "name": "injest-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "tsx src/migrations/run.ts",
    "reset-db": "tsx src/migrations/reset.ts"
  },
  "dependencies": {
    "cheerio": "^1.1.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^2.0.0",
    "openai": "^4.20.1",
    "pg": "^8.11.3",
    "pgvector": "^0.1.8",
    "resend": "^3.2.0"
  },
  "devDependencies": {
    "@types/cheerio": "^0.22.35",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.10.5",
    "@types/pg": "^8.10.9",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

**api/tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Core Backend Files

**api/src/config/database.ts**
- Use `pg.Pool` for connection pooling
- Connection string from `DATABASE_URL` environment variable
- SSL enabled in production: `ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false`
- Auto-enable pgvector extension on connection: `CREATE EXTENSION IF NOT EXISTS vector`
- Export default pool instance

**api/src/config/auth.ts**
- Export `JWT_SECRET` from `process.env.JWT_SECRET`
- Export `JWT_EXPIRES_IN` from `process.env.JWT_EXPIRES_IN || '7d'`
- Export `FRONTEND_URL` from `process.env.FRONTEND_URL || 'http://localhost:3000'`

**api/src/middleware/auth.ts**
- Express middleware that validates JWT tokens from `Authorization: Bearer <token>` header
- Verifies token using `jsonwebtoken.verify()`
- Checks user exists and is verified
- Attaches `req.user = { id, email }` to request
- Returns 401 on missing/invalid token or unverified user
- Extend Express Request type: `interface AuthRequest extends Request { user?: { id: string; email: string } }`

**api/src/models/User.ts**
- Class `UserModel` with static methods
- `findByEmail(email: string): Promise<User | null>`
- `findById(id: string): Promise<User | null>`
- `create(email: string): Promise<User>` - creates unverified user
- `verifyEmail(id: string): Promise<User>` - sets verified = true
- `update(id: string, updates: Partial<User>): Promise<User>`

**api/src/models/Item.ts**
- Class `ItemModel` with static methods
- Unified structure: supports `title`, `description`, `url`, `attachments` (JSONB array), `notes`, `tags` (array), `clean`, `source`
- Backward compatibility: `type` and `raw` fields are optional
- `create(input: CreateItemInput): Promise<Item>` - auto-generates `raw` from structured fields if not provided
- `findById(id: string): Promise<Item | null>`
- `findByOwner(ownerId: string, limit: number, offset: number): Promise<Item[]>`
- `update(id: string, updates: Partial<Item>): Promise<Item>` - dynamic field updates
- `delete(id: string): Promise<boolean>`
- Store `attachments` and `tags` as JSON (JSON.stringify for arrays/objects)

**api/src/models/Embedding.ts**
- Class `EmbeddingModel` with static methods
- `create(itemId: string, embedding: number[]): Promise<Embedding>` - converts array to pgvector format: `[${embedding.join(',')}]`
- `findByItemId(itemId: string): Promise<Embedding | null>`
- `findSimilar(queryEmbedding: number[], limit: number): Promise<Embedding[]>` - uses cosine distance: `1 - (embedding <=> $1::vector) as similarity`
- `deleteByItemId(itemId: string): Promise<boolean>`

**api/src/models/Task.ts**
- Class `TaskModel` with static methods
- `create(input: { item_id: string; title: string; description: string; status: string }): Promise<Task>`
- `findById(id: string): Promise<Task | null>`
- `findByItemId(itemId: string): Promise<Task | null>`
- `findByOwner(ownerId: string, status?: string): Promise<Task[]>` - joins with items to filter by owner_id
- `update(id: string, updates: Partial<Task>): Promise<Task>`

**api/src/services/openai.ts**
- Class `OpenAIService` with singleton export
- `createEmbedding(text: string): Promise<number[]>` - uses `text-embedding-3-large` model
- `classifyAndTag(text: string): Promise<{ type, category, tags, summary }>` - uses `gpt-4-turbo-preview`, prompts for JSON response, fallback on parse error
- `generate(prompt: string, context?: string): Promise<string>` - uses `gpt-4-turbo-preview`, temperature 0.7

**api/src/services/embeddings.ts**
- Class `EmbeddingService` with singleton export
- `createEmbedding(itemId: string, text: string): Promise<string>` - returns embedding ID
- `findSimilar(queryText: string, limit: number): Promise<Array<{ embedding, similarity }>>`

**api/src/services/indexing.ts**
- Class `IndexingService` with singleton export
- `indexItem(itemId: string): Promise<void>`:
  1. Fetch item from database
  2. Extract text from unified fields: `title`, `description`, `url`, `notes`
  3. Fallback to parsing `raw` JSON if unified fields empty
  4. Add `link_metadata` content (title, description, url)
  5. Add attachment filenames
  6. Join all text parts
  7. Call `openAIService.classifyAndTag()` for summary and tags
  8. Call `embeddingService.createEmbedding()` to generate and store embedding
  9. Update item with `clean`, `tags`, `embedding_id`

**api/src/services/search.ts**
- Class `SearchService` with singleton export
- `search(ownerId: string, query: string, limit: number): Promise<SearchResult[]>`:
  1. Run semantic search via embeddings (limit * 2)
  2. Run text search on unified fields and link_metadata (limit * 2)
  3. Combine and deduplicate by item ID
  4. Boost similarity if item found in both searches
  5. Sort by similarity descending
  6. Return top `limit` results
- Text search: searches `title`, `description`, `url`, `notes`, and `link_metadata` JSONB fields
- Similarity scoring: title matches = 1.0, notes = 0.9, description = 0.8, link_metadata = 0.7

**api/src/services/email.ts**
- Class `EmailService` with singleton export
- Uses Resend API client
- `sendMagicLink(email: string, link: string): Promise<void>` - sends magic link email
- `sendApprovalEmail(email: string): Promise<void>` - sends approval confirmation email

**api/src/services/linkMetadata.ts**
- Class `LinkMetadataService` with singleton export
- Uses `cheerio` to scrape link metadata
- `fetchMetadata(url: string): Promise<{ title, description, url, image }>` - fetches and parses HTML

**api/src/services/storage.ts**
- Class `FileStorageService` with singleton export
- `getFileStream(filename: string): Promise<Readable>` - reads from `process.env.UPLOAD_DIR || './uploads'`
- Throws error if file not found

**api/src/utils/emailParser.ts**
- Class `EmailParser` with static methods
- `parse(resendPayload: any): ParsedEmail` - extracts subject, body, from, to, attachments
- `extractEmail(emailString: string): string` - handles "Name <email>" format

**api/src/routes/auth.ts**
- `POST /api/auth/magic-link` - creates/updates user, generates JWT, sends magic link email
- `GET /api/auth/verify?token=...` - verifies JWT, marks email verified, sends approval email if first verification, returns new session token
- `GET /api/auth/me` - requires auth middleware, returns current user

**api/src/routes/items.ts**
- All routes require `authMiddleware`
- `POST /api/items` - creates item with unified structure:
  - Accepts `multipart/form-data` with fields: `title`, `description`, `url`, `notes`, `tags` (comma-separated string or array)
  - Accepts file attachments via `upload.array('attachments', 10)` (Multer)
  - Validates at least one field provided
  - Stores files in `./uploads` with timestamp prefix
  - Stores attachment metadata in `attachments` JSONB field
  - Triggers background indexing (non-blocking)
  - Returns created item
- `GET /api/items` - lists user's items with pagination (limit, offset)
- `GET /api/items/:id` - gets single item (ownership check)
- `GET /api/items/:id/metadata` - fetches and saves link metadata if not exists
- `POST /api/items/:id/index` - triggers manual indexing
- `GET /api/items/:id/files/:filename` - downloads file attachment
- `PATCH /api/items/:id` - updates item fields (title, description, url, tags, notes)
- `PATCH /api/items/:id/notes` - updates notes only
- `DELETE /api/items/:id` - deletes item

**api/src/routes/search.ts**
- Requires `authMiddleware`
- `GET /api/search?q=...` - semantic search:
  - Returns top 10 results with similarity scores
  - Response format: `{ query, results: [{ item, similarity, source }] }`

**api/src/routes/tasks.ts**
- Requires `authMiddleware`
- `POST /api/tasks/taskify/:itemId` - converts item to task:
  - Creates task record with title/description from item
  - Updates item type to 'task'
  - Returns error if task already exists
- `GET /api/tasks?status=...` - lists user's tasks with optional status filter
- `PATCH /api/tasks/:id` - updates task (title, description, status, due_date)

**api/src/routes/generate.ts**
- Requires `authMiddleware`
- `POST /api/generate` - AI generation:
  - Body: `{ prompt, type, contextQuery? }`
  - Types: `'draft_email'`, `'summary'`, `'reply'`, `'general'`
  - If `contextQuery` provided, searches knowledge base and includes context
  - Returns: `{ type, content, context }`

**api/src/routes/email.ts**
- `POST /api/email/inbound` - Resend webhook handler:
  - Extracts email from "Name <email>" format
  - Validates user exists and is verified
  - Parses email: subject, body (html or text), attachments
  - Creates item with type='email', source='email:user@example.com'
  - Stores attachments metadata
  - Triggers background indexing
  - Returns `{ message, itemId }`

**api/src/index.ts**
- Express app setup:
  - CORS: `origin: process.env.FRONTEND_URL`, `credentials: true`
  - Conditional body parsing: skip `multipart/form-data` (Multer handles it), parse JSON/urlencoded
  - Route mounting: `/api/auth`, `/api/items`, `/api/search`, `/api/tasks`, `/api/generate`, `/api/email`
  - Health check: `GET /health`
  - Error handling middleware: handles body parser errors, database errors, generic errors
  - Port: `process.env.PORT || 5555`

**api/src/migrations/run.ts**
- Reads SQL files from `../migrations/` directory
- Executes migrations in order (sorted by filename)
- Uses transaction per migration
- Logs success/failure

**api/src/migrations/reset.ts**
- Drops all tables and extensions
- Re-runs all migrations from scratch

## Frontend Implementation Details

### Configuration Files

**frontend/package.json**
```json
{
  "name": "injest-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.6",
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.294.0",
    "next": "^14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^2.2.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.0.4",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.3"
  }
}
```

**frontend/tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Core Frontend Files

**frontend/lib/api.ts**
- Class `ApiClient` with singleton export
- Base URL: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5555'`
- Token storage: `localStorage.getItem('token')`
- Methods:
  - `setToken(token: string)` - stores in localStorage and instance
  - `clearToken()` - removes token
  - `request<T>(endpoint, options)` - handles auth headers, error handling
  - `sendMagicLink(email)`
  - `verifyToken(token)` - sets token after verification
  - `getCurrentUser()`
  - `createItem(data: FormData)` - **does not set Content-Type header** (browser sets multipart boundary)
  - `getItems(limit?, offset?)`
  - `getItem(id)`
  - `getItemMetadata(id)`
  - `indexItem(id)`
  - `updateItem(id, updates)`
  - `updateItemNotes(id, notes)`
  - `deleteItem(id)`
  - `downloadFile(itemId, filename)` - fetches blob, creates download link
  - `search(query)`
  - `taskifyItem(itemId)`
  - `getTasks(status?)`
  - `updateTask(id, updates)`
  - `generate(prompt, type, contextQuery?)`

**frontend/lib/auth.ts**
- Functions:
  - `isAuthenticated(): boolean` - checks localStorage token
  - `getToken(): string | null`
  - `setToken(token: string)`
  - `logout()` - clears token
  - `restore()` - validates token with API, refreshes if needed

**frontend/app/layout.tsx**
- Root layout with ShadCN UI setup
- Includes `<Toaster />` from sonner
- Global CSS import

**frontend/app/page.tsx**
- Landing page with signup/login CTA

**frontend/app/login/page.tsx**
- Email input form
- Calls `apiClient.sendMagicLink(email)`
- Shows success message

**frontend/app/auth/verify/page.tsx**
- Reads `token` from URL query params
- Calls `apiClient.verifyToken(token)`
- Redirects to `/dashboard` on success

**frontend/app/dashboard/page.tsx**
- Protected route (checks auth, redirects if not authenticated)
- Header with search bar, tasks link, logout button
- Two-column layout: capture form (left), item list (right)
- Loads items on mount: `apiClient.getItems(50)`
- Handles taskify and delete actions
- Shows loading states

**frontend/app/dashboard/tasks/page.tsx**
- Protected route
- Lists tasks: `apiClient.getTasks()`
- Shows task status, allows updates
- Displays associated item info

**frontend/components/search-bar.tsx**
- Global search with Cmd+K shortcut (metaKey/ctrlKey + 'k')
- Opens dialog on shortcut or click
- Debounced search (300ms delay)
- Calls `apiClient.search(query)`
- Displays results in `SearchResults` component

**frontend/components/search-results.tsx**
- Displays search results with similarity scores
- Shows item title, description, source
- Clickable items navigate to detail view

**frontend/components/capture-form.tsx**
- Form with fields: title, description, URL, notes, tags (comma-separated), file attachments
- Uses `FormData` for multipart upload
- Calls `apiClient.createItem(formData)`
- Shows success/error toasts
- Clears form on success

**frontend/components/item-list.tsx**
- Displays list of items
- Shows item type, title, description, tags, source
- Actions: taskify, delete
- Handles file downloads
- Shows loading states

**frontend/components/ui/** (ShadCN UI components)
- `button.tsx` - Button component with variants
- `card.tsx` - Card container
- `dialog.tsx` - Modal dialog
- `input.tsx` - Text input
- `textarea.tsx` - Textarea input
- All use class-variance-authority, tailwind-merge, clsx

## Environment Variables

### Backend (`api/.env`)
```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
UPLOAD_DIR=./uploads
PORT=5555
NODE_ENV=development
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:5555
```

## API Endpoints Summary

```
POST   /api/auth/magic-link      - Send magic link email
GET    /api/auth/verify           - Verify magic link token
GET    /api/auth/me               - Get current user (auth required)
POST   /api/items                 - Create item (auth, multipart/form-data)
GET    /api/items                 - List items (auth, pagination)
GET    /api/items/:id             - Get item (auth, ownership check)
GET    /api/items/:id/metadata    - Fetch link metadata (auth)
POST   /api/items/:id/index       - Trigger indexing (auth)
GET    /api/items/:id/files/:filename - Download file (auth)
PATCH  /api/items/:id             - Update item (auth)
PATCH  /api/items/:id/notes        - Update notes (auth)
DELETE /api/items/:id             - Delete item (auth)
GET    /api/search?q=...          - Semantic search (auth)
POST   /api/tasks/taskify/:itemId - Convert item to task (auth)
GET    /api/tasks                 - List tasks (auth, optional status filter)
PATCH  /api/tasks/:id             - Update task (auth)
POST   /api/generate              - AI generation (auth)
POST   /api/email/inbound         - Resend webhook (no auth)
GET    /health                    - Health check
```

## Key Implementation Patterns

### Error Handling
- Backend: Express error middleware catches all errors
- Frontend: Try-catch blocks with toast notifications
- Database errors: Specific error codes (23505 = unique violation, 23503 = foreign key, 23514 = check constraint)

### Authentication Flow
1. User enters email on login page
2. Backend creates/finds user, generates JWT, sends magic link email
3. User clicks magic link, frontend calls `/api/auth/verify`
4. Backend verifies token, marks email verified, sends approval email, returns session token
5. Frontend stores token in localStorage
6. All subsequent requests include `Authorization: Bearer <token>` header

### File Upload Flow
1. Frontend creates `FormData` with fields and files
2. **Does not set Content-Type header** (browser sets multipart boundary)
3. Backend uses Multer to parse multipart/form-data
4. Files stored in `./uploads` with timestamp prefix
5. File metadata stored in `attachments` JSONB field
6. Files served via `/api/items/:id/files/:filename` endpoint

### Indexing Flow
1. Item created or updated
2. Indexing triggered in background (non-blocking)
3. Text extracted from unified fields
4. OpenAI classifies and tags content
5. Embedding generated and stored
6. Item updated with `clean`, `tags`, `embedding_id`

### Search Flow
1. User enters query in search bar
2. Backend runs semantic search (vector similarity) and text search (LIKE queries)
3. Results combined and deduplicated by item ID
4. Similarity scores boosted if item found in both searches
5. Top 10 results returned with similarity scores

### Email Ingestion Flow
1. User sends email to configured address (e.g., input@injest.io)
2. Resend webhook calls `/api/email/inbound`
3. Backend extracts sender email, validates user exists and is verified
4. Parses email: subject, body, attachments
5. Creates item with type='email', source='email:user@example.com'
6. Triggers background indexing

## Deployment

### Render.com Configuration (`render.yaml`)
- PostgreSQL database service
- Backend web service (Node.js, build command: `cd api && npm install && npm run build`, start: `cd api && npm start`)
- Frontend web service (Node.js, build: `cd frontend && npm install && npm run build`, start: `cd frontend && npm start`)
- Environment variables configured in Render dashboard

### Database Migrations
- Run migrations on first deployment: `cd api && npm run migrate`
- Migration files in `api/migrations/` executed in filename order

## Testing Checklist

When recreating this codebase, verify:
- [ ] User can sign up with email and receive magic link
- [ ] User can verify email and log in
- [ ] User can create items via web form (text, links, files)
- [ ] User can send emails to configured address and they appear as items
- [ ] Items are automatically indexed with embeddings
- [ ] Search returns relevant results with similarity scores
- [ ] User can convert items to tasks
- [ ] User can view and manage tasks
- [ ] AI generation works with context from knowledge base
- [ ] File uploads work and files can be downloaded
- [ ] Link metadata is fetched and stored
- [ ] All API endpoints require authentication
- [ ] Users can only access their own items

## Notes

- The system uses a unified item structure but maintains backward compatibility with `raw` and `type` fields
- Indexing runs asynchronously in the background to avoid blocking API responses
- Vector search uses cosine similarity (pgvector `<=>` operator)
- File storage is local filesystem (can be replaced with S3/cloud storage)
- Email parsing handles both HTML and plain text emails
- The frontend uses client-side routing with Next.js App Router
- All TypeScript files use ES Modules (`.js` extensions in imports)
- CORS is configured to allow credentials from frontend URL
- Error messages are sanitized in production (only show details in development)
