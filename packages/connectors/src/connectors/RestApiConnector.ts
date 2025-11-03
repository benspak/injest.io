import axios, { AxiosInstance } from 'axios';
import { BaseConnector } from '../base/BaseConnector.js';
import type {
  ConnectorSchema,
  ExtractOptions,
  ExtractResult,
  TableSchema,
} from '@brain/shared';

export class RestApiConnector extends BaseConnector {
  type = 'rest_api';
  private axiosInstance?: AxiosInstance;

  async authenticate(config: Record<string, unknown>): Promise<boolean> {
    this.validateConfig(config, ['baseUrl']);

    const baseUrl = config.baseUrl as string;
    const headers = (config.headers as Record<string, string>) || {};

    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers,
      timeout: 10000,
    });

    // Test connection with a simple request
    try {
      const testEndpoint = (config.testEndpoint as string) || '/health';
      await this.axiosInstance.get(testEndpoint);
      return true;
    } catch (error) {
      throw new Error(`REST API authentication failed: ${error}`);
    }
  }

  async discoverSchema(config: Record<string, unknown>): Promise<ConnectorSchema> {
    if (!this.axiosInstance) {
      await this.authenticate(config);
    }

    const endpoints = (config.endpoints as string[]) || [];

    if (endpoints.length === 0) {
      // Try to auto-discover from OpenAPI/Swagger
      try {
        const swaggerResponse = await this.axiosInstance!.get('/swagger.json');
        // Parse Swagger spec (simplified)
        const paths = swaggerResponse.data?.paths || {};
        Object.keys(paths).forEach((path) => {
          if (path.startsWith('/') && !endpoints.includes(path)) {
            endpoints.push(path);
          }
        });
      } catch {
        // Swagger not available, use default
        endpoints.push('/');
      }
    }

    const tables: TableSchema[] = endpoints.map((endpoint) => ({
      name: endpoint.replace(/^\//, '') || 'root',
      type: 'collection',
      columns: [
        // Generic columns for REST API
        { name: 'id', type: 'string', nullable: true },
        { name: 'data', type: 'json', nullable: true },
        { name: 'timestamp', type: 'timestamp', nullable: true },
      ],
    }));

    return {
      connectorId: '',
      tables,
      lastDiscoveryAt: new Date(),
    };
  }

  async extract(
    config: Record<string, unknown>,
    tableName: string,
    options?: ExtractOptions
  ): Promise<ExtractResult> {
    if (!this.axiosInstance) {
      await this.authenticate(config);
    }

    const endpoint = tableName.startsWith('/') ? tableName : `/${tableName}`;
    const params: Record<string, unknown> = {};

    if (options?.limit) {
      params.limit = options.limit;
    }
    if (options?.offset) {
      params.offset = options.offset;
    }
    if (options?.filters) {
      Object.assign(params, options.filters);
    }

    try {
      const response = await this.axiosInstance!.get(endpoint, { params });

      // Handle different response formats
      let data: unknown[] = [];
      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data;
      } else if (response.data?.results && Array.isArray(response.data.results)) {
        data = response.data.results;
      } else {
        data = [response.data];
      }

      // Apply limit if response didn't respect it
      if (options?.limit && data.length > options.limit) {
        data = data.slice(0, options.limit);
      }

      const total = response.data?.total || response.data?.count || data.length;
      const hasMore = options?.offset
        ? (options.offset + (options.limit || 1000)) < total
        : false;

      return {
        data,
        hasMore,
        totalCount: total,
      };
    } catch (error) {
      throw new Error(`REST API extraction failed: ${error}`);
    }
  }

  async scheduleSync(config: Record<string, unknown>, schedule: string): Promise<void> {
    return Promise.resolve();
  }
}
