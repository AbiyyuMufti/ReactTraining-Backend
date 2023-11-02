import express from "express";
import dbTechnipFMCConnection from "./dbTechnipFMCConnection";
import bodyParser from "body-parser";
import * as fs from "fs";
const createCsvWriter: any = require("csv-writer").createObjectCsvWriter;

const client = dbTechnipFMCConnection;

const machineUtilitiesHandler = express.Router();
machineUtilitiesHandler.use(bodyParser.urlencoded({ extended: false }));
machineUtilitiesHandler.use(bodyParser.json());

machineUtilitiesHandler.get("/site", (_, response) => {
  client.query(
    `
    select "ID", "siteName" from "Site"
    `,
    (err, res) => {
      if (!err) {
        response.send(
          res.rows.map((e: any) => {
            return { ID: Number(e.ID), siteName: e.siteName };
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

machineUtilitiesHandler.get("/plant-area/", (request, response) => {
  const { "site-id": site_id } = request.query;
  if (!site_id) {
    response.status(400).json({
      message: "you need to specify site-id",
    });
    return;
  }
  client.query(
    `
    select 
        pa."ID", pa."plantName" 
    from "PlantArea" pa 
    left join "Site" s 
    on s."ID" = pa."siteID" 
    where "siteID" = ${site_id}
    `,
    (err, res) => {
      if (!err) {
        response.send(
          res.rows.map((e: any) => {
            return { ID: Number(e.ID), plantArea: e.plantName };
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

machineUtilitiesHandler.get("/department/", (request, response) => {
  const { "plant-area-id": plant_area_id } = request.query;
  if (!plant_area_id) {
    response.status(400).json({
      message: "you need to specify plant-area-id",
    });
    return;
  }
  client.query(
    `
    select d."ID", d.department from "Department" d
    left join "PlantArea" pa 
    on pa."ID" = d."plantAreaID" 
    left join "Site" s 
    on pa."siteID" = s."ID" 
    where "plantAreaID" = ${plant_area_id}
    `,
    (err, res) => {
      if (!err) {
        response.send(
          res.rows.map((e: any) => {
            return { ID: Number(e.ID), department: e.department };
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

machineUtilitiesHandler.get("/work-center/", (request, response) => {
  const { dp } = request.query;
  if (!dp) {
    response.status(400).json({
      message: "you need to specify department-id",
    });
    return;
  }
  const departmentID = Array.isArray(dp) ? dp : [dp];
  client.query(
    `
      select wc."ID", wc."workCenter" from "WorkCenter" wc 
      left join "Department" d 
      on d."ID" = wc."departmentID" 
      left join "PlantArea" pa 
      on pa."ID" = d."plantAreaID" 
      left join "Site" s 
      on pa."siteID" = s."ID" 
      where "departmentID" in (${departmentID.toString()})
      order by wc."ID"
      `,
    (err, res) => {
      if (!err) {
        response.send(
          res.rows.map((e: any) => {
            return { ID: Number(e.ID), workCenter: e.workCenter };
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

machineUtilitiesHandler.get("/work-station", (request, response) => {
  const { wc } = request.query;
  if (!wc) {
    response.json([]);
    return;
  }
  const work_centers = Array.isArray(wc) ? wc : [wc];

  client.query(
    `
    select ws."ID", ws."workStation" from "WorkStation" ws
    left join "WorkCenter" wc 
    on wc."ID" = ws."workCenterID" 
    where "workCenterID" in (${work_centers})
    order by ws."ID"
    `,
    (err, res) => {
      if (!err) {
        response.send(
          res.rows.map((e: any) => {
            return { ID: Number(e.ID), workStation: e.workStation };
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

const queryWorkStations = async (
  work_centers: number[],
  work_stations: number[]
) => {
  const based_on_work_center =
    work_centers && work_centers.length > 0
      ? `("workCenterID" in (${work_centers.toString()}))`
      : "true";

  const based_on_work_station =
    work_stations && work_stations.length > 0
      ? `(ws."ID" in (${work_stations.toString()}))`
      : "true";
  const query = {
    text: `
    select
      ws."ID", 
      ws."workStation",
      substring("workCenter" 
        from position(' ' in "workCenter") 
        for length("workCenter")) 
      as "workCenter"
    from "WorkStation" ws
    left join "WorkCenter" wc 
    on wc."ID" = ws."workCenterID"  
    where 
      ${based_on_work_center}
    and
      ${based_on_work_station}
    order by "workCenter", "workStation"
    `,
  };
  const res = await client.query(query);
  return res;
};

const queryHistoricalData = async (
  site: number,
  plant_area_id: number,
  department: number,
  work_centers: number[],
  work_stations: number[],
  start_date: Date,
  end_date: Date
) => {
  const values = [site, plant_area_id, department, start_date, end_date];

  const based_on_work_center =
    work_centers && work_centers.length > 0
      ? `("workCenterID" in (${work_centers.toString()}))`
      : "true";

  const based_on_work_station =
    work_stations && work_stations.length > 0
      ? `(ws."ID" in (${work_stations.toString()}))`
      : "true";
  const text = `
  with 
  machine_data as (
    select * from "Geminis18iMachineStatusHistorical"
    union
    select * from "Geminis31iMachineStatusHistorical"
    union
    select * from "MazakMachineStatusHistorical"
  ),
  raw as (
    select
      "machineModel",
      "status", 	
      "startDateTime",
      "finishDateTime",
      "workStation",
      (extract(epoch from "finishDateTime") - extract(epoch from "startDateTime"))/1000 as duration
    from
      machine_data md
    left join "WorkStation" ws on md."workStationID" = ws."ID"
    left join "WorkCenter" wc on wc."ID" = ws."workCenterID" 
    left join "Department" d on d."ID" = wc."departmentID"	
    left join "PlantArea" pa  on pa."ID" = d."plantAreaID" 
    left join "Site" s on pa."siteID" = s."ID" 	
    where "siteID" = $1
    and "plantAreaID"  = $2
    and "departmentID" = $3
    and ${based_on_work_center}
    and ${based_on_work_station}
  ),
  tod as (
    select * 
    from raw
    where "finishDateTime" >= $4 
    and "startDateTime" < $5
  ),
  prv_idx as (
    select 
      *,
      rank() over ( partition by "workStation"
      order by "startDateTime" desc
    ) as idx
    from raw
    where "startDateTime" < $4
  ),
  prev as (
    select 
      "machineModel",
      "status", 	
      "startDateTime",
      "finishDateTime",
      "workStation",
      "duration"
    from prv_idx
    where idx = 1
  )
  select * 
    from (
    select * from prev
    union 
    select * from tod
  ) as unison
  order by "startDateTime" asc   
  `;
  const res = await client.query(text, values);
  return res;
};

machineUtilitiesHandler.post("/data", async (request, response) => {
  const {
    site,
    plant_area_id,
    department,
    work_centers,
    work_stations,
    start_date,
    end_date,
  } = request.body;

  if (!site)
    response.status(400).send({ message: `"site" element required in body` });
  if (!plant_area_id)
    response
      .status(400)
      .send({ message: `"plant_area_id" element required in body` });
  if (!department)
    response
      .status(400)
      .send({ message: `"department" element required in body` });
  if (!start_date || !end_date)
    response
      .status(400)
      .send({ message: `"start_date" and end_date element required in body` });

  const startDate = new Date(Date.parse(start_date));
  const endDate = new Date(Date.parse(end_date));
  Promise.all([
    queryWorkStations(work_centers, work_stations),
    queryHistoricalData(
      site,
      plant_area_id,
      department,
      work_centers,
      work_stations,
      startDate,
      endDate
    ),
  ]).then(([machine_list, history]) => {
    const { rows } = history;

    const reducer = (rows as any[]).reduce((acc, cur) => {
      if (!(cur.workStation in acc)) acc[cur.workStation] = [];
      acc[cur.workStation].push(cur);
      return acc;
    }, {});
    Object.keys(reducer).forEach((e) => {
      const data = reducer[e];

      data[0].startDateTime =
        data[0].startDateTime.getTime() < startDate.getTime()
          ? startDate
          : data[0].startDateTime;

      data[0].finishDateTime =
        data[0].finishDateTime.getTime() < startDate.getTime()
          ? data.length > 1
            ? new Date(data[1].startDateTime.getTime() - 60 * 1000)
            : endDate
          : data[0].finishDateTime;

      data[0].duration =
        data[0].finishDateTime.getTime() - data[0].startDateTime.getTime();

      data[data.length - 1].finishDateTime =
        data[data.length - 1].finishDateTime.getTime() != endDate.getTime()
          ? endDate
          : data[data.length - 1].finishDateTime;

      data[data.length - 1].duration =
        data[data.length - 1].finishDateTime.getTime() -
        data[data.length - 1].startDateTime.getTime();
    });

    const returnData = machine_list.rows.map((e) => {
      const data = reducer[e.workStation]
        ? reducer[e.workStation].map((point: any) => ({
            x: point.status,
            y: [point.startDateTime.getTime(), point.finishDateTime.getTime()],
          }))
        : [];
      const runTimeList = reducer[e.workStation]
        ? reducer[e.workStation].filter((e: any) => e.status === "Running")
        : [];

      const runTimeDurations = runTimeList.reduce((sum: number, point: any) => {
        sum += Number(point.duration);
        return sum;
      }, 0);
      const totalSecondInDay = 24 * 60 * 60 * 1000;
      return {
        id: e.ID,
        workStation: e.workStation,
        workCenter: e.workCenter,
        data: data,
        utilization: (runTimeDurations * 100) / totalSecondInDay,
      };
    });
    response.send(returnData);
  });
});

machineUtilitiesHandler.post("/download", async (request, response) => {
  const {
    site,
    plant_area_id,
    department,
    work_centers,
    work_stations,
    start_date,
    end_date,
  } = request.body;

  const outputFile = `./output/data-${new Date().getTime()}.csv`;

  if (!site)
    response.status(400).send({ message: `"site" element required in body` });
  if (!plant_area_id)
    response
      .status(400)
      .send({ message: `"plant_area_id" element required in body` });
  if (!department)
    response
      .status(400)
      .send({ message: `"department" element required in body` });
  if (!start_date || !end_date)
    response
      .status(400)
      .send({ message: `"start_date" and end_date element required in body` });

  const startDate = new Date(Date.parse(start_date));
  const endDate = new Date(Date.parse(end_date));
  Promise.all([
    queryWorkStations(work_centers, work_stations),
    queryHistoricalData(
      site,
      plant_area_id,
      department,
      work_centers,
      work_stations,
      startDate,
      endDate
    ),
  ]).then(([machine_list, history]) => {
    const { rows } = history;

    const reducer = (rows as any[]).reduce((acc, cur) => {
      if (!(cur.workStation in acc)) acc[cur.workStation] = [];
      acc[cur.workStation].push(cur);
      return acc;
    }, {});
    Object.keys(reducer).forEach((e) => {
      const data = reducer[e];

      data[0].startDateTime =
        data[0].startDateTime.getTime() < startDate.getTime()
          ? startDate
          : data[0].startDateTime;

      data[0].finishDateTime =
        data[0].finishDateTime.getTime() < startDate.getTime()
          ? data.length > 1
            ? new Date(data[1].startDateTime.getTime() - 60 * 1000)
            : endDate
          : data[0].finishDateTime;

      data[0].duration =
        data[0].finishDateTime.getTime() - data[0].startDateTime.getTime();

      data[data.length - 1].finishDateTime =
        data[data.length - 1].finishDateTime.getTime() != endDate.getTime()
          ? endDate
          : data[data.length - 1].finishDateTime;

      data[data.length - 1].duration =
        data[data.length - 1].finishDateTime.getTime() -
        data[data.length - 1].startDateTime.getTime();
    });

    const returnData = machine_list.rows.map((e) => {
      const runTimeList = reducer[e.workStation]
        ? reducer[e.workStation].filter((e: any) => e.status === "Running")
        : [];

      const runTimeDurations = runTimeList.reduce((sum: number, point: any) => {
        sum += Number(point.duration);
        return sum;
      }, 0);
      const totalSecondInDay = 24 * 60 * 60 * 1000;
      return {
        date: new Date(start_date).toLocaleDateString(),
        // id: e.ID,
        workCenter: e.workCenter,
        workStation: e.workStation,
        // status: data,
        runTimeDurations: `${runTimeDurations} s`,
        utilization: `${Math.round(
          (runTimeDurations * 100) / totalSecondInDay
        )} %`,
      };
    });

    const csvWriter = createCsvWriter({
      path: outputFile,
      header: [
        { id: "date", title: "date" },
        { id: "workCenter", title: "workCenter" },
        { id: "workStation", title: "workStation" },
        { id: "runTimeDurations", title: "runTimeDurations" },
        { id: "utilization", title: "utilization" },
      ],
    });

    csvWriter.writeRecords(returnData).then(() => {
      response.setHeader("Content-type", "text/csv");
      response.setHeader(
        "Content-Disposition",
        "attachment; filename=output.csv"
      );
      const fileStream = fs.createReadStream(outputFile);
      fileStream.pipe(response);
    });
  });
});

export default machineUtilitiesHandler;
