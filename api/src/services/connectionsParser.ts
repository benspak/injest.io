import fs from 'fs';

export interface Connection {
  firstName: string;
  lastName: string;
  url?: string;
  emailAddress?: string;
  company?: string;
  position?: string;
  connectedOn?: string;
}

export class ConnectionsParserService {
  /**
   * Parse a LinkedIn Connections.csv file
   * Skips the first 3 rows (metadata/notes rows)
   * Row 4 contains column titles
   * Row 5 and onward contain contact item entries
   */
  async parseConnectionsFile(filePath: string): Promise<Connection[]> {
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    return this.parseConnectionsCSV(csvContent);
  }

  /**
   * Parse CSV content
   * Expected format:
   * - Skip first 3 rows (metadata/notes)
   * - Row 4: First Name,Last Name,URL,Email Address,Company,Position,Connected On (header)
   * - Row 5+: Contact entries
   */
  parseConnectionsCSV(csvContent: string): Connection[] {
    const connections: Connection[] = [];
    const lines = csvContent.split(/\r?\n/);

    // Skip first 3 rows (metadata/notes rows)
    // Row 4 (index 3) = header row
    // Row 5+ (index 4+) = data rows
    const dataLines = lines.slice(3);

    // Find header row (should be at index 0 after skipping 3 rows, which is row 4)
    if (dataLines.length === 0) {
      return connections;
    }

    // Parse header row to find column indices
    const headerLine = dataLines[0];
    const headerColumns = this.parseCSVLine(headerLine);

    // Find column indices
    const firstNameIndex = headerColumns.findIndex(col =>
      col.toLowerCase().includes('first name') || col.toLowerCase() === 'firstname'
    );
    const lastNameIndex = headerColumns.findIndex(col =>
      col.toLowerCase().includes('last name') || col.toLowerCase() === 'lastname'
    );
    const urlIndex = headerColumns.findIndex(col =>
      col.toLowerCase() === 'url'
    );
    const emailIndex = headerColumns.findIndex(col =>
      col.toLowerCase().includes('email')
    );
    const companyIndex = headerColumns.findIndex(col =>
      col.toLowerCase() === 'company'
    );
    const positionIndex = headerColumns.findIndex(col =>
      col.toLowerCase() === 'position'
    );
    const connectedOnIndex = headerColumns.findIndex(col =>
      col.toLowerCase().includes('connected') || col.toLowerCase().includes('connected on')
    );

    // Parse data rows (skip header row)
    for (let i = 1; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue; // Skip empty lines

      const columns = this.parseCSVLine(line);

      // Skip if we don't have at least first name or last name
      const firstName = firstNameIndex >= 0 && firstNameIndex < columns.length
        ? columns[firstNameIndex].trim()
        : '';
      const lastName = lastNameIndex >= 0 && lastNameIndex < columns.length
        ? columns[lastNameIndex].trim()
        : '';

      if (!firstName && !lastName) {
        continue; // Skip rows without name
      }

      const connection: Connection = {
        firstName,
        lastName,
      };

      if (urlIndex >= 0 && urlIndex < columns.length) {
        const url = columns[urlIndex].trim();
        if (url) connection.url = url;
      }

      if (emailIndex >= 0 && emailIndex < columns.length) {
        const email = columns[emailIndex].trim();
        if (email) connection.emailAddress = email;
      }

      if (companyIndex >= 0 && companyIndex < columns.length) {
        const company = columns[companyIndex].trim();
        if (company) connection.company = company;
      }

      if (positionIndex >= 0 && positionIndex < columns.length) {
        const position = columns[positionIndex].trim();
        if (position) connection.position = position;
      }

      if (connectedOnIndex >= 0 && connectedOnIndex < columns.length) {
        const connectedOn = columns[connectedOnIndex].trim();
        if (connectedOn) connection.connectedOn = connectedOn;
      }

      connections.push(connection);
    }

    return connections;
  }

  /**
   * Parse a CSV line, handling quoted fields and escaped quotes
   */
  private parseCSVLine(line: string): string[] {
    const columns: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // End of column
        columns.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last column
    columns.push(current);

    return columns;
  }
}

export const connectionsParserService = new ConnectionsParserService();
