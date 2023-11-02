import express from "express";
import postgresConnection from "./postgresConnection";
import bodyParser from "body-parser";

const client = postgresConnection;

const usersHandler = express.Router();
usersHandler.use(bodyParser.urlencoded({ extended: false }));
usersHandler.use(bodyParser.json());

usersHandler.get("/", (_, response) => {
  client.query(
    `
      SELECT id, "name"
      FROM users;
    `,
    (err, res) => {
      if (!err) {
        response.send(res.rows);
      } else {
        response.status(500).json({
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
});

usersHandler.post("/authenticate", (request, response) => {
  const { id } = request.body;
  client.query(
    `
      SELECT id, "name"
      FROM users
      WHERE id = '${id}';
    `,
    (err, res) => {
      if (!err) {
        if (res.rowCount === 1)
          response.send({ authentication: true, user: res.rows[0] });
        else response.send({ authentication: false });
      } else {
        response.status(500).json({
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
});

usersHandler.post("/insert", (request, response) => {
  const { id, name, position, country } = request.body;
  client.query(
    `
    INSERT INTO users
    (id, "name", "position", country)
    VALUES('${id}', '${name}', '${position}', '${country}');
    `,
    (err, res) => {
      if (!err) {
        response.send({ status: "Insert successfull", response: res });
      } else {
        response.status(400).send(err.message);
      }
    }
  );
});

export default usersHandler;
