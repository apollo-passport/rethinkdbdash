const host = process.env.RETHINKDB_HOST || '127.0.0.1';
const port = process.env.RETHINKDB_PORT || 28015;

const r = require('rethinkdbdash')({
  servers: [ { host, port } ]
});

r.dbList().run().then(allDatabases => {
  const dbs = allDatabases.filter(db => db.match(/^tmp/));
  console.log(`Deleting ${dbs.length} "tmp" databases`);

  Promise.all(dbs.map(db => r.dbDrop(db)))
    .then(() => {
      console.log('Done');
      r.getPoolMaster().drain()
    });
});
