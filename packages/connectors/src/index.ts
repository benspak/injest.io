import { PostgreSQLConnector } from './connectors/PostgreSQLConnector.js';
import { RestApiConnector } from './connectors/RestApiConnector.js';
import { GoogleAnalyticsConnector } from './connectors/GoogleAnalyticsConnector.js';
import type { IConnector, ConnectorType } from '@brain/shared';

export * from './base/BaseConnector.js';
export * from './connectors/PostgreSQLConnector.js';
export * from './connectors/RestApiConnector.js';
export * from './connectors/GoogleAnalyticsConnector.js';

export class ConnectorFactory {
  static create(type: ConnectorType): IConnector {
    switch (type) {
      case 'postgresql':
        return new PostgreSQLConnector();
      case 'rest_api':
        return new RestApiConnector();
      case 'google_analytics':
        return new GoogleAnalyticsConnector();
      default:
        throw new Error(`Connector type ${type} not implemented`);
    }
  }

  static getAvailableConnectors(): ConnectorType[] {
    return ['postgresql', 'rest_api', 'google_analytics'];
  }
}
