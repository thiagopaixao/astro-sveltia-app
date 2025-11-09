const Module = require('module');
const spies = new Set();
const moduleMocks = new Map();
const mockedModuleKeys = new Set();
const originalLoad = Module._load;

function getMockKey(request, parentModule) {
  try {
    return Module._resolveFilename(request, parentModule || module.parent);
  } catch (error) {
    return request;
  }
}

Module._load = function patchedModuleLoad(request, parent, isMain) {
  const key = getMockKey(request, parent);
  if (moduleMocks.has(key)) {
    return moduleMocks.get(key);
  }
  return originalLoad.call(this, request, parent, isMain);
};

function createMockFn(defaultImpl) {
  const implQueue = [];
  const mockFn = function mockFn(...args) {
    mockFn.mock.calls.push(args);

    if (implQueue.length > 0) {
      const queued = implQueue.shift();
      return queued.apply(this, args);
    }

    if (mockFn.mockImpl) {
      return mockFn.mockImpl.apply(this, args);
    }

    if (typeof defaultImpl === 'function') {
      return defaultImpl.apply(this, args);
    }

    return undefined;
  };

  mockFn.mock = { calls: [] };
  mockFn.mockImpl = defaultImpl;

  mockFn.mockClear = () => {
    mockFn.mock.calls = [];
  };

  mockFn.mockReset = () => {
    mockFn.mockClear();
    mockFn.mockImpl = defaultImpl;
    implQueue.length = 0;
  };

  mockFn.mockImplementation = (implementation) => {
    mockFn.mockImpl = implementation;
    return mockFn;
  };

  mockFn.mockImplementationOnce = (implementation) => {
    implQueue.push(implementation);
    return mockFn;
  };

  mockFn.mockReturnValue = (value) => mockFn.mockImplementation(() => value);

  mockFn.mockReturnValueOnce = (value) => mockFn.mockImplementationOnce(() => value);

  mockFn.mockResolvedValue = (value) => mockFn.mockImplementation(() => Promise.resolve(value));

  mockFn.mockResolvedValueOnce = (value) => mockFn.mockImplementationOnce(() => Promise.resolve(value));

  mockFn.mockRejectedValue = (error) => mockFn.mockImplementation(() => Promise.reject(error));

  mockFn.mockRejectedValueOnce = (error) => mockFn.mockImplementationOnce(() => Promise.reject(error));

  spies.add(mockFn);

  return mockFn;
}

function mockModule(request, factory, options = {}) {
  const parentModule = options.parentModule || module.parent;
  const key = getMockKey(request, parentModule);
  const exports = factory();
  moduleMocks.set(key, exports);
  mockedModuleKeys.add(key);
  delete require.cache[key];
  return exports;
}

function clearAllMocks() {
  for (const spy of spies) {
    spy.mockClear();
  }
}

function resetAllMocks() {
  for (const spy of spies) {
    if (typeof spy.mockReset === 'function') {
      spy.mockReset();
    }
  }
}

function restoreAllMocks() {
  moduleMocks.clear();
  for (const key of mockedModuleKeys) {
    delete require.cache[key];
  }
  mockedModuleKeys.clear();
}

function spyOn(target, property, implementation) {
  const original = target[property];
  const spy = createMockFn(typeof implementation === 'function' ? implementation : original);
  target[property] = spy;
  spy.restore = () => {
    target[property] = original;
  };
  spies.add(spy);
  return spy;
}

const vi = {
  fn: createMockFn,
  mock: (request, factory, options) => mockModule(request, factory, options),
  mockModule,
  clearAllMocks,
  resetAllMocks,
  restoreAllMocks,
  spyOn
};

module.exports = {
  vi,
  createMockFn,
  mockModule,
  clearAllMocks,
  resetAllMocks,
  restoreAllMocks,
  spyOn
};
