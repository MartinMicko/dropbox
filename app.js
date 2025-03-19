/**
* Module dependencies.
*/

//Pičacina
const express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');

const session = require('express-session');
const app = express();
const mysql = require('mysql');
let bodyParser = require("body-parser");
const router = express.Router();

const AWS = require('aws-sdk');

// Load configuration from config.ini
const config = require('./config.json');

// Configure AWS with the values from config.ini
AWS.config.update({
  accessKeyId: config.AWS.access_key_id,
  secretAccessKey: config.AWS.secret_access_key,
  region: config.AWS.region
});

const s3 = new AWS.S3();
const bucketName = config.AWS.bucket_name;

// Configure MySQL connection with dynamic host from config.ini
let connection = mysql.createConnection({
  host: config.Database.host,
  user: config.Database.user,
  password: config.Database.password,
  database: config.Database.database,
  connectTimeout: 10000
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
    return;
  }
  console.log('Connected to the MySQL database successfully.');
});

global.db = connection;

// App configuration
app.set('port', process.env.PORT || 8080);
app.set('views', __dirname + '/templates');
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
  secret: config.Session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 }
}));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.locals.user = req.session.user;
  next();
})

// Routes
app.get('/', routes.index); // Main index page
app.get('/signup', user.signup);
app.post('/signup', user.signup);
app.get('/login', routes.index);
app.post('/login', user.login);
app.get('/home/dashboard', user.dashboard);
app.get('/home/logout', user.logout);
app.get('/home/profile', user.profile);
app.get('/home/files', user.files);
app.get('/admin', user.admin);
app.post('/changeUserType/:id', user.changeUserType);
app.post('/deleteUser/:id', user.deleteUser);
app.get('/generate-file-list', user.generatefilelist);
app.post('/suspendUser/:id', user.suspendUser);
app.post('/unsuspendUser/:id', user.unsuspendUser);

module.exports = router;
//test

// Route to generate pre-signed URL for file upload
app.post('/generate-upload-url', (req, res) => {
  const { fileName, fileType, fileSize } = req.body;
  console.log(`Received request to generate upload URL for file: ${fileName}`);

  // Enforce the 5 MB limit (500 * 1024 * 1024 bytes)
  const maxFileSize = 500 * 1024 * 1024; // 500 MB in bytes
  if (fileSize > maxFileSize) {
    return res.status(400).json({ error: 'File size exceeds the limit of 5 MB' });
  }

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Expires: 60,
    ContentType: fileType,
    ACL: 'public-read'
  };

  s3.getSignedUrl('putObject', params, (err, url) => {
    if (err) {
      console.error('Error generating upload pre-signed URL:', err);
      return res.status(500).json({ error: 'Error generating pre-signed URL' });
    }
    console.log('Generated pre-signed upload URL successfully: 200 (OK)');
    res.json({ url });
  });
});

// Route to list files in the S3 bucket
app.get('/generate-file-list', async (req, res) => {
  const params = { Bucket: bucketName };

  try {
    const data = await s3.listObjectsV2(params).promise();
    const files = data.Contents.map(item => ({
      fileName: item.Key,
      url: `https://${bucketName}.s3.amazonaws.com//${item.Key}`
    }));
    res.json({ files });
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ error: 'Error retrieving file list' });
  }
});

// Route to generate pre-signed URL for file download
app.get('/generate-download-url/:fileName', (req, res) => {
  const { fileName } = req.params;
  console.log(`Received request to generate download URL for file: ${fileName}`);

  const params = {
    Bucket: bucketName,
    Key: fileName,
    Expires: 60 * 5, // 5 minutes
  };

  s3.getSignedUrl('getObject', params, (err, url) => {
    if (err) {
      console.error('Error generating download pre-signed URL:', err);
      return res.status(500).json({ error: 'Error generating pre-signed URL' });
    }
    console.log('Generated pre-signed download URL successfully: 200 (OK)');
    res.json({ url });
  });
});

// Start the server
app.listen(8080);


