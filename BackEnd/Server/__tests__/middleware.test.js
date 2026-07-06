const { requireRole } = require('../../DBMS/middleware/auth');
const corsMiddleware = require('../../DBMS/middleware/cors');

describe('auth middleware requireRole', () => {
  const makeRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = jest.fn(code => {
      res.statusCode = code;
      return res;
    });
    res.json = jest.fn(body => {
      res.body = body;
      return res;
    });
    return res;
  };

  test('rejects when X-Role header missing', () => {
    const mw = requireRole(['admin']);
    const req = { header: () => null };
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows mapped admin role', () => {
    const mw = requireRole(['admin']);
    const req = {
      header: name => (name === 'X-Role' ? 'system_admin' : null),
    };
    const res = makeRes();
    const next = jest.fn();

    mw(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.context.role).toBe('admin');
    expect(next).toHaveBeenCalled();
  });
});

describe('corsMiddleware', () => {
  const makeRes = () => {
    const headers = {};
    return {
      headers,
      setHeader: (k, v) => {
        headers[k] = v;
      },
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };
  };

  test('sets CORS headers for allowed origin', () => {
    const req = { headers: { origin: 'http://localhost:3000' }, method: 'GET' };
    const res = makeRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(next).toHaveBeenCalled();
  });

  test('responds to OPTIONS with 204', () => {
    const req = { headers: { origin: 'http://localhost:3000' }, method: 'OPTIONS' };
    const res = makeRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});




