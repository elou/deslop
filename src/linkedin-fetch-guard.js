(function guardLinkedInExtensionProbe(global) {
  const pageWindow = global?.window;
  const nativeFetch = pageWindow?.fetch;
  if (typeof nativeFetch !== 'function' || nativeFetch.__deSlopLinkedInProbeGuard) return;

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  function guardedFetch(input, init) {
    let url = '';
    try {
      url = requestUrl(input);
    } catch {
      // Delegate malformed inputs to the native implementation unchanged.
    }
    if (url === 'chrome-extension://invalid/' || url === 'chrome-extension://invalid') {
      return Promise.reject(new TypeError('De-Slop blocked a LinkedIn extension probe'));
    }
    return nativeFetch.apply(this, arguments);
  }

  Object.defineProperty(guardedFetch, '__deSlopLinkedInProbeGuard', {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false
  });
  pageWindow.fetch = guardedFetch;
})(globalThis);
