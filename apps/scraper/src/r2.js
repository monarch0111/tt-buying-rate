import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { BANKS, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } from './config.js';

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const HISTORY_PREFIX = 'history/';
const BANKS_PREFIX = 'banks/';
const LATEST_KEY = 'latest.json';

async function putJSON(key, data) {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  }));
}

async function getJSON(key) {
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }));
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (err) {
    if (err.name === 'NoSuchKey') return null;
    throw err;
  }
}

async function listKeys(prefix) {
  const keys = [];
  let continuationToken;
  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of response.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  return keys;
}

export async function saveSnapshot(bankId, rates, scrapedAt) {
  const date = new Date(scrapedAt);
  const timeStr = date.toISOString().replace(/[:.]/g, '-');

  const bankConfig = BANKS[bankId];
  const snapshot = {
    meta: {
      scrapedAt,
      bank: bankId,
      bankDisplay: bankConfig?.name || bankId,
      sourceUrl: bankConfig?.url || '',
      version: '1.0',
    },
    rates,
  };

  await putJSON(`${HISTORY_PREFIX}${bankId}/${timeStr}.json`, snapshot);
  await putJSON(`${HISTORY_PREFIX}${bankId}/latest.json`, snapshot);

  console.log(`[R2] Saved snapshot for ${bankId}`);
}

export async function buildLatestAggregate() {
  const banks = {};
  let latestTime = new Date(0).toISOString();

  for (const bankId of Object.keys(BANKS)) {
    const data = await getJSON(`${HISTORY_PREFIX}${bankId}/latest.json`);
    if (data) {
      banks[bankId] = {
        lastUpdated: data.meta.scrapedAt,
        rates: data.rates,
      };
      if (data.meta.scrapedAt > latestTime) {
        latestTime = data.meta.scrapedAt;
      }
    }
  }

  const aggregate = { updatedAt: latestTime, banks };
  await putJSON(LATEST_KEY, aggregate);
  console.log(`[R2] Built latest.json (${Object.keys(banks).length} banks)`);
}

export async function buildBankFile(bankId) {
  const data = await getJSON(`${HISTORY_PREFIX}${bankId}/latest.json`);
  if (!data) return;

  await putBankFile(bankId, data);
  console.log(`[R2] Built banks/${bankId}.json`);
}

async function putBankFile(bankId, snapshot) {
  await putJSON(`${BANKS_PREFIX}${bankId}.json`, {
    lastUpdated: snapshot.meta.scrapedAt,
    rates: snapshot.rates,
  });
}

async function updateHistoryFilesFromSnapshot(bankId, snapshot) {
  const updates = Object.entries(snapshot.rates || {}).map(async ([currency, rate]) => {
    const key = `${HISTORY_PREFIX}${bankId}/${currency}.json`;
    const existing = await getJSON(key);
    const day = snapshot.meta.scrapedAt.substring(0, 10);
    const points = Array.isArray(existing?.points)
      ? existing.points.filter((point) => point.date.substring(0, 10) !== day)
      : [];

    points.push({
      date: snapshot.meta.scrapedAt,
      rate: rate.ttBuying,
      unit: rate.unit,
    });
    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    await putJSON(key, {
      bank: bankId,
      currency,
      points,
    });
  });

  await Promise.all(updates);
  console.log(`[R2] Updated ${updates.length} history files for ${bankId}`);
}

export async function buildAllHistoryFiles(bankId) {
  const data = await getJSON(`${HISTORY_PREFIX}${bankId}/latest.json`);
  if (!data) return;

  const currencies = Object.keys(data.rates);
  const keys = await listKeys(`${HISTORY_PREFIX}${bankId}/`);

  const currencyMap = {};
  for (const c of currencies) currencyMap[c] = [];

  for (const key of keys) {
    if (key.endsWith('latest.json')) continue;
    if (!key.endsWith('.json')) continue;

    const snap = await getJSON(key);
    if (!snap?.rates) continue;

    for (const c of currencies) {
      if (snap.rates[c]) {
        currencyMap[c].push({
          date: snap.meta.scrapedAt,
          rate: snap.rates[c].ttBuying,
          unit: snap.rates[c].unit,
        });
      }
    }
  }

  for (const [currency, points] of Object.entries(currencyMap)) {
    if (points.length === 0) continue;

    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const seen = new Set();
    const deduped = [];
    for (let i = points.length - 1; i >= 0; i--) {
      const day = points[i].date.substring(0, 10);
      if (!seen.has(day)) {
        seen.add(day);
        deduped.push(points[i]);
      }
    }
    deduped.reverse();

    await putJSON(`${HISTORY_PREFIX}${bankId}/${currency}.json`, {
      bank: bankId,
      currency,
      points: deduped,
    });
  }
  console.log(`[R2] Built ${Object.keys(currencyMap).length} history files for ${bankId}`);
}

export async function buildAllReadOptimizedFiles(bankId) {
  const data = await getJSON(`${HISTORY_PREFIX}${bankId}/latest.json`);
  if (!data) return;

  await putBankFile(bankId, data);
  console.log(`[R2] Built banks/${bankId}.json`);
  await updateHistoryFilesFromSnapshot(bankId, data);
  await buildLatestAggregate();
}
