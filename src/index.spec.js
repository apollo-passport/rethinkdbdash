import chai from 'chai';
import sinon from 'sinon';
import util from 'util';
import 'regenerator-runtime/runtime';

import rethinkdbdash from 'rethinkdbdash';
import RethinkDBDashDriver from './index';

const should = chai.should();

const host = process.env.RETHINKDB_HOST || '127.0.0.1';
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

  r._poolMaster._options.db = name;

  return r;
}

describe('apollo-passport-rethinkdbdash', () => {

  // sufficiently tested by other tests for now
  describe('constructor()', () => {

    it('accepts options', () => {
      const r = { db() {} };
      const options = {
        init: false,
        userTableName: 'personnel'
      };

      const db = new RethinkDBDashDriver(r, options);

      db.userTableName.should.equal(options.userTableName);
    });

  });

  it('ready()', async () => {
    const r = await disposable();
    const db = new RethinkDBDashDriver(r);
    const origDbReady = db.ready;
    await db.ready();

    // now do a fake init
    db.initted = false;
    db.readySubs.length.should.equal(0);
    let p = db.ready();
    db.readySubs.length.should.equal(1);
    db.readySubs.shift().call();

    db.initted = true;
    db.readySubs.length.should.equal(0);
    p = db.ready();
    db.readySubs.length.should.equal(0);

    await r.dispose();
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

      let r;
      before(async () => { r = await disposable(); });
      after(async () => { await r.dispose(); });

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

      const users = [
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
      ];

      let r, db;
      before(async () => {
        r = await disposable();
        db = new RethinkDBDashDriver(r);
        await db.ready();
        await db.users.insert(users).run();
      });
      after(async () => { r.dispose(); });

      describe('fetchUserById', () => {

        it('returns a matching user if one exists', async () => {
          const user = await db.fetchUserById('sheppard');
          user.id.should.equal("sheppard");
        });

        it('returns null on no match', async () => {
          const user = await db.fetchUserById('todd');
          should.equal(user, null);
        });

      });

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

      describe('fetchUserByServiceIdOrEmail()', () => {

        it('matches by email', async () => {
          const user = await db.fetchUserByServiceIdOrEmail('facebook', "no-match", 'mckay@atlantis.net');
          user.id.should.equal("mckay");
        });

        it('matches by service', async () => {
          const user = await db.fetchUserByServiceIdOrEmail('facebook', "1", 'non-matching-email');
          user.id.should.equal("sheppard");
        });

        it('should return null on no match', async () => {
          const user = await db.fetchUserByServiceIdOrEmail('no-service', 'no-id', 'no-email');
          should.equal(user, null);
        });

      });

      describe('assertUserEmailData()', () => {

        it('adds a new email address', async () => {
          await db.assertUserEmailData('mckay', 'mckay@sgc.mil');

          const user = await db.fetchUserByEmail('mckay@sgc.mil');
          should.exist(user);
        });

        it('updates/replaces an existing email address + data', async () => {
          const email = 'mckay@atlantis.net';
          await db.assertUserEmailData('mckay', email, { verified: true });

          const user = await db.fetchUserByEmail(email);
          const data = user.emails.find(data => data.address === email);
          data.should.deep.equal({ address: email, verified: true });
        });

      });

      describe('assertUserServiceData()', () => {

        it('adds a new service record', async () => {
          await db.assertUserServiceData('mckay', 'facebook', { id: '5' });

          const user = await db.fetchUserByServiceIdOrEmail('facebook', '5', null);
          user.services.facebook.id.should.equal('5');
        });

        it('updates/replaces an existing service record', async () => {
          await db.assertUserServiceData('mckay', 'facebook', { id: '5' });

          const user = await db.fetchUserByServiceIdOrEmail('facebook', '5', null);
          user.services.facebook.id.should.equal('5');
        });

      });

      it('mapUserToServiceData', () => {
        const fb = db.mapUserToServiceData(users[0], 'facebook');
        fb.should.deep.equal(users[0].services.facebook);
      });

    });

  });

});
