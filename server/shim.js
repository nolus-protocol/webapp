if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = {
    getItem(_key) {
      return null;
    },
    setItem(_key, _value) {
      // no-op
    },
    removeItem(_key) {
      // no-op
    },
    clear() {
      // no-op
    },
    key(_index) {
      return null;
    },
    get length() {
      return 0;
    }
  };
}

if (typeof globalThis.window === "undefined") {
  const perf = {
    now: () => Date.now()
  };
  const noop = () => {};

  globalThis.window = {
    // common things code might call
    addEventListener: noop,
    removeEventListener: noop,
    performance: perf,
    location: {
      search: ""
    }
  };
}
