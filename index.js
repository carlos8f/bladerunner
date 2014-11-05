var Route = require('./route')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , methods = require('methods')
  , url = require('url')

function Runner () {
  this.routes = [];
  this.handler = this.handler.bind(this);
  EventEmitter.call(this);
}
inherits(Runner, EventEmitter);
module.exports = function () {
  return new Runner();
};
module.exports.Runner = Runner;

Runner.prototype.run = function (options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  options || (options = {});
  if (typeof options === 'string') options = {url: options};
  var req = options.req || {};
  req.method || (req.method = options.method || 'GET');
  req.url || (req.url = options.url || '/');
  req.query = url.parse(req.url, true).query;
  req.host || (req.host = options.host || 'localhost');
  var res = options.res || {};
  this.handler(req, res, function (err) {
    if (err) return cb(err);
    cb(null, res);
  });
};

Runner.prototype.handler = function (req, res, next) {
  var debug = require('debug')('bladerunner:runner:handler');
  var idx = 0
    , routes = this.routes
    , self = this
  debug('handler running', req.method, req.url);
  ;(function nextRoute () {
    var route = routes[idx++];
    if (route) {
      debug('trying route', idx);
      var m = route.match(req);
      if (m) {
        debug('match!!!');
        if (route.pathCount) req.params = m;
        route.handler.call(self, req, res, function (err) {
          if (err) {
            if (self.listeners('error').length) {
              return self.emit('error', err, req, res);
            }
            else if (next) {
              return next(err);
            }
            throw err;
          }
          else setImmediate(nextRoute);
        });
      }
      else {
        debug('continue...');
        setImmediate(nextRoute);
      }
    }
    else next && next();
  })();
};

/**
 * Adds route(s) into the runner.
 */
Runner.prototype.add = Runner.prototype.use = function () {
  var args = [].slice.call(arguments);
  this.routes.push(new Route(args));
  this.sort();
  return this;
};

/**
 * Removes route from the runner.
 */
Runner.prototype.remove = function (where) {
  var debug = require('debug')('bladerunner:runner:remove');
  var key = typeof where === 'function' ? 'handlers' : 'paths';
  debug('remove where', key, '=', where);
  var self = this;
  for (var idx in this.routes) {
    for (var idx2 in this.routes[idx][key]) {
      debug('remove check', idx, idx2, this.routes[idx][key][idx2]);
      if (this.routes[idx][key][idx2] === where) {
        debug('remove match', where);
        this.routes.splice(idx, 1);
        return this;
      }
    }
  }
  debug('remove done');
  return this;
};

/**
 * Clears the runner.
 */
Runner.removeAll = function () {
  this.routes = [];
  return this;
};

/**
 * Shortcuts to add routes with various properties.
 */
['first', 'last'].concat(methods).forEach(function (val) {
  Runner.prototype[val] = function () {
    if (val === 'first') val = -1000;
    if (val === 'last') val = 1000;
    return this._shortcut(val, arguments);
  };
});

/**
 * Adds routes(s) with certain value(s) baked in.
 */
Runner.prototype._shortcut = function (val) {
  if (!Array.isArray(val)) val = [val];
  return this.add.apply(this, val.concat([].slice.call(arguments[1])));
};

/**
 * Sorts the routes.
 */
Runner.prototype.sort = function () {
  function sortProp (prop, a, b) {
    if (a[prop] === b[prop]) {
      return prop === 'weight' ? sortProp('id', a, b) : 0;
    }
    return a[prop] < b[prop] ? -1 : 1;
  }
  this.routes.sort(sortProp.bind(null, 'weight'));
};
