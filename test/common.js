http = require('http');

bladerunner = require('../');

middler = function (server, handler) {
  if (server && server._bladerunner) return server._bladerunner;
  var ret = bladerunner(), listeners;
  ret.attach = function (_s) {
    if (_s) server = _s;
    listeners = server.listeners('request').slice(0);
    if (listeners.length) {
      server.removeAllListeners('request');
      ret.last(function (req, res, next) {
        listeners.forEach(function (onReq) {
          onReq(req, res);
        });
      });
    }
    server.on('request', ret.handler);
    server._bladerunner = ret;
    return ret;
  };
  ret.detach = function (_s) {
    if (_s) server = _s;
    server.removeListener('request', ret.handler);
    return ret;
  };
  if (server) ret.attach(server);
  if (handler) ret.add(handler);
  return ret;
};

assert = require('assert');

listen = function (fn) {
  var server = http.createServer();
  server.listen(0, function () {
    fn(server, server.address().port);
  });
};

request = require('superagent');

writeRes = function (res, body, status) {
  res.writeHead(status || 200, {'Content-Type': 'text/plain; charset=utf-8'});
  res.end(body);
};

assertRes = function (res, body, status) {
  assert.equal(res.statusCode, status || 200);
  assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
  assert.equal(res.text, body);
};