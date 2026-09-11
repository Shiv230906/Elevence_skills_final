const bodyparser = require("body-parser");
const express = require("express");
const app = express();
const cors = require("cors");
const { connect } = require("./db");
const router = require("./Routes/index");
const port = 5000;


const path = require("path");

app.use(cors());
app.use(bodyparser.json({ limit: "50mb" }));
app.use(bodyparser.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/resumes", express.static(path.join(__dirname, "uploads/resumes")));
app.use("/media", express.static(path.join(__dirname, "uploads/media")));

app.get("/", (req, res) => {
  res.send("hello this is internshala backend");
});
app.use("/api", router);
connect();
app.use((req, res, next) => {
  req.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Origin", "*");
  next();
});
app.listen(port, () => {
  console.log(`Server is running on the port ${port}`);
});