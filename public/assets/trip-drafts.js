let connection;
let writes = Promise.resolve();
function database() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('moykm-trips', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts', {keyPath: 'key'});
      request.result.createObjectStore('points');
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = null; };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  }).catch(error => { connection = null; throw error; });
  return connection;
}
const pointKeys = key => IDBKeyRange.bound([key, 0], [key, Infinity]);
const accountKeys = prefix => IDBKeyRange.bound(prefix, prefix + '\uffff');
const accountPoints = prefix => IDBKeyRange.bound([prefix, 0], [prefix + '\uffff', Infinity]);
async function transaction(mode, work) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['drafts', 'points'], mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error('Черновик изменён в другой вкладке.'));
    work(tx.objectStore('drafts'), tx.objectStore('points'), value => { result = value; }, tx);
  });
}
function write(work) {
  const job = writes.then(() => transaction('readwrite', work));
  writes = job.catch(() => {});
  return job;
}
export async function readTripDraft(key, withPoints = true) {
  await writes;
  return transaction('readonly', (drafts, points, done) => {
    const metadata = drafts.get(key);
    metadata.onsuccess = () => {
      if (!metadata.result || !withPoints) {
        done(metadata.result);
        return;
      }
      const request = points.getAll(pointKeys(key));
      request.onsuccess = () => done({...metadata.result, points: request.result.flat()});
    };
  });
}
export function writeTripDraft(key, metadata, from, newPoints, revision) {
  return write((drafts, points, done, tx) => {
    const current = drafts.get(key);
    current.onsuccess = () => {
      if ((current.result?.revision ?? 0) !== revision) {
        tx.abort();
        return;
      }
      if (from === 0) points.delete(pointKeys(key));
      for (let i = 0; i < newPoints.length; i += 128) {
        points.put(newPoints.slice(i, i + 128), [key, from + i]);
      }
      drafts.put({...metadata, key, revision: revision + 1});
      done(revision + 1);
    };
  });
}
export function deleteTripDraft(key) {
  return write((drafts, points) => { drafts.delete(key); points.delete(pointKeys(key)); });
}
export function deleteAccountDrafts(prefix) {
  return write((drafts, points) => { drafts.delete(accountKeys(prefix)); points.delete(accountPoints(prefix)); });
}
