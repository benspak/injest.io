import type {
  IConnector,
  ConnectorSchema,
  ExtractOptions,
  ExtractResult,
  TransformedData,
} from '@brain/shared';

export abstract class BaseConnector implements IConnector {
  abstract type: string;

  abstract authenticate(config: Record<string, unknown>): Promise<boolean>;

  abstract discoverSchema(config: Record<string, unknown>): Promise<ConnectorSchema>;

  abstract extract(
    config: Record<string, unknown>,
    tableName: string,
    options?: ExtractOptions
  ): Promise<ExtractResult>;

  transform(data: unknown[], schema: ConnectorSchema['tables'][0]): Promise<TransformedData[]> {
    // Default transformation - just pass through with schema validation
    return Promise.resolve(
      data.map((row) => {
        const transformed: TransformedData = {};
        schema.columns.forEach((col) => {
          transformed[col.name] = (row as Record<string, unknown>)[col.name] ?? null;
        });
        return transformed;
      })
    );
  }

  abstract scheduleSync(config: Record<string, unknown>, schedule: string): Promise<void>;

  protected validateConfig(config: Record<string, unknown>, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }
  }
}
