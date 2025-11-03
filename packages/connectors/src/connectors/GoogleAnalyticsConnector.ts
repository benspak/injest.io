import { BaseConnector } from '../base/BaseConnector.js';
import type {
  ConnectorSchema,
  ExtractOptions,
  ExtractResult,
  TableSchema,
} from '@brain/shared';
import axios, { AxiosInstance } from 'axios';

export class GoogleAnalyticsConnector extends BaseConnector {
  type = 'google_analytics';
  private apiClient?: AxiosInstance;

  async authenticate(config: Record<string, unknown>): Promise<boolean> {
    this.validateConfig(config, ['accessToken', 'propertyId']);

    try {
      // Test authentication by making a simple API call
      const response = await axios.get(
        `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken as string}`,
          },
          params: {
            // Minimal report to test auth
            dimensions: [{ name: 'date' }],
            metrics: [{ name: 'activeUsers' }],
            dateRanges: [{ startDate: 'today', endDate: 'today' }],
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      throw new Error(`Google Analytics authentication failed: ${error}`);
    }
  }

  async discoverSchema(config: Record<string, unknown>): Promise<ConnectorSchema> {
    this.validateConfig(config, ['accessToken', 'propertyId']);

    // Google Analytics has predefined "tables" (reports)
    const tables: TableSchema[] = [
      {
        name: 'sessions',
        type: 'table',
        columns: [
          { name: 'date', type: 'date', nullable: false },
          { name: 'sessionSource', type: 'string', nullable: true },
          { name: 'sessionMedium', type: 'string', nullable: true },
          { name: 'sessions', type: 'number', nullable: false },
          { name: 'activeUsers', type: 'number', nullable: false },
          { name: 'screenPageViews', type: 'number', nullable: false },
        ],
      },
      {
        name: 'events',
        type: 'table',
        columns: [
          { name: 'date', type: 'date', nullable: false },
          { name: 'eventName', type: 'string', nullable: true },
          { name: 'eventCount', type: 'number', nullable: false },
        ],
      },
      {
        name: 'user_engagement',
        type: 'table',
        columns: [
          { name: 'date', type: 'date', nullable: false },
          { name: 'activeUsers', type: 'number', nullable: false },
          { name: 'averageSessionDuration', type: 'number', nullable: true },
          { name: 'bounceRate', type: 'number', nullable: true },
        ],
      },
    ];

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
    this.validateConfig(config, ['accessToken', 'propertyId']);

    const propertyId = config.propertyId as string;
    const accessToken = config.accessToken as string;

    try {
      let data: unknown[] = [];

      // Map table names to GA4 report configurations
      switch (tableName) {
        case 'sessions':
          data = await this.fetchSessionsReport(propertyId, accessToken, options);
          break;
        case 'events':
          data = await this.fetchEventsReport(propertyId, accessToken, options);
          break;
        case 'user_engagement':
          data = await this.fetchUserEngagementReport(propertyId, accessToken, options);
          break;
        default:
          throw new Error(`Unknown table: ${tableName}`);
      }

      return {
        data,
        hasMore: false, // GA4 handles pagination internally
        totalCount: data.length,
      };
    } catch (error) {
      throw new Error(`Google Analytics data extraction failed: ${error}`);
    }
  }

  private async fetchSessionsReport(
    propertyId: string,
    accessToken: string,
    options?: ExtractOptions
  ): Promise<unknown[]> {
    const dateRange = this.getDateRange(options);

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        dateRanges: [{ startDate: dateRange.start, endDate: dateRange.end }],
        dimensions: [
          { name: 'date' },
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
        ],
        limit: options?.limit || 10000,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return this.transformGA4Response(response.data);
  }

  private async fetchEventsReport(
    propertyId: string,
    accessToken: string,
    options?: ExtractOptions
  ): Promise<unknown[]> {
    const dateRange = this.getDateRange(options);

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        dateRanges: [{ startDate: dateRange.start, endDate: dateRange.end }],
        dimensions: [{ name: 'date' }, { name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        limit: options?.limit || 10000,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return this.transformGA4Response(response.data);
  }

  private async fetchUserEngagementReport(
    propertyId: string,
    accessToken: string,
    options?: ExtractOptions
  ): Promise<unknown[]> {
    const dateRange = this.getDateRange(options);

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        dateRanges: [{ startDate: dateRange.start, endDate: dateRange.end }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
        limit: options?.limit || 10000,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return this.transformGA4Response(response.data);
  }

  private transformGA4Response(responseData: any): unknown[] {
    const rows = responseData.rows || [];
    const dimensionHeaders = responseData.dimensionHeaders || [];
    const metricHeaders = responseData.metricHeaders || [];

    return rows.map((row: any) => {
      const result: Record<string, unknown> = {};

      // Map dimensions
      dimensionHeaders.forEach((header: any, index: number) => {
        result[header.name] = row.dimensionValues[index]?.value || null;
      });

      // Map metrics
      metricHeaders.forEach((header: any, index: number) => {
        const value = row.metricValues[index]?.value;
        result[header.name] = value ? parseFloat(value) : null;
      });

      return result;
    });
  }

  private getDateRange(options?: ExtractOptions): { start: string; end: string } {
    if (options?.since) {
      const start = options.since.toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];
      return { start, end };
    }

    // Default: last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }

  async scheduleSync(config: Record<string, unknown>, schedule: string): Promise<void> {
    // Schedule will be handled by the job queue system
    return Promise.resolve();
  }
}
