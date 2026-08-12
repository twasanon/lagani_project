import http from 'node:http';

const upstreamPort = Number(process.env.EXPO_WEB_PORT ?? 8082);
const listenPort = Number(process.env.PREVIEW_PORT ?? 8083);

const server = http.createServer((request, response) => {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: upstreamPort,
    path: request.url,
    method: request.method,
    headers: request.headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, {
      ...upstreamResponse.headers,
      'cross-origin-embedder-policy': 'credentialless',
      'cross-origin-opener-policy': 'same-origin',
    });
    upstreamResponse.pipe(response);
  });
  upstream.on('error', (error) => {
    response.writeHead(502, { 'content-type': 'text/plain' });
    response.end(`Expo web server is unavailable: ${error.message}`);
  });
  request.pipe(upstream);
});

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`Lagani web preview: http://localhost:${listenPort}`);
});
