import chai from 'chai';
import sinon from 'sinon';
import 'regenerator-runtime/runtime';
import _ from 'lodash';

import rethinkdbdash from 'rethinkdbdash';
import RethinkDBDashDriver from './index';

const should = chai.should();

const host = "172.17.0.2";
//const host = process.env.RETHINKDB_HOST || '127.0.0.1';
const port = process.env.RETHINKDB_PORT || 28015;

const connection = rethinkdbdash({
  servers: [ { host, port } ],
  db: 'no-default-database-for-testing'
});

// not really disposable, no way to get an instance with a different
// database, too expensive to open new connection for each test, but
// this will still work as "intended" for single thread tests.
async function disposable() {
  const name = "tmp" + Math.floor(Math.random() * 10000);
  await connection.dbCreate(name).run();

  const r = Object.create(connection);

  r.dispose = async function() {
    await this.dbDrop(name).run();
  };

  r._db = name;

  return r;
}

describe('apollo-passport-rethinkdbdash', () => {

  let r;
  before(async () => { r = await disposable(); });
  after(async () => { await r.dispose(); });

  describe('constructor()', () => {

    it('stores r', async () => {
    });

    it('has defaults', async () => {
    });

    it('accepts options to ovveride defaults', async () => {
    });

  });

  it('config; database & local output', async () => {

    const r = await disposable();
    const db = new RethinkDBDashDriver(r);

    await db.setConfigKey('test', 'test1', { a: 1 });
    const data = await db.fetchConfig();

    data.should.deep.equal({
      test: {
        test1: {
          type: 'test',
          id: 'test1',
          a: 1          
        }
      }
    });

    await r.dispose();

  });

  describe('users', () => {

    describe('createUser()', () => {

      it('inserts a user and returns the id when no id given', async () => {
        const db = new RethinkDBDashDriver(r);
        await db.ready();
        await db.users.delete({ durability: 'soft' });

        const user = { name: 'John Sheppard' };
        const id = await db.createUser(user);

        const users = await db.users.run();
        const added = users[0];

        added.name.should.equal(user.name);
        id.should.equal(added.id);

        await db.users.delete({ durability: 'soft' });
      });

      it('inserts a user and returns the id when an id is given', async () => {
        const db = new RethinkDBDashDriver(r);
        await db.ready();
        await db.users.delete({ durability: 'soft' });

        const user = { id: 'sheppard', name: 'John Sheppard' };
        const id = await db.createUser(user);

        const users = await db.users.run();
        const added = users[0];

        added.name.should.equal(user.name);
        id.should.equal(added.id);

        await db.users.delete({ durability: 'soft' });
      });

    });

    describe('fetching', () => {

      let r, db;
      before(async () => {
        r = await disposable();
        db = new RethinkDBDashDriver(r);
        await db.ready();
   
        await db.users.insert([
          {
            id: "sheppard",
            emails: [
              { address: "sheppard@atlantis.net" }
            ],
            services: {
              facebook: {
                id: "1"
              }
            }
          },
          {
            id: "mckay",
            emails: [
              { address: "mckay@atlantis.net"}
            ]
          }
        ]).run();
      });
      after(async () => { r.dispose(); });

      describe('fetchUserByEmail()', () => {

        it('returns a matching user if one exists', async () => {
          const user = await db.fetchUserByEmail('mckay@atlantis.net');
          user.id.should.equal("mckay");
        });

        it('returns null on no match', async () => {
          const user = await db.fetchUserByEmail('non-existing-email');
          should.equal(user, null);
        });

      });

      describe('fetchUserByServiceOrEmail', async () => {

        it('matches by email', async () => {
          const user = await db.fetchUserByServiceOrEmail('mckay@atlantis.net', 'facebook', "no-match");
          user.id.should.equal("mckay");
        });

        it('matches by service', async () => {
          const user = await db.fetchUserByServiceOrEmail('non-matching-email', 'facebook', "1");
          user.id.should.equal("sheppard");
        });

        it('should return null on no match', async () => {
          const user = await db.fetchUserByServiceOrEmail('no-email', 'no-service', 'no-id');
          should.equal(user, null);
        });

      });

    });

  });

});