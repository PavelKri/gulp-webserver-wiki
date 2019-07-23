gulp-webserver-wiki [Forked from gulp-webserver](https://travis-ci.org/schickling/gulp-webserver)
==============

> Streaming gulp plugin to run a local webserver with LiveReload


## Install

```sh
$ npm install --save-dev gulp-webserver-wiki
```

## Usage
The `gulp.src('root')` parameter is the root directory of the webserver. Multiple directories are possible.

```js
var gulp = require('gulp');
var webserver = require('gulp-webserver');

gulp.task('webserver', function() {
  gulp.src('app')
    .pipe(webserver({
      livereload: true,
      directoryListing: true,
      open: true
    }));
});
```


## FAQ

#### Why can't I reach the server from the network?

**Solution**: Set `0.0.0.0` as `host` option.

#### How can I use `html5Mode` for my single page app with this plugin?

**Solution**: Set the `index.html` of your application as `fallback` option. For example:

```js
gulp.task('webserver', function() {
  gulp.src('app')
    .pipe(webserver({
      fallback: 'index.html'
    }));
});
```

#### How can I pass a custom filter to livereload?

**Solution**: Set `enable: true` and provide filter function in `filter:` property of the livereload object. For example:

```js
gulp.task('webserver', function() {
  gulp.src('app')
    .pipe(webserver({
      livereload: {
        enable: true, // need this set to true to enable livereload
        filter: function(fileName) {
          if (fileName.match(/.map$/)) { // exclude all source maps from livereload
            return false;
          } else {
            return true;
          }
        }
      }
    }));
});
```

#### How can I kill the running server?

**Solution**: Either by pressing `Ctrl + C` or programmatically like in this example:

```js
var stream = gulp.src('app').pipe(webserver());
stream.emit('kill');
```

## License

[MIT License](http://opensource.org/licenses/MIT)
