var pathRegExp = require('path-to-regexp')
  , bladerunner = require('./')
  , Runner
  , methods = require('methods')
  , url = require('url')
  , minimatch = require('minimatch')

// Cached parsed urls.
function parseUrl (req) {
  var parsed = req._parsedUrl;
  if (parsed && parsed.href == req.url) return parsed;
  return req._parsedUrl = url.parse(req.url);
};

// Global incremented id for sorting.
var globalId = 0;

function Route (args) {
  this.weight = 0;
  this.id = globalId++;
  this.paths = [];
  this.methods = [];
  this.handlers = [];
  this.options = {};
  this.hosts = [];
  var self = this;

  [].slice.call(args).forEach(function (arg) {
    if (typeof arg === 'object') {
      // Route properties
      arg = Object.keys(arg).map(function (k) {
        return arg[k];
      });
    }
    if (!Array.isArray(arg)) {
      arg = [arg];
    }
    arg.forEach(function (arg) {
      if (arg instanceof RegExp || (typeof arg === 'string' && arg[0] === '/')) {
        // Implied path string/regex
        self.paths.push(arg);
      }
      else if (typeof arg === 'number') {
        // Implied weight
        self.weight = arg;
      }
      else if (typeof arg === 'string') {
        if (~methods.indexOf(arg.toLowerCase())) {
          // HTTP method
          self.methods.push(arg);
        }
        else {
          // host matcher
          self.hosts.push(arg);
        }
      }
      else if (typeof arg === 'function') {
        // handler
        self.handlers.push(arg);
      }
      else if (toString.call(arg) === '[object Object]') {
        Object.keys(arg).forEach(function (k) {
          self.options[k] = arg[k];
        });
      }
    });
  });
  this.methods = this.methods.map(function (method) {
    return method.toUpperCase();
  });
  if (this.paths.length) {
    this.paramses = [];
    this.regexes = this.paths.map(function (p) {
      var params = [];
      self.paramses.push(params);
      return pathRegExp(p, params, {strict: true, sensitive: true});
    });
  }
  if (this.handlers.length === 1) {
    this.handler = this.handlers[0];
  }
  else {
    if (!Runner) Runner = require('./').Runner;
    this.runner = new Runner();
    this.handlers.forEach(function (handler) {
      self.runner.add(handler);
    });
    this.handler = this.runner.handler;
  }
  // performance
  this.methodCount = this.methods.length;
  this.pathCount = this.paths.length;
  this.hostCount = this.hosts.length;
}
module.exports = Route;

function inArray (val, arr, length, useMatch) {
  if (!arr || !length) return false;
  for (var idx = 0; idx < length; idx++) {
    if (useMatch && minimatch(val, arr[idx])) return true;
    if (arr[idx] === val) return true;
  }
  return false;
}

Route.prototype.match = function (req) {
  var debug = require('debug')('bladerunner:route:match');
  debug('matching', req.method, req.url, 'to', this.paths.join(','));
  var customMatch = this.options.match && this.options.match.call(this, req);
  if (customMatch !== null && customMatch !== false && typeof customMatch !== 'undefined') {
    debug('custom match', req.method, req.url);
    return customMatch;
  }
  if (this.methodCount && req.method !== 'HEAD' && !inArray(req.method, this.methods, this.methodCount)) {
    debug('wrong method', req.method, req.url);
    return false;
  }
  if (this.hostCount && req.headers && req.headers.host) {
    if (!req._parsedHost) req._parsedHost = req.headers.host.split(':');
    // minimatch
    if (!inArray(req._parsedHost[0], this.hosts, this.hostCount, true)) {
      debug('wrong method', req.method, req.url);
      return false;
    }
  }
  if (!this.pathCount) {
    debug('match: no paths', req.method, req.url);
    return true;
  }
  var reqPath = parseUrl(req).pathname;
  // Exact match
  if (inArray(reqPath, this.paths, this.pathCount)) {
    debug('exact match', req.method, req.url);
    return {};
  }
  var self = this;
  for (var idx = 0; idx < this.pathCount; idx++) {
    // Try the regex
    var matches = this.regexes[idx].exec(reqPath);
    if (!matches) continue;
    matches.shift();
    var params = [];
    matches.forEach(function (val, idx2) {
      var key = self.paramses[idx][idx2];
      if (key) {
        debug('param key', key);
        params[key.name] = val;
      }
      else {
        params.push(val);
      }
    });
    debug('regex match', req.method, req.url, params);
    return params;
  }
  return false;
};
