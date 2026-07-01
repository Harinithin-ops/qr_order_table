const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.href;
  } else if (input && typeof input === 'object' && 'url' in input) {
    url = (input as Request).url;
  }

  const isRelative = !url.startsWith('http://') && !url.startsWith('https://');
  const isSameOrigin = url.startsWith(window.location.origin);

  // Only intercept relative or same-origin API calls
  if ((isRelative || isSameOrigin) && url.includes('/api/')) {
    const token = localStorage.getItem('authToken');
    
    if (token) {
      init = init || {};
      const headersObj: Record<string, string> = {};
      
      if (init.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]) => {
            headersObj[key] = value;
          });
        } else {
          Object.assign(headersObj, init.headers);
        }
      } else if (input && typeof input === 'object' && 'headers' in input) {
        // If input is a Request object, extract its headers
        try {
          const req = input as Request;
          req.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
        } catch (e) {
          // Ignore
        }
      }
      
      // Attach the authorization header if not present
      const hasAuth = Object.keys(headersObj).some(k => k.toLowerCase() === 'authorization');
      if (!hasAuth) {
        headersObj['Authorization'] = `Bearer ${token}`;
      }
      
      init.headers = headersObj;
    }
  }

  return originalFetch(input, init);
};

export {};
