import express from "express";
import postgresConnection from "./postgresConnection";
import bodyParser from "body-parser";

const client = postgresConnection;

const calendarHandler = express.Router();
calendarHandler.use(bodyParser.urlencoded({ extended: false }));
calendarHandler.use(bodyParser.json());

calendarHandler.get("/:year/:month", (request, response) => {
  const { year, month } = request.params;

  client.query(
    `
    with
    ordered as (
      select
        agenda_id,
        title,
        priority,
        "date",
        case
          when priority = 'HIGH' then 0
          when priority = 'NORMAL' then 1
          else 2
        end as ordering
      from
        agenda ag
      left join
      agenda_priority ap
      on
        ap.priority_id = ag.priority_id
      where
        date_part('month',
        "date") = ${month}
        and date_part('year',
        "date") = ${year}
      )
      select
        agenda_id,
        title,
        priority,
        "date"
      from
        ordered
      order by date, ordering
    ;`,
    (err, res) => {
      if (!err) {
        response.send(
          res.rows.map((e) => {
            return {
              id: e.agenda_id,
              agenda: e.title,
              priority: e.priority,
              date: new Date(Date.parse(e.date)),
            };
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

calendarHandler.get("/agenda/", (request, response) => {
  const { id } = request.query;
  if (!id) {
    response.status(404).send({
      message: "you need to query the id of the agenda!",
    });
    return;
  }
  client.query(
    `
      select
      agenda_id,
      title,
      description,
      priority,
      "date"
    from
      agenda ag
    left join
    agenda_priority ap
    on
      ap.priority_id = ag.priority_id
    where
      agenda_id = '${id}'
    ;`,
    (err, res) => {
      if (!err) {
        response.send(
          res.rows.map((e: any) => {
            return {
              id: e.agenda_id,
              agenda: e.title,
              priority: e.priority,
              description: e.description,
              date: e.date,
            };
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

calendarHandler.delete("/agenda/", (request, response) => {
  const { id } = request.query;
  if (!id) {
    response.status(404).send({
      message: "you need to query the id of the agenda to delete the agenda",
    });
    return;
  }
  client.query(
    `
    delete 
    from agenda
    where 
      agenda_id = '${id}'
    ;`,
    (err, res) => {
      if (!err) {
        response.send({ status: "delete successfull", response: res });
      } else {
        response.status(500).json({
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
});

calendarHandler.post("/insert", (request, response) => {
  console.log(request.body.priority);
  const { title, description, date, priority } = request.body;

  client.query(
    `
    with
    entry as (
      select
        gen_random_uuid() as agenda_id,
        '${title}' as title,
        cast('${date}' as date) as "date",
        '${description}' as description
      ),
    priority_table as (
      select
          *
        from
          agenda_priority
        where
          priority = '${priority}'
      )
      insert into agenda
      ("agenda_id", "title", "description", "priority_id", "date")
      select agenda_id, title, description, priority_id, "date" from entry, priority_table;
    `,
    (err, res) => {
      if (!err) {
        response.send(res);
      } else {
        response.status(400).json({
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
});

calendarHandler.post("/update", (request, response) => {
  const { id } = request.query;
  const { title, description, priority } = request.body;
  client.query(
    `
    with 
    entry as (
    select
      '${title}' as title,
      '${description}' as description
    ),
    priority as (
      select
        priority_id
      from
        agenda_priority
      where
        priority = '${priority}'
    )
    UPDATE agenda ag
    SET title=ue.title, description=ue.description, priority_id=ue.priority_id
    from (
      select title, description, priority_id from entry, priority
    ) as ue
    where ag.agenda_id = '${id}'
      ;
    `,
    (err, res) => {
      if (!err) {
        response.send({ status: "update successfull", response: res });
      } else {
        response.status(400).json({
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
});

export default calendarHandler;
