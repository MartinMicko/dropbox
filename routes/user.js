const bcrypt = require('bcrypt');
const failedAttempts = {};
const MAX_ATTEMPTS = 5;
const LOCK_TIME = 1 * 60 * 1000;


//---------------------------------------------signup page call------------------------------------------------------
exports.signup = function (req, res) {
   console.log("Signup POST request received");
   let message = '';

   if (req.method === "POST") {
      console.log("Request Body:", req.body);
      const post = req.body;
      const name = post.user_name;
      const pass = post.password;
      const fname = post.first_name;
      const lname = post.last_name;
      const email = post.email;

      // Validate email domain
      const emailDomain = "@fontysict.nl";
      if (!email.endsWith(emailDomain) ) {
         message = "Only emails with FONTYSICT domain are allowed to sign up.";
         return res.render('signup.ejs', { message });
      }

      // Check if a user has signed up in the last 10 seconds
      const sqlCheck = "SELECT created_at FROM users WHERE created_at > NOW() - INTERVAL 10 SECOND LIMIT 1";
      db.query(sqlCheck, function (err, result) {
         if (err) {
            console.error("Error checking recent signups:", err);
            message = "An error occurred. Please try again.";
            return res.render('signup.ejs', { message });
         }

         if (result.length > 0) {
            message = "You can only create one account every 10 seconds. Please wait and try again.";
            return res.render('signup.ejs', { message });
         }

         // Hash the password before saving it
         bcrypt.hash(pass, 10, function (err, hashedPassword) {
            if (err) {
               console.error("Error hashing password:", err);
               message = "An error occurred. Please try again.";
               return res.render('signup.ejs', { message });
            }

            // Parameterized query to avoid SQL injection
            const sql = "INSERT INTO `users` (`first_name`, `last_name`, `user_name`, `email`, `password`, `user_type`, `created_at`) VALUES (?, ?, ?, ?, ?, 'employee', NOW())";
            const values = [fname, lname, name, email, hashedPassword];

            db.query(sql, values, function (err, result) {
               if (err) {
                  console.error("Error inserting data:", err);
                  message = "An error occurred. Please try again.";
                  return res.render('signup.ejs', { message});
               } else {
                  message = "Successfully! Your account has been created.";
                  return res.render('signup.ejs', { message  });
               }
            });
         });
         

      });

   } else {
      res.render('signup.ejs', { message });
   }
};


//-----------------------------------------------login page call------------------------------------------------------
// Login route
exports.login = function (req, res) {
   let message = '';
   const sess = req.session;
   const now = Date.now();
   const ip = req.ip;

   if (!failedAttempts[ip]) {
      failedAttempts[ip] = { count: 0, lastAttempt: now };
   }

   if (req.method === "POST") {
      const post = req.body;
      const name = post.user_name;
      const pass = post.password;

      // Check if the account is locked
      if (failedAttempts[ip].count >= MAX_ATTEMPTS && now - failedAttempts[ip].lastAttempt < LOCK_TIME) {
         message = `Too many failed attempts. Please try again after ${LOCK_TIME / (60 * 1000)} minutes.`;
         return res.render('index.ejs', { message, session: req.session || {} });
      }
      

      // Use a parameterized query to prevent SQL injection
      const sql = "SELECT id, first_name, last_name, user_name, user_type, password, is_suspended FROM `users` WHERE `user_name` = ?";
      db.query(sql, [name], (err, results) => {
         if (err) {
            console.error("Database Error:", err);
            message = 'An error occurred. Please try again later.';
            return res.render('index.ejs', { message, session: req.session || {} });
         }

         if (results.length > 0) {
            const user = results[0];
            if (user.is_suspended == 1) {
               message = 'Your account is suspended. Please contact support.';
               return res.render('index.ejs', { message, session: req.session || {} });
            }
            // Compare the hashed password with the entered password
            bcrypt.compare(pass, results[0].password, function (err, isMatch) {
               if (err) {
                  console.error("Error comparing passwords:", err);
                  message = 'An error occurred. Please try again later.';
                  return res.render('index.ejs', { message, session: req.session || {} });
               }

               if (isMatch) {
                  // Reset failed attempts after a successful login
                  failedAttempts[ip] = { count: 0, lastAttempt: now };

                  // User authenticated, set session data
                  const user = results[0];
                  req.session.userId = user.id;
                  req.session.user = {
                     id: user.id,
                     first_name: user.first_name,
                     last_name: user.last_name,
                     user_name: user.user_name,
                     user_type: user.user_type // Set user_type here
                  };

                  console.log("Logged in user ID:", user.id);
                  return res.redirect('/home/dashboard');
               } else {
                  // Increment the failed attempts counter
                  failedAttempts[ip].count++;
                  failedAttempts[ip].lastAttempt = now;

                  message = 'Wrong Credentials.';
                  return res.render('index.ejs', { message, session: req.session || {} });
               }
            });
         } else {
            // Increment the failed attempts counter
            failedAttempts[ip].count++;
            failedAttempts[ip].lastAttempt = now;

            message = 'Wrong Credentials.';
            return res.render('index.ejs', { message, session: req.session || {} });
         }
      });
   } else {
      res.render('index.ejs', { message, session: req.session || {} });
   }
};


//-----------------------------------------------dashboard page functionality----------------------------------------------
exports.dashboard = function (req, res, next) {
   const user = req.session.user;
   const userId = req.session.userId;
   console.log('User ID = ' + userId);
   console.log("kokoteee");
   console.log(user.is_suspended);

   if (!userId) {
      return res.redirect("/login");
   }

   const sql = "SELECT * FROM `users` WHERE `id` = ?";

   db.query(sql, [userId], function (err, results) {
      if (err) {
         console.error("Database Error:", err);
         return res.redirect("/login"); // or handle accordingly
      }
      res.render('dashboard.ejs', { user, session: req.session });
   });
};

//------------------------------------logout functionality----------------------------------------------
exports.logout = function (req, res) {
   req.session.destroy(function (err) {
      res.redirect("/login");
   });
};

//--------------------------------render user details after login--------------------------------
exports.profile = function (req, res) {
   const userId = req.session.userId;

   if (!userId) {
      return res.redirect("/login");
   }

   const sql = "SELECT * FROM `users` WHERE `id` = ?";
   db.query(sql, [userId], function (err, result) {
      if (err) {
         console.error("Database Error:", err);
         return res.redirect("/login"); // or handle accordingly
      }
      res.render('profile.ejs', { data: result });
   });
};

//---------------------------------edit users details after login----------------------------------
exports.editprofile = function (req, res) {
   const userId = req.session.userId;

   if (!userId) {
      return res.redirect("/login");
   }

   const sql = "SELECT * FROM `users` WHERE `id` = ?";
   db.query(sql, [userId], function (err, results) {
      if (err) {
         console.error("Database Error:", err);
         return res.redirect("/login"); // or handle accordingly
      }
      res.render('edit_profile.ejs', { data: results });
   });
};

exports.admin = function (req, res) {
   // Ensure the user is logged in and is an admin
   if (!req.session.user || req.session.user.user_type !== 'admin') {
      return res.status(403).send('Access Denied. Admins only.');
      console.log(req.session.user.user_type);
      console.log(req.session.user);


   }

   // Query to fetch all users
   const sql = "SELECT id, first_name, last_name, user_name, user_type, is_suspended FROM `users`";

   db.query(sql, (err, results) => {
      if (err) {
         console.error("Database Error:", err);
         return res.status(500).send('An error occurred. Please try again later.');
      }

      // Render a page or send JSON response with all users
      res.render('admin.ejs', { users: results, session: req.session });
   });
};


exports.files = function (req, res) {
   res.render('files.ejs');
};

// Route to change user type to 'admin'
exports.changeUserType = function (req, res) {
   const userId = req.params.id;

   // Ensure the user is logged in and is an admin
   if (!req.session.user || req.session.user.user_type !== 'admin') {
      return res.status(403).send('Access Denied. Admins only.');
   }

   // Update user type to 'admin'
   const sql = "UPDATE `users` SET `user_type` = 'admin' WHERE `id` = ?";

   db.query(sql, [userId], (err, results) => {
      if (err) {
         console.error("Database Error:", err);
         return res.status(500).send('An error occurred. Please try again later.');
      }

      // Redirect to the admin page after the update
      res.redirect('/admin');
   });
};

// Route to delete a user
exports.deleteUser = function (req, res) {
   const userId = req.params.id;
   const user = req.session.user.id;
   console.log(user);
   console.log(userId);

   // Ensure the user is logged in and is an admin
   if (!req.session.user || req.session.user.user_type !== 'admin') {
      return res.status(403).send('Access Denied. Admins only.');
   }

   // Prevent the admin from deleting themselves
   if (user == userId) {
      return res.redirect('/admin?error=Admin cannot delete themselves');
   }

   // Delete the user from the database
   const sql = "DELETE FROM `users` WHERE `id` = ?";

   db.query(sql, [userId], (err, results) => {
      if (err) {
         console.error("Database Error:", err);
         return res.status(500).send('An error occurred. Please try again later.');
      }

      // Redirect to the admin page after the deletion
      res.redirect('/admin');
   });
};


const AWS = require('aws-sdk');
AWS.config.update({
   accessKeyId: "AKIA4LLE7KKGXAD5PEX2",
   secretAccessKey: "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",
   region: "eu-central-1"
});
// Create an S3 client
const s3 = new AWS.S3();
const bucketName = 'prototype-dopbox';

exports.generatefilelist = async function (req, res) {
   const AWS = require('aws-sdk');
   AWS.config.update({
      accessKeyId: "AKIA4LLE7KKGXAD5PEX2",
      secretAccessKey: "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",
      region: "eu-central-1"
   });
   // Create an S3 client
   const s3 = new AWS.S3();
   const bucketName = 'prototype-dopbox';
   try {
      const userName = req.session.user.user_name;  // Use session data for the logged-in user

      // List files from S3, filtering based on the username (simulating user folders)
      const params = {
         Bucket: 'prototype-dopbox',  // Replace with your actual S3 bucket name
         Prefix: `${userName}/`,  // Only list files in the user's folder
      };

      // Fetch the file list from S3
      const data = await s3.listObjectsV2(params).promise();

      // Map through the contents and format the file data
      const files = data.Contents.map(file => ({
         fileName: file.Key.replace(`${userName}/`, ''),  // Remove the username prefix for display
      }));

      // Send the file list as a JSON response
      res.json({ files });
   } catch (err) {
      console.error('Error retrieving file list:', err);
      res.status(500).json({ error: 'Error retrieving file list' });
   }
};

exports.suspendUser = function (req, res) {
   const userId = req.params.id;
   const user = req.session.user.id;

   // Ensure the user is logged in and is an admin
   if (!req.session.user || req.session.user.user_type !== 'admin') {
      return res.status(403).send('Access Denied. Admins only.');
   }

   // Prevent admin from suspending themselves
   if (user == userId) {
      return res.redirect('/admin?error=Admin cannot suspend themselves');
   }

   const sql = "UPDATE `users` SET `is_suspended` = 1 WHERE `id` = ?";
   
   db.query(sql, [userId], (err, result) => {
      if (err) {
         console.error("Database Error:", err);
         return res.status(500).send('An error occurred. Please try again later.');
      }

      

      res.redirect('/admin');
   });
};

exports.unsuspendUser = function (req, res) {
   const userId = req.params.id;
   const user = req.session.user.id;

   // Ensure the user is logged in and is an admin
   if (!req.session.user || req.session.user.user_type !== 'admin') {
      return res.status(403).send('Access Denied. Admins only.');
   }

   // Prevent admin from unsuspending themselves
   if (user == userId) {
      return res.redirect('/admin?error=Admin cannot unsuspend themselves');
   }

   const sql = "UPDATE `users` SET `is_suspended` = 0 WHERE `id` = ?";

   db.query(sql, [userId], (err, result) => {
      if (err) {
         console.error("Database Error:", err);
         return res.status(500).send('An error occurred. Please try again later.');
      }

      res.redirect('/admin');
   });
};







