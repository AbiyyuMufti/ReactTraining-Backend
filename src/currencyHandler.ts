import express from "express";
import postgresConnection from "./postgresConnection";
import bodyParser from "body-parser";

const client = postgresConnection;

const currencyHandler = express.Router();
currencyHandler.use(bodyParser.urlencoded({ extended: false }));
currencyHandler.use(bodyParser.json());

currencyHandler.get("/", (_, response) => {
  client.query(
    `
    SELECT * 
    FROM historical_currency;`,
    (err, res) => {
      if (!err) {
        response.send(
          res.rows.map((e: any) => {
            return { country: e.country, currency: Number(e.currency) };
          })
        );
      } else {
        response.status(500).json({
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
});

currencyHandler.post("/insert", (request, response) => {
  const { country, currency } = request.body;
  client.query(
    `
    INSERT INTO historical_currency (country, currency)
    VALUES('${country}', ${currency});  
  `,
    (err, res) => {
      if (!err) {
        response.send({ status: "Insert successfull", response: res });
      } else {
        response.status(400).json({
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
});

currencyHandler.post("/update", (request, response) => {
  const { country, currency } = request.body;
  client.query(
    `
    UPDATE historical_currency
    SET currency=${currency}
    WHERE country = '${country}'
  `,
    (err, res) => {
      if (!err) {
        response.send({ status: "Update successfull", response: res });
      } else {
        response.status(400).json({
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
});

currencyHandler.post("/remove", (request, response) => {
  const { country, currency } = request.body;
  client.query(
    `
    DELETE FROM historical_currency
    WHERE country='${country}' AND currency=${currency};
  `,
    (err, res) => {
      if (!err) {
        response.send({ status: "Update successfull", response: res });
      } else {
        response.status(400).json({
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
});

export default currencyHandler;
