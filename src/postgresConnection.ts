import { Client } from "pg";

const postgresConnection = new Client({
  host: "localhost",
  user: "postgres",
  port: 5433,
  password: "postgres",
  database: "postgres",
});

export default postgresConnection;
