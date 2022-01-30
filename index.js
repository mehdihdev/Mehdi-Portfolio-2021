const express = require('express');
const mongoose = require("mongoose");
const ejs = require("ejs");
const cryptoRandomString = require("crypto-random-string");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const passportLocalMongoose =  require("passport-local-mongoose");
const User = require("./models/User");
const Newsletter = require("./models/Newsletter");
var http = require('http');
const fs = require('fs');
const app = express()
const matter = require('gray-matter');
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const path = require("path");
app.set('view engine', 'ejs')
app.use(express.static('public'));
const nodemailer = require('nodemailer');
var formidable = require('formidable');
require('dotenv').config();

mongoose.set('useNewUrlParser', true); 
mongoose.set('useFindAndModify', false); 
mongoose.set('useCreateIndex', true); 
mongoose.set('useUnifiedTopology', true); 
mongoose.connect(process.env.MONGO); 
app.use(require("express-session")({ 
  secret: process.env.LOGIN_SECRET, 
  resave: false, 
  saveUninitialized: false
})); 

app.use(passport.initialize()); 
app.use(passport.session()); 
  
passport.use(new LocalStrategy(User.authenticate())); 
passport.serializeUser(User.serializeUser()); 
passport.deserializeUser(User.deserializeUser()); 

app.get('/', function (req, res) {
  res.render('home.ejs')
});

app.get('/projects', function (req, res) {
  res.render('projects.ejs')
});

app.get('/contact', function (req, res) {
  res.render('contact.ejs')
});


app.get("/login", function (req, res) { 
  res.render("login"); 
}); 

app.post("/login", passport.authenticate("local", { 
  successRedirect: "/admin", 
  failureRedirect: "/login"
}), function (req, res) { 
}); 

//Handling user logout  
app.get("/logout", function (req, res) { 
  req.logout(); 
  res.redirect("/"); 
}); 

app.get("/register", isLoggedIn,  function (req, res) { 
  res.render("register"); 
}); 

// Handling user signup 
app.post("/register", isLoggedIn, function (req, res) { 
  var username = req.body.username 
  var password = req.body.password 
  User.register(new User({ username: username }), 
          password, function (err, user) { 
      if (err) { 
          console.log(err); 
          return res.render("register"); 
      } 

      passport.authenticate("local")( 
          req, res, function () { 
          res.render("admin"); 
      }); 
  }); 
}); 

// Handling user signup 
app.post("/newsletter/join", async function (req, res) { 
  var name = req.body.name 
  var email = req.body.email 
  const secretCode = cryptoRandomString({
    length: 6,
    });
  var myData = new Newsletter({ name: name, email:email, code:secretCode });
  const verifyurl = "https://mehdi.us/newsletter/verify/" + secretCode
  const data = await ejs.renderFile(__dirname + "/views/newsletter-template.ejs", { text: `Thank you for joining my newsletter! Just one thing before your all set, just click the link: ${verifyurl} to verify your email!`, title: `Verify Email` });
  myData.save()
  .then(item => {

    
    const smtpTrans = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'mehdi@mehdi.us',
        pass: process.env.GMAIL_PASS
      }
    });
    
    
    // Specify what the email will look like
    const mailOpts = {
      from: 'mehdi@mehdi.us', // This is ignored by Gmail
      to: email,
      subject: `Verify Email`,
      html: data
    }
  
    // Attempt to send the email
    smtpTrans.sendMail(mailOpts, (error, response) => {
      if (error) {
        res.render('contact-failure') // Show a page indicating failure
      }
      else {
        res.render("newsletter-success"); 
      }
    })

  })
  .catch(err => {
    res.render("newsletter-fail"); 
  });
}); 

 


app.get('/blog/new-blog', isLoggedIn, function (req, res) {
  res.render('newblog.ejs')
});

app.get('/newsletter', function (req, res) {
  res.render('newsletter.ejs')
});

app.get('/newsletter/send', isLoggedIn,  function (req, res) {
  res.render('newsletter-send.ejs')
});

app.post('/newsletter/send', isLoggedIn, async function(req, res) {

  let users = await Newsletter.find({}); //[{User}, {User}]
  let emailUsers = users.map(u => u.email).join(","); //["mehdi@mehdi.us", "cool@cool.guy"] => "mehdi@mehdi.us,cool@cool.guy"
  let unique = [...new Set(emailUsers)];
  unique.filter(u => u.match(/emailregex/));

  // Instantiate the SMTP server
  const smtpTrans = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'mehdi@mehdi.us',
      pass: process.env.GMAIL_PASS
    }
  })
  const data = await ejs.renderFile(__dirname + "/views/newsletter-template.ejs", { text: `${req.body.message}`, title: `${req.body.subject}` });

  // Specify what the email will look like
  const mailOpts = {
    from: 'mehdi@mehdi.us', // This is ignored by Gmail
    to: `${unique}`,
    subject: `${req.body.subject}`,
    html: data
  }

  // Attempt to send the email
  smtpTrans.sendMail(mailOpts, (error, response) => {
    if (error) {
      res.render('contact-failure') // Show a page indicating failure
    }
    else {
      
      res.redirect('/admin')
    }
  })
})

app.get('/newsletter/verify/:secretcode', async function (req,res) {
  const { secretCode } = req.params;
  const verified = await Newsletter.find({ code:req.params.secretcode })
  if (!verified) {
    res.sendStatus(401);
} else {
    await Newsletter.updateOne(
        { status: "active" }
    );
    res.render('newsletter-success.ejs');
}

});

app.get('/admin', isLoggedIn, function (req, res) {
  res.render('admin.ejs')
});

app.post('/blog/new-blog', isLoggedIn, function (req,res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
    var oldpath = files.filetoupload.path;
    var newpath = __dirname + '/views/articles/' + files.filetoupload.name;
    fs.rename(oldpath, newpath, function (err) {
      if (err) throw err;
      res.render('successful-new-post.ejs')
    });
  });
});

app.get("/blog", (req, res) => {
  const posts = fs.readdirSync(__dirname + '/views/articles').filter(file => file.endsWith('.md'));
  const iterator = posts.values();
    
    for (const value of iterator) { 
      const file = matter.read(__dirname + '/views/articles/' + value);
          // use markdown-it to convert content to HTML
      var md = require("markdown-it")();
      let content = file.content;
      var result = md.render(content);
      var blogDate = new Date(file.data.date);
    }

  res.render("blog", {
    posts: posts,
    date: blogDate.toDateString()
  });
});

app.get("/blog/:article", (req, res) => {

  // read the markdown file
  const file = matter.read(__dirname + '/views/articles/' + req.params.article + '.md');

  // use markdown-it to convert content to HTML
  var md = require("markdown-it")();
  let content = file.content;
  var result = md.render(content);

  res.render("blog-detail", {
    post: result,
    title: file.data.title,
    description: file.data.description,
    image: file.data.image
  });
});

app.post('/contact', isLoggedIn, (req, res) => {

  // Instantiate the SMTP server
  const smtpTrans = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'mehdi@mehdi.us',
      pass: process.env.GMAIL_PASS
    }
  })

  // Specify what the email will look like
  const mailOpts = {
    from: 'mehdi@mehdi.us', // This is ignored by Gmail
    to: 'mehdi@mehdi.us',
    subject: 'New message from contact form at mehdi.us',
    text: `${req.body.name} (${req.body.email}) says: ${req.body.message}`
  }

  // Attempt to send the email
  smtpTrans.sendMail(mailOpts, (error, response) => {
    if (error) {
      res.render('contact-failure') // Show a page indicating failure
    }
    else {
      res.render('contact-success') // Show a page indicating success
    }
  })
})

function isLoggedIn(req, res, next) { 
  if (req.isAuthenticated()) return next(); 
  res.redirect("/login"); 
} 

app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
});