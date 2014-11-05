describe('runner', function () {
  var runner;
  it('create runner', function () {
    runner = bladerunner()
      .use(function (req, res, next) {
        res.lines = [];
        next();
      })
      .use('/alcohol/*', function (req, res, next) {
        assert.deepEqual(req.params, ['bud']);
        assert.deepEqual(req.query, {lite: 'true'});
        res.lines.push('alcohol');
        next();
      })
      .use('/fruit/*', function (req, res, next) {
        res.lines.push('fruit');
        next();
      })
      .use('/fruit/banana', function (req, res, next) {
        res.lines.push('banana');
        next();
      })
      .add('/alcohol/*', '/fruit/*', function (req, res, next) {
        res.status = res.lines.join(' ');
        next();
      })
      .add(function (req, res, next) {
        if (!res.status) res.status = 'not found';
        next();
      })
  });
  it('alcohol', function (done) {
    runner.run('/alcohol/bud?lite=true', function (err, res) {
      assert.ifError(err);
      assert.equal(res.status, 'alcohol');
      done();
    });
  });
  it('apple', function (done) {
    runner.run('/fruit/apple', function (err, res) {
      assert.ifError(err);
      assert.equal(res.status, 'fruit');
      done();
    });
  });
  it('banana', function (done) {
    runner.run('/fruit/banana', function (err, res) {
      assert.ifError(err);
      assert.equal(res.status, 'fruit banana');
      done();
    });
  });
  it('orange', function (done) {
    runner.run('/orange', function (err, res) {
      assert.ifError(err);
      assert.equal(res.status, 'not found');
      done();
    });
  });
});
