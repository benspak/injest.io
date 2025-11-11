import swaggerJsdoc from 'swagger-jsdoc';

const resolveServerUrl = (): string => {
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
    description:
      'Public developer documentation for the Injest API. Authenticate with a user session token or an API key to ingest, organize, and search captured knowledge.',
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
    { name: 'Authentication', description: 'Authenticate users and manage API keys.' },
    { name: 'Items', description: 'Create, retrieve, and manage indexed content.' },
    { name: 'Contacts', description: 'List contacts extracted from uploaded files.' },
    { name: 'Search', description: 'Semantic search across indexed items.' },
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
            schema: { type: 'integer', minimum: 1, maximum: 100 },
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
        description:
          'Accepts metadata and optional file attachments. Large uploads are processed asynchronously.',
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
        description:
          'Returns contacts extracted from uploaded items (e.g., via OCR). Includes pagination metadata.',
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
        description:
          'Creates a new contact owned by the authenticated user. If the normalized name, email, and phone match an existing contact, the record is merged.',
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
  },
};

export const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: [],
});
