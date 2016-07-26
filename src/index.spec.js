import chai from 'chai';
import 'regenerator-runtime/runtime';

import RethinkDBDashDriver from './index';

const should = chai.should();

const host = process.env.RETHINKDB_HOST || '127.0.0.1';
const port = process.env.RETHINKDB_PORT || 28015;

const r = require('rethinkdbdash')({
  db: "test",
  servers: [ { host, port } ]
});

async function freshUserTable() {
  try {
    await r.tableDrop('users').run();
  } catch (err) {
    if (err.msg !== 'Table `test.users` does not exist.')
      throw err;
  }

  try {
    await r.tableCreate('users').run();
  } catch (err) {
    if (err.msg !== 'Table `test.users` already exists.')
      throw err;
  }
}

async function populateUserTable() {
  await r.table('users').insert([
    {
      id: "sheppard",
      emails: [
        { address: "sheppard@atlantis.net" }
      ]
    },
    {
      id: "mckay",
      emails: [
        { address: "mckay@atlantis.net"}
      ]
    }
  ]).run();
}

describe('apollo-passport-rethinkdbdash', () => {

  const db = new RethinkDBDashDriver(r);

  describe('createUser()', () => {

    it('inserts a user and returns the id', async () => {
      await freshUserTable();

      const user = { name: 'John Sheppard' };
      const id = await db.createUser(user);

      const users = await db.users.run();
      const added = users[0];

      added.name.should.equal(user.name);
      id.should.equal(added.id);
    });

  });

  describe('fetchUserByEmail()', () => {

    before(async () => {
      await freshUserTable();
      await populateUserTable();
    });

    it('returns a matching user if one exists', async () => {
      const user = await db.fetchUserByEmail('mckay@atlantis.net');
      user.id.should.equal("mckay");
    });

  });

});