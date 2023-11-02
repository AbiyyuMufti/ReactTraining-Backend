import bodyParser from "body-parser";
import express from "express";
import cors from "cors";

import currencyHandler from "./currencyHandler";
import calendarHandler from "./calendarHandler";
import machineUtilitiesHandler from "./machineUtilitiesHandler";
import postgresConnection from "./postgresConnection";
import dbTechnipFMCConnection from "./dbTechnipFMCConnection";
import usersHandler from "./usersHandler";

postgresConnection.connect();
dbTechnipFMCConnection.connect();

const PORT = 8000;
const app = express();

app.use(cors());
app.use("/historical-currency", currencyHandler);
app.use("/calendar", calendarHandler);
app.use("/machine-utilization", machineUtilitiesHandler);
app.use("/users", usersHandler);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.listen(PORT, () => {
  console.log(`now listening on port ${PORT}`);
});
