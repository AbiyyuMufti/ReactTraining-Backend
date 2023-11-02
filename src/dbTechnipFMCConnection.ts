import { Client } from "pg";

const dbTechnipFMCConnection = new Client({
  host: "localhost",
  user: "postgres",
  port: 5433,
  password: "postgres",
  database: "DB_TechnipFMC",
});

export default dbTechnipFMCConnection;
