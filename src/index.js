var through = require('through2');
var gutil = require('gulp-util');
var http = require('http');
var https = require('https');
var connect = require('connect');
var express = require('express')
var serveStatic = require('serve-static');
var connectLivereload = require('connect-livereload');
var proxy = require('proxy-middleware');
var tinyLr = require('tiny-lr');
var watch = require('watch');
var fs = require('fs');
var serveIndex = require('serve-index');
var path = require('path');
var open = require('open');
var url = require('url');
var extend = require('node.extend');
var enableMiddlewareShorthand = require('./enableMiddlewareShorthand');
var isarray = require('isarray');
var multer  =   require('multer');
var cors  =   require('cors');
var restify = require('restify');




module.exports = function(options) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    'Access-Control-Max-Age': 2592000, // 30 days
    /** add other headers too */
  };

  var defaults = {

    /**
     *
     * BASIC DEFAULTS
     *
     **/

    host: 'localhost',
    port: 8000,
    path: '/',
    method: 'GET',
    fallback: false,
    https: false,
    open: false,
    origins: ['*'],
    credentials: false, // defaults to false
  

    /**
     *
     * MIDDLEWARE DEFAULTS
     *
     * NOTE:
     *  All middleware should defaults should have the 'enable'
     *  property if you want to support shorthand syntax like:
     *
     *    webserver({
     *      livereload: true
     *    });
     *
     */

    // Middleware: Livereload
    livereload: {
      enable: false,
      port: 35729,
      filter: function (filename) {
        if (filename.match(/node_modules/)) {
          return false;
        } else { return true; }
      }
    },

    // Middleware: Directory listing
    // For possible options, see:
    //  https://github.com/expressjs/serve-index
    directoryListing: {
      enable: false,
      path: './',
      options: undefined
    },

    // Middleware: Proxy
    // For possible options, see:
    //  https://github.com/andrewrk/connect-proxy
    proxies: []

  };
  var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './owners/aparcare/static');
    },
    filename: function (req, file, cb) {
      //gutil.log(file);
      cb(null, file.originalname);
    }
  });
  var upload = multer({ storage : storage});

  // Deep extend user provided options over the all of the defaults
  // Allow shorthand syntax, using the enable property as a flag
  var config = enableMiddlewareShorthand(defaults, options, [
    'directoryListing',
    'livereload'
  ]);

  gutil.log(config);

  if (typeof config.open === 'string' && config.open.length > 0 && config.open.indexOf('http') !== 0) {
    // ensure leading slash if this is NOT a complete url form
    config.open = (config.open.indexOf('/') !== 0 ? '/' : '') + config.open;
  }

  var app = express();
  app.options("/*", function(req, res, next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    //res.send(200);
    next();
  });
  app.post('/upload', upload.single('file') ,function (req, res,next) {
    gutil.log("post ",req.method); 
    
    
    next();
  });
/*
  app.use(function(req,res,next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Allow");
    res.header('Access-Control-Allow-Methods', 'OPTIONS, POST, GET, HEAD');
    res.header('Allow', 'OPTIONS, POST, GET, HEAD');
    next();
  });
*/
  var openInBrowser = function() {
    if (config.open === false) return;
    if (typeof config.open === 'string' && config.open.indexOf('http') === 0) {
      // if this is a complete url form
      open(config.open);
      return;
    }
    open('http' + (config.https ? 's' : '') + '://' + config.host + ':' + config.port + (typeof config.open === 'string' ? config.open : ''));
  };

  var lrServer;

  if (config.livereload.enable) {

    app.use(connectLivereload({
      port: config.livereload.port
    }));

    if (config.https) {
      if (config.https.pfx) {
        lrServer = tinyLr({
          pfx: fs.readFileSync(config.https.pfx),
          passphrase: config.https.passphrase
        });
      }
      else {
        lrServer = tinyLr({
          key: fs.readFileSync(config.https.key || __dirname + '/../ssl/dev-key.pem'),
          cert: fs.readFileSync(config.https.cert || __dirname + '/../ssl/dev-cert.pem')
        });
      }
    } else {
      lrServer = tinyLr();
    }

    lrServer.listen(config.livereload.port, config.host);

  }

  // middlewares
  if (typeof config.middleware === 'function') {
    app.use(config.middleware);
    gutil.log('middleware');
  } else if (isarray(config.middleware)) {
    config.middleware
      .filter(function(m) { return typeof m === 'function'; })
      .forEach(function(m) {
        app.use(m);
        gutil.log('middleware');
      });
  }

 
 
  // Proxy requests
  for (var i = 0, len = config.proxies.length; i < len; i++) {
    var proxyoptions = url.parse(config.proxies[i].target);
    if (config.proxies[i].hasOwnProperty('options')) {
      extend(proxyoptions, config.proxies[i].options);
    }
    //gutil.log(config.proxies[i].source, proxy(proxyoptions));
    app.use(config.proxies[i].source, proxy(proxyoptions));
    gutil.log('proxy');
  }

  if (config.directoryListing.enable) {
    app.use(config.path, serveIndex(path.resolve(config.directoryListing.path), config.directoryListing.options));
  }


  var files = [];



  // Create server
  var stream = through.obj(function(file, enc, callback) {

    app.use(config.path, serveStatic(file.path));
    gutil.log('stream');

    if (config.livereload.enable) {
      var watchOptions = {
        ignoreDotFiles: true,
        filter: config.livereload.filter
      };
      watch.watchTree(file.path, watchOptions, function (filename) {
        lrServer.changed({
          body: {
            files: filename
          }
        });

      });
    }

    this.push(file);
    callback();
  })
  .on('data', function(f){files.push(f);
    gutil.log("files",f);
  })
  .on('end', function(){
    if (config.fallback) {
      files.forEach(function(file){
        var fallbackFile = file.path + '/' + config.fallback;
        if (fs.existsSync(fallbackFile)) {
          app.use(function(req, res) {
            gutil.log("upload",req.url);
            if(req.url == "/upload"){
              console.log("upload");
              upload(req,res,function(err) {
                if(err) {
                    return res.end("Error uploading file.");
                }
                res.end("File is uploaded");
            });
                
            }else{
               res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            fs.createReadStream(fallbackFile).pipe(res);
            }          
          });
        }
      });
    }
  });

  var webserver;

  if (config.https) {
    var opts;

    if (config.https.pfx) {
      opts = {
        pfx: fs.readFileSync(config.https.pfx),
        passphrase: config.https.passphrase
      };
    } else {
      opts = {
        key: fs.readFileSync(config.https.key || __dirname + '/../ssl/dev-key.pem'),
        cert: fs.readFileSync(config.https.cert || __dirname + '/../ssl/dev-cert.pem')
      };
    }
    webserver = https.createServer(opts, app).listen(config.port, config.host, openInBrowser);
  } else {
    webserver = http.createServer(app).listen(config.port, config.host, openInBrowser);
  }
 /*
  app.use(function (req, res, next) {
    gutil.log(req.method);
    next();
  });
*/
app.get('/',function (req, res,next) {
  res.set({
    'Content-Type': 'text/plain',
    'Allow': 'GET, POST, OPTIONS'
  })
  gutil.log("get ",req.method); 
  next();
});


  gutil.log('Webserver started at', gutil.colors.cyan('http' + (config.https ? 's' : '') + '://' + config.host + ':' + config.port));

  stream.on('kill', function() {

    webserver.close();

    if (config.livereload.enable) {
      lrServer.close();
    }

  });

  return stream;

};
