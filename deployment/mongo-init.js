// Authenticated one-shot initializer. Retry container while mongod bootstraps.
try {
  rs.status();
} catch (error) {
  if (error.code !== 94 && error.codeName !== 'NotYetInitialized') throw error;
  rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongo:27017' }] });
}
let primary = false;
for (let attempt = 0; attempt < 60; attempt++) {
  if (db.hello().isWritablePrimary) { primary = true; break; }
  sleep(1000);
}
if (!primary) throw new Error('Replica set did not elect a primary');
