import swaggerJsdoc from 'swagger-jsdoc';
const resolveServerUrl = () => {
    const candidates = [
        process.env.PUBLIC_API_BASE_URL,
        process.env.API_BASE_URL,
        process.env.BACKEND_URL,
        process.env.NEXT_PUBLIC_API_URL,
        process.env.APP_BASE_URL,
    ];
    for (const candidate of candidates) {
        if (candidate && candidate.trim() !== '') {
            return candidate.replace(/\/+$/, '');
        }
    }
    return 'http://localhost:5555';
};
const primaryServerUrl = resolveServerUrl();
const swaggerDefinition = {
    openapi: '3.0.3',
    info: {
        title: 'Injest API',
        version: '1.0.0',
        description: 'Developer documentation for the Injest API. Authenticate with a user session token or a Plus-tier API key to ingest, organize, search, and act on captured knowledge.',
        contact: {
            name: 'Injest Support',
            email: 'support@injest.io',
        },
    },
    servers: [
        {
            url: primaryServerUrl,
            description: 'Configured API base URL',
        },
        {
            url: 'http://localhost:5555',
            description: 'Local development',
        },
    ],
    tags: [
        { name: 'Authentication', description: 'Authenticate users, manage 2FA, and issue API keys.' },
        { name: 'Items', description: 'Create, retrieve, and manage indexed content.' },
        { name: 'Search', description: 'Semantic search across indexed items.' },
        { name: 'AI', description: 'AI-assisted generation and enrichment workflows.' },
        { name: 'Email', description: 'Inbound and outbound email integrations.' },
        { name: 'Contacts', description: 'List and manage contacts extracted from uploaded files.' },
        { name: 'Tasks', description: 'Convert items into tasks and manage their lifecycle.' },
        { name: 'Send', description: 'Generate outreach plans and send contextual emails.' },
        { name: 'Feedback', description: 'Collect feedback from authenticated users.' },
        { name: 'Payments', description: 'Stripe payment intents for bookmark imports and subscriptions.' },
        { name: 'Profiles', description: 'Manage user profiles and public profile information.' },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Session token issued after a successful magic link verification.',
            },
            apiKeyAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'x-api-key',
                description: 'API key generated from the authentication endpoints.',
            },
        },
        schemas: {
            MessageResponse: {
                type: 'object',
                properties: {
                    message: { type: 'string', example: 'Magic link sent to your email' },
                },
            },
            SuccessResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                },
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    error: { type: 'string', example: 'Invalid request body' },
                    details: { type: 'string', nullable: true },
                },
            },
            UserSummary: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string', format: 'email' },
                    verified: { type: 'boolean' },
                    is_premium: { type: 'boolean' },
                    subscription_tier: { type: 'string', nullable: true },
                    two_factor_enabled: { type: 'boolean' },
                    two_factor_confirmed_at: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            MagicLinkRequest: {
                type: 'object',
                required: ['email'],
                properties: {
                    email: {
                        type: 'string',
                        format: 'email',
                        example: 'you@example.com',
                    },
                },
            },
            VerifyResponse: {
                type: 'object',
                properties: {
                    token: {
                        type: 'string',
                        description: 'Session JWT. Only present when two-factor authentication is not required.',
                    },
                    twoFactorRequired: {
                        type: 'boolean',
                        description: 'Indicates whether the user must complete a two-factor challenge.',
                    },
                    pendingToken: {
                        type: 'string',
                        description: 'Short-lived token used to complete a 2FA challenge.',
                    },
                    user: {
                        $ref: '#/components/schemas/UserSummary',
                    },
                },
            },
            ApiKeyResponse: {
                type: 'object',
                properties: {
                    apiKey: {
                        type: 'string',
                        description: 'Plaintext API key. Returned once on creation.',
                    },
                    createdAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                    },
                    lastUsedAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                    },
                },
            },
            Item: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    owner_id: { type: 'string', format: 'uuid' },
                    type: {
                        type: 'string',
                        nullable: true,
                        description: 'Item classification (note, link, file, email, task).',
                    },
                    title: { type: 'string', nullable: true },
                    description: { type: 'string', nullable: true },
                    url: { type: 'string', format: 'uri', nullable: true },
                    notes: { type: 'string', nullable: true },
                    tags: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                    source: {
                        type: 'string',
                        description: 'Origin of the item (e.g., web, upload, bookmark, email).',
                    },
                    attachments: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                filename: { type: 'string' },
                                originalname: { type: 'string', nullable: true },
                                mimetype: { type: 'string', nullable: true },
                                size: { type: 'integer', nullable: true },
                            },
                        },
                        description: 'Attachments associated with the item (if any).',
                    },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                },
            },
            ItemListResponse: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/Item',
                },
            },
            Contact: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    owner_id: { type: 'string', format: 'uuid' },
                    name: { type: 'string', nullable: true },
                    email: { type: 'string', format: 'email', nullable: true },
                    phone: { type: 'string', nullable: true },
                    source_item_id: { type: 'string', format: 'uuid', nullable: true },
                    metadata: {
                        type: 'object',
                        nullable: true,
                        additionalProperties: true,
                    },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                },
            },
            ContactListResponse: {
                type: 'object',
                properties: {
                    contacts: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Contact' },
                    },
                    pagination: {
                        type: 'object',
                        properties: {
                            limit: { type: 'integer', example: 50 },
                            offset: { type: 'integer', example: 0 },
                            hasMore: { type: 'boolean', example: false },
                            nextOffset: { type: 'integer', nullable: true, example: null },
                        },
                    },
                },
            },
            ContactRequest: {
                type: 'object',
                properties: {
                    name: { type: 'string', nullable: true, example: 'Avery Example' },
                    email: { type: 'string', format: 'email', nullable: true, example: 'avery@example.com' },
                    phone: { type: 'string', nullable: true, example: '+15551234567' },
                    metadata: {
                        type: 'object',
                        nullable: true,
                        additionalProperties: true,
                        example: { source: 'manual', notes: 'Met at conference' },
                    },
                    source_item_id: { type: 'string', format: 'uuid', nullable: true },
                },
            },
            ContactResponse: {
                type: 'object',
                properties: {
                    contact: { $ref: '#/components/schemas/Contact' },
                },
            },
            Task: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    item_id: { type: 'string', format: 'uuid' },
                    title: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    status: {
                        type: 'string',
                        enum: ['pending', 'in_progress', 'completed', 'archived'],
                    },
                    due_date: { type: 'string', format: 'date-time', nullable: true },
                    created_at: { type: 'string', format: 'date-time', nullable: true },
                    updated_at: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            TaskWithItem: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    item_id: { type: 'string', format: 'uuid' },
                    title: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    status: {
                        type: 'string',
                        enum: ['pending', 'in_progress', 'completed', 'archived'],
                    },
                    due_date: { type: 'string', format: 'date-time', nullable: true },
                    created_at: { type: 'string', format: 'date-time', nullable: true },
                    updated_at: { type: 'string', format: 'date-time', nullable: true },
                    item: {
                        allOf: [
                            { $ref: '#/components/schemas/Item' },
                            {
                                type: 'object',
                                nullable: true,
                            },
                        ],
                    },
                },
            },
            TaskListResponse: {
                type: 'array',
                items: { $ref: '#/components/schemas/TaskWithItem' },
            },
            TaskUpdateRequest: {
                type: 'object',
                properties: {
                    title: { type: 'string', nullable: true },
                    description: { type: 'string', nullable: true },
                    status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'archived'] },
                    due_date: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            TaskPromptRequest: {
                type: 'object',
                required: ['prompt'],
                properties: {
                    prompt: {
                        type: 'string',
                        description: 'Instruction for the AI to update the task and item context.',
                    },
                },
            },
            SendPlanRequest: {
                type: 'object',
                required: ['prompt'],
                properties: {
                    prompt: {
                        type: 'string',
                        description: 'High-level description of the outbound communication you want to send.',
                        example: 'Draft a follow-up to the design team at ExampleCorp about our Q1 roadmap.',
                    },
                },
            },
            SendAttachmentInput: {
                type: 'object',
                properties: {
                    itemId: { type: 'string', format: 'uuid' },
                    attachmentFilename: { type: 'string', nullable: true },
                },
            },
            SendPlanResponse: {
                type: 'object',
                properties: {
                    analysis: { type: 'object', additionalProperties: true },
                    prompt: { type: 'string' },
                    searchQuery: { type: 'string' },
                    contacts: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', format: 'uuid' },
                                name: { type: 'string', nullable: true },
                                email: { type: 'string', format: 'email', nullable: true },
                                phone: { type: 'string', nullable: true },
                                company: { type: 'string', nullable: true },
                                sourceItemId: { type: 'string', format: 'uuid', nullable: true },
                                metadata: { type: 'object', nullable: true, additionalProperties: true },
                            },
                        },
                    },
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', format: 'uuid' },
                                title: { type: 'string', nullable: true },
                                type: { type: 'string', nullable: true },
                                description: { type: 'string', nullable: true },
                                similarity: { type: 'number', format: 'float', nullable: true },
                                scores: { type: 'object', nullable: true, additionalProperties: { type: 'number' } },
                            },
                        },
                    },
                    recommendation: {
                        type: 'object',
                        description: 'AI generated subject/body and supporting notes.',
                        additionalProperties: true,
                    },
                    generatedAt: { type: 'string', format: 'date-time' },
                },
            },
            SendExecuteRequest: {
                type: 'object',
                required: ['subject', 'body'],
                properties: {
                    subject: { type: 'string' },
                    body: { type: 'string', description: 'Plaintext body. HTML is also accepted.' },
                    contactId: { type: 'string', format: 'uuid', nullable: true },
                    toEmail: { type: 'string', format: 'email', nullable: true },
                    cc: {
                        type: 'array',
                        nullable: true,
                        items: { type: 'string', format: 'email' },
                    },
                    bcc: {
                        type: 'array',
                        nullable: true,
                        items: { type: 'string', format: 'email' },
                    },
                    replyTo: { type: 'string', format: 'email', nullable: true },
                    prompt: { type: 'string', nullable: true },
                    recommendation: { type: 'object', nullable: true, additionalProperties: true },
                    attachments: {
                        type: 'array',
                        nullable: true,
                        items: { $ref: '#/components/schemas/SendAttachmentInput' },
                    },
                },
            },
            SendExecuteResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: true },
                    sentAt: { type: 'string', format: 'date-time' },
                    itemId: { type: 'string', format: 'uuid' },
                    contact: {
                        type: 'object',
                        nullable: true,
                        additionalProperties: true,
                    },
                },
            },
            FeedbackRequest: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    message: { type: 'string' },
                },
            },
            PaymentIntentResponse: {
                type: 'object',
                properties: {
                    clientSecret: { type: 'string' },
                    paymentIntentId: { type: 'string' },
                    amount: { type: 'integer' },
                    currency: { type: 'string' },
                    subscriptionTier: { type: 'string', nullable: true },
                    plan: {
                        type: 'object',
                        nullable: true,
                        additionalProperties: true,
                    },
                    premium: { type: 'boolean', nullable: true },
                },
            },
            PaymentVerifyResponse: {
                type: 'object',
                properties: {
                    verified: { type: 'boolean' },
                    message: { type: 'string' },
                    premium: { type: 'boolean', nullable: true },
                    subscriptionTier: { type: 'string', nullable: true },
                },
            },
            GenerateRequest: {
                type: 'object',
                required: ['prompt', 'type'],
                properties: {
                    prompt: { type: 'string' },
                    type: { type: 'string', enum: ['draft_email', 'summary', 'reply', 'general'] },
                    contextQuery: { type: 'string', nullable: true },
                },
            },
            GenerateResponse: {
                type: 'object',
                properties: {
                    type: { type: 'string' },
                    content: { type: 'string' },
                    context: { type: 'string', nullable: true },
                },
            },
            ItemShareRequest: {
                type: 'object',
                required: ['email'],
                properties: {
                    email: {
                        type: 'string',
                        format: 'email',
                        description: 'Recipient email address with whom to share the item.',
                    },
                },
            },
            SearchResult: {
                type: 'object',
                properties: {
                    item: { $ref: '#/components/schemas/Item' },
                    similarity: { type: 'number', format: 'float' },
                    source: { type: 'string' },
                    scores: {
                        type: 'object',
                        additionalProperties: { type: 'number', format: 'float' },
                    },
                },
            },
            SearchResponse: {
                type: 'object',
                properties: {
                    query: { type: 'string', example: 'important design doc' },
                    results: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/SearchResult' },
                    },
                },
            },
        },
    },
    paths: {
        '/api/auth/magic-link': {
            post: {
                tags: ['Authentication'],
                summary: 'Send a magic link to authenticate a user',
                description: 'Creates a user if they do not exist and emails a secure login link.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/MagicLinkRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Magic link email sent.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/MessageResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Request missing email.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to generate or send link.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/auth/verify': {
            get: {
                tags: ['Authentication'],
                summary: 'Verify a magic link token',
                parameters: [
                    {
                        name: 'token',
                        in: 'query',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Magic link token received in the email.',
                    },
                ],
                responses: {
                    200: {
                        description: 'Verification succeeded. A session token or two-factor challenge information is returned.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/VerifyResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Token missing or malformed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Token invalid or expired.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/auth/me': {
            get: {
                tags: ['Authentication'],
                summary: 'Fetch the authenticated user profile',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Authenticated user summary.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        user: { $ref: '#/components/schemas/UserSummary' },
                                    },
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Missing or invalid session token.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/auth/api-key': {
            get: {
                tags: ['Authentication'],
                summary: 'Check API key status',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Current API key metadata for the user.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        hasKey: { type: 'boolean' },
                                        createdAt: { type: 'string', format: 'date-time', nullable: true },
                                        lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
                                    },
                                },
                            },
                        },
                    },
                    401: {
                        description: 'User not authenticated.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Authentication'],
                summary: 'Create a new API key',
                description: 'Generates a new API key and revokes any existing key.',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'API key created successfully.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ApiKeyResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'User not authenticated.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to generate API key.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
            delete: {
                tags: ['Authentication'],
                summary: 'Revoke the current API key',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'API key revoked.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/SuccessResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'User not authenticated.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/items': {
            get: {
                tags: ['Items'],
                summary: 'List items for the authenticated user',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                parameters: [
                    {
                        name: 'limit',
                        in: 'query',
                        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
                    },
                    {
                        name: 'offset',
                        in: 'query',
                        schema: { type: 'integer', minimum: 0 },
                    },
                    {
                        name: 'source',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Filter by item source (e.g., web, bookmark, email).',
                    },
                    {
                        name: 'hasAttachments',
                        in: 'query',
                        schema: { type: 'boolean' },
                    },
                    {
                        name: 'fileType',
                        in: 'query',
                        schema: { type: 'string' },
                    },
                ],
                responses: {
                    200: {
                        description: 'Array of items accessible to the user.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ItemListResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Items'],
                summary: 'Create or queue ingestion of a new item',
                description: 'Accepts metadata and optional file attachments. Large uploads are processed asynchronously.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    url: { type: 'string', format: 'uri' },
                                    notes: { type: 'string' },
                                    tags: {
                                        oneOf: [
                                            { type: 'array', items: { type: 'string' } },
                                            { type: 'string', description: 'Comma-separated tag list.' },
                                        ],
                                    },
                                },
                            },
                        },
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    description: { type: 'string' },
                                    url: { type: 'string', format: 'uri' },
                                    notes: { type: 'string' },
                                    tags: { type: 'string' },
                                    attachments: {
                                        type: 'array',
                                        items: {
                                            type: 'string',
                                            format: 'binary',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Item created immediately.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Item' },
                            },
                        },
                    },
                    202: {
                        description: 'Item ingestion accepted for background processing.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        queued: { type: 'boolean', example: true },
                                        uploadedCount: { type: 'integer' },
                                        duplicateCount: { type: 'integer' },
                                        message: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Validation error or unsupported file type.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    403: {
                        description: 'Item limit exceeded or forbidden.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/items/{id}': {
            get: {
                tags: ['Items'],
                summary: 'Fetch a single item by ID',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    200: {
                        description: 'Item data.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Item' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    403: {
                        description: 'Item exists but user lacks access.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Item not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/items/{id}/share': {
            post: {
                tags: ['Items'],
                summary: 'Share an item with another user',
                description: 'Grants access to an item and emails an invitation to the recipient.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ItemShareRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Share invitation sent.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/SuccessResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Missing or invalid email address.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    403: {
                        description: 'Authenticated user is not the item owner.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Item not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/contacts': {
            get: {
                tags: ['Contacts'],
                summary: 'List contacts detected for the authenticated user',
                description: 'Returns contacts extracted from uploaded items (e.g., via OCR). Includes pagination metadata.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'limit',
                        in: 'query',
                        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                        description: 'Maximum number of contacts to return.',
                    },
                    {
                        name: 'offset',
                        in: 'query',
                        schema: { type: 'integer', minimum: 0, default: 0 },
                        description: 'Number of contacts to skip before starting the page.',
                    },
                ],
                responses: {
                    200: {
                        description: 'Contacts for the current user.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ContactListResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Unexpected error retrieving contacts.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Contacts'],
                summary: 'Create or merge a contact',
                description: 'Creates a new contact owned by the authenticated user. If the normalized name, email, and phone match an existing contact, the record is merged.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ContactRequest' },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Contact created or merged successfully.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ContactResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid contact payload.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Unexpected error creating contact.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/contacts/{id}': {
            patch: {
                tags: ['Contacts'],
                summary: 'Update an existing contact',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                        description: 'Contact identifier.',
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ContactRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Contact updated successfully.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ContactResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid contact payload.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Contact not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Unexpected error updating contact.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
            delete: {
                tags: ['Contacts'],
                summary: 'Delete a contact',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                        description: 'Contact identifier.',
                    },
                ],
                responses: {
                    204: {
                        description: 'Contact deleted successfully.',
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Contact not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Unexpected error deleting contact.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/search': {
            get: {
                tags: ['Search'],
                summary: 'Run a semantic search query',
                description: 'Search across all indexed items accessible by the authenticated user.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                parameters: [
                    {
                        name: 'q',
                        in: 'query',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Search query text.',
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
                    },
                    {
                        name: 'types',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Comma-separated list of item types to include.',
                    },
                    {
                        name: 'tags',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Comma-separated tag filters.',
                    },
                    {
                        name: 'source',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Comma-separated sources (web, bookmark, upload, email, etc.).',
                    },
                    {
                        name: 'uploadedBy',
                        in: 'query',
                        schema: { type: 'string', enum: ['me', 'shared', 'all'] },
                    },
                    {
                        name: 'hasAttachments',
                        in: 'query',
                        schema: { type: 'boolean' },
                    },
                    {
                        name: 'dateFrom',
                        in: 'query',
                        schema: { type: 'string', format: 'date-time' },
                    },
                    {
                        name: 'dateTo',
                        in: 'query',
                        schema: { type: 'string', format: 'date-time' },
                    },
                ],
                responses: {
                    200: {
                        description: 'Search results.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/SearchResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Missing query or invalid filters.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Unexpected error performing search.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/generate': {
            post: {
                tags: ['AI'],
                summary: 'Generate AI-assisted content',
                description: 'Create drafts, summaries, or replies with optional contextual retrieval.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/GenerateRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Generated content.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/GenerateResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Missing prompt/type or invalid payload.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to generate content.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/tasks/taskify/{itemId}': {
            post: {
                tags: ['Tasks'],
                summary: 'Convert an item into a task',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'itemId',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    due_date: { type: 'string', format: 'date-time', nullable: true },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Task created successfully.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        task: { $ref: '#/components/schemas/Task' },
                                        item: { $ref: '#/components/schemas/Item' },
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Task already exists or invalid payload.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    403: {
                        description: 'User cannot convert this item.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Item not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to create task.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/tasks': {
            get: {
                tags: ['Tasks'],
                summary: 'List tasks for the authenticated user',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        schema: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'archived'] },
                        description: 'Optional status filter.',
                    },
                ],
                responses: {
                    200: {
                        description: 'Array of tasks with associated items.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/TaskListResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to list tasks.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/tasks/{id}': {
            patch: {
                tags: ['Tasks'],
                summary: 'Update a task',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/TaskUpdateRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Task updated successfully.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Task' },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid update payload.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    403: {
                        description: 'Forbidden from updating the task.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Task not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
            delete: {
                tags: ['Tasks'],
                summary: 'Delete a task',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                responses: {
                    204: {
                        description: 'Task deleted successfully.',
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    403: {
                        description: 'Forbidden from deleting the task.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Task not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/tasks/{id}/prompt': {
            post: {
                tags: ['Tasks'],
                summary: 'Apply an AI prompt to a task',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/TaskPromptRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Task updated with AI assistance.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        task: { $ref: '#/components/schemas/Task' },
                                        item: { $ref: '#/components/schemas/Item' },
                                        message: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Missing or invalid prompt.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    403: {
                        description: 'Forbidden from updating the task.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Task not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to process prompt.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/send/plan': {
            post: {
                tags: ['Send'],
                summary: 'Generate an outbound send plan',
                description: 'Analyzes contacts and items to recommend messaging for outreach.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/SendPlanRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Send plan generated successfully.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/SendPlanResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid prompt.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to generate send plan.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/send/execute': {
            post: {
                tags: ['Send'],
                summary: 'Send an outbound email using a plan',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/SendExecuteRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Email sent and stored successfully.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/SendExecuteResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Missing subject/body or invalid attachments.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    403: {
                        description: 'No access to requested attachments.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Contact or attachment item not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to send email.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/feedback': {
            post: {
                tags: ['Feedback'],
                summary: 'Submit product feedback',
                description: 'Authenticated users can send feedback with an optional screenshot.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    message: { type: 'string' },
                                    image: {
                                        type: 'string',
                                        format: 'binary',
                                        description: 'Optional image attachment (PNG/JPEG, max 5MB).',
                                    },
                                },
                                required: ['title', 'message'],
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Feedback submitted successfully.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/SuccessResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Missing title/message or invalid attachment.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to send feedback.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/payment/bookmark-import': {
            post: {
                tags: ['Payments'],
                summary: 'Create a bookmark import payment intent',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['bookmarkCount'],
                                properties: {
                                    bookmarkCount: { type: 'integer', minimum: 1, maximum: 555 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Payment intent information or premium bypass.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/PaymentIntentResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid bookmark count.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'User not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to create payment intent.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/payment/premium-subscription': {
            post: {
                tags: ['Payments'],
                summary: 'Create a premium subscription payment intent',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: false,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    tier: { type: 'string', enum: ['plus', 'power', 'pro'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Payment intent data or existing subscription message.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/PaymentIntentResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'User not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to create payment intent.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/payment/verify': {
            post: {
                tags: ['Payments'],
                summary: 'Verify a payment intent',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['paymentIntentId'],
                                properties: {
                                    paymentIntentId: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Payment verified successfully.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/PaymentVerifyResponse' },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid payment intent or verification failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication failed.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'User not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to verify payment.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/profiles/{username}': {
            get: {
                tags: ['Profiles'],
                summary: 'Get public profile by username',
                description: 'Retrieve a user\'s public profile information by their username. Returns 403 if the profile is private.',
                parameters: [
                    {
                        name: 'username',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Public username of the profile to retrieve',
                    },
                ],
                responses: {
                    200: {
                        description: 'Public profile retrieved successfully.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        profile: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string', format: 'uuid' },
                                                public_username: { type: 'string', nullable: true },
                                                first_name: { type: 'string', nullable: true },
                                                last_name: { type: 'string', nullable: true },
                                                city: { type: 'string', nullable: true },
                                                avatar_url: { type: 'string', nullable: true },
                                                x_profile_url: { type: 'string', nullable: true },
                                                youtube_url: { type: 'string', nullable: true },
                                                github_url: { type: 'string', nullable: true },
                                                linkedin_url: { type: 'string', nullable: true },
                                                created_at: { type: 'string', format: 'date-time' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    403: {
                        description: 'Profile is private.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'Profile not found.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/profiles/me': {
            get: {
                tags: ['Profiles'],
                summary: 'Get own profile',
                description: 'Retrieve the authenticated user\'s own profile information.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                responses: {
                    200: {
                        description: 'Profile retrieved successfully.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        profile: { $ref: '#/components/schemas/UserSummary' },
                                    },
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication required.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
            put: {
                tags: ['Profiles'],
                summary: 'Update own profile',
                description: 'Update the authenticated user\'s profile information. Supports avatar upload via multipart/form-data.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                requestBody: {
                    required: false,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    public_username: { type: 'string', minLength: 3, maxLength: 30 },
                                    first_name: { type: 'string' },
                                    last_name: { type: 'string' },
                                    zip_code: { type: 'string', maxLength: 20 },
                                    x_profile_url: { type: 'string', format: 'uri' },
                                    youtube_url: { type: 'string', format: 'uri' },
                                    github_url: { type: 'string', format: 'uri' },
                                    linkedin_url: { type: 'string', format: 'uri' },
                                    avatar: { type: 'string', format: 'binary' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Profile updated successfully.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        profile: { $ref: '#/components/schemas/UserSummary' },
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid request data (e.g., username already taken, invalid URL format).',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication required.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/profiles/me/privacy': {
            put: {
                tags: ['Profiles'],
                summary: 'Update profile privacy',
                description: 'Toggle the privacy setting for the authenticated user\'s profile.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['profile_private'],
                                properties: {
                                    profile_private: { type: 'boolean', description: 'Whether the profile should be private' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Privacy setting updated successfully.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        profile: { $ref: '#/components/schemas/UserSummary' },
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Invalid request data.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Authentication required.',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
    },
};
export const swaggerSpec = swaggerJsdoc({
    definition: swaggerDefinition,
    apis: [],
});
//# sourceMappingURL=swagger.js.map