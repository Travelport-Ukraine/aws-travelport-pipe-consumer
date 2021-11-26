/* eslint-disable no-console */
import { env } from 'process';
import http from 'http';
import zlib from 'zlib';
import cluster from 'cluster';
import { nanoid } from 'nanoid';
import { promisify } from 'util';
import os from 'os';
import AWS from 'aws-sdk';

const DEFAULT_PORT = 8080;

const numCPUs = os.cpus().length;
const brotliDecompress = promisify(zlib.brotliDecompress);
const gzipCompress = promisify(zlib.gzip);

const s3 = new AWS.S3();

function saveRequestToS3(request) {
  const id = nanoid();
  const market = request.headers['x-point-of-sale'];

  const headersParams = {
    Bucket: env.S3_WORK_BUCKET,
    Key: `${market}/headers/${id}.json`,
    Body: JSON.stringify(request.headers, null, 2),
  };

  // Uploading headers to the bucket
  s3.upload(headersParams, (err) => {
    if (err) {
      throw err;
    }
  });

  const dataParams = {
    Bucket: env.S3_WORK_BUCKET,
    Key: `${market}/data/${id}.gz`,
    Body: request.gzipBody,
  };

  // Uploading headers to the bucket
  s3.upload(dataParams, (err) => {
    if (err) {
      throw err;
    }
  });
}

async function process(data) {
  const {
    body,
    headers,
  } = data;

  try {
    const decompressedBody = await brotliDecompress(body);
    const gzipBody = await gzipCompress(decompressedBody);
    saveRequestToS3({
      headers,
      gzipBody,
    });
  } catch (err) {
    console.error('Processing is failed!', err);
  }
}

function handle(req, res) {
  const {
    host,
    ...headers
  } = req.headers;

  const chunks = [];

  // Collect chunks
  req.on('data', (chunk) => chunks.push(chunk));

  // Send response on end BEFORE processing starts
  req.on('end', () => {
    // Providing response
    res.writeHead(200);
    res.end();

    // Starting processing
    const body = Buffer.concat(chunks);
    process({
      body,
      headers,
    });
  });
}

if (cluster.isPrimary) {
  // Starting cluster
  console.log(`Stream consumer started with ${numCPUs} threads\n`);

  // Fork workers
  Array.from(Array(numCPUs)).forEach(() => {
    cluster.fork();
  });

  cluster.on('exit', (worker) => {
    console.warn(`worker ${worker.process.pid} died. Forking new one.`);
    cluster.fork();
  });
} else {
  // Processing data here

  const server = http.createServer((req, res) => {
    req.on('error', (err) => {
      console.error('Request err', err);
      res.end(err);
    });

    res.on('error', (err) => {
      console.error('Response error', err);
    });

    switch (req.url) {
      case '/':
        if (req.method === 'POST') {
          handle(req, res);
        } else {
          res.writeHead(405, 'Method Not Allowed');
          res.end();
        }
        break;
      case '/status':
        if (req.method === 'GET') {
          res.writeHead(200, 'Service is totally alive');
          res.end();
        } else {
          res.writeHead(405, 'Use GET to check status');
          res.end();
        }
        break;
      default:
        res.writeHead(404, 'Not Found');
        res.end();
    }
  });

  server.on('error', (err) => {
    console.error('Server error', err);
  });

  server.listen(DEFAULT_PORT);
}
