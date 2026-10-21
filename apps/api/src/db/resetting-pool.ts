import sql from "mssql";

interface PooledConnection {
  closed: boolean;
  hasError: boolean;
  reset(callback: (error?: Error | null) => void): void;
}

// node-mssql's Tedious pool validates a connection before lending it. A transaction
// changes the connection's isolation level, which SQL Server retains after COMMIT.
// Reset the complete session here, while it is exclusively owned by the pool, so
// ordinary requests never inherit SERIALIZABLE locks or other session settings.
// This driver hook is covered by the real-SQL commerce regression suite; revisit
// it when upgrading node-mssql/Tedious. Failed resets discard the connection.
export class ResettingConnectionPool extends sql.ConnectionPool {
  _poolValidate(connection: PooledConnection): Promise<boolean> | boolean {
    if (!connection || connection.closed || connection.hasError) return false;
    return new Promise(resolve => connection.reset(error => resolve(!error)));
  }
}
