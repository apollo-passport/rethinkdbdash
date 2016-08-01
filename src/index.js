import 'regenerator-runtime/runtime';

class RethinkDBDashDriver {

  /*
   *
   */
  constructor(r, options = {}) {
    this.r = r;
    this.userTableName = options.userTableName || 'users';
    this.configTableName = options.configTalbeName || 'apolloPassportConfig';
    this.dbName = options.dbName || r._db;
    this.db = r.db(this.dbName);

    // don't await the init, run async
    if (options.init !== false)
      this.init();
  }

  async init() {
    await this._assertTableExists(this.userTableName);
    this.users = this.db.table(this.userTableName);

    await this._assertTableExists(this.configTableName);
    this.config = this.db.table(this.configTableName);

    await this.fetchConfig.bind(this);
    this.initted = true;
  }

  ready() {
    return new Promise((resolve) => {
      if (this.initted) {
        this.ready = function() {};
        return resolve();
      }

      const interval = setInterval(() => {
        if (this.initted) {
          this.ready = function() {};
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  /* --- general db --- */

  async _assertTableExists(name) {
    try {
      await this.db.tableCreate(name).run();
    } catch (err) {
      if (err.msg !== `Table \`${this.dbName}.${name}\` already exists.`) {
        throw err;
      }
    }
  }

  /* --- config --- */

  /*
   * Retrieves _all_ configuration from the database and returns as a nested
   * dictionary arranged by type, i.e.
   * 
   *   {
   *     service: {
   *       facebook: { ... data ... }
   *     }
   *   }
   */
  async fetchConfig() {
    // This is called as part of init(), so no need to await this.ready();
    const results = await this.config.run();
    const out = {};

    results.forEach(row => {
      if (!out[row.type])
        out[row.type] = {};

      out[row.type][row.id] = row;
    });

    return out;
  }

  /*
   * Creates or updates the key with the given value.
   * NoSQL databases can store the destructured value as part of the record.
   * Fixed-schema databases should JSON-encode the 'value' column.
   */
  async setConfigKey(type, id, value) {
    await this.ready();
    await this.config.insert({ type, id, ...value });
  }

  /* --- users --- */

  /*
   * Given a user record, save it to the database, and return its given id.
   * NoSQL databases should store the entire object, schema-based databases
   * should honor the 'emails' and 'services' keys and store as necessary
   * in another table.
   */
  async createUser(user) {
    await this.ready();
    let id = user.id;

    const result = await this.users.insert(user);

    if (!id)
      id = result.generated_keys[0];

    return id;
  }

  /*
   * Given a single "email" param, returns the matching user record if one
   * exists, or null, otherwise.
   */
  async fetchUserByEmail(email) {
    await this.ready();

    const results = await this.users
      .filter(this.r.row('emails').contains(row => row('address').eq(email)))
      .limit(1)
      .run();

    return results[0] || null;
  }

  async fetchUserByServiceIdOrEmail(service, id, email) {
    await this.ready();

    const results = await this.users.filter(
      this.r.or(
        this.r.row('services')(service)('id').eq(id).default(false),
        this.r.row('emails').contains({ address: email }).default(false)
      )
    ).limit(1).run();

    return results[0] || null;
  }

  async assertUserEmailData(userId, email, data) {
    await this.ready();

    await this.users.get(userId).update(row => ({
      emails: row('emails').default([])
        .filter(row('emails').default([]).contains({ address: email }).not())
        .append({ address: email, ...data })
    }));
  }

  async assertUserServiceData(userId, service, data) {
    await this.ready();
    await this.users.get(userId).update({ services: { [service]: data } });
  }

  mapUserToServiceData(user, service) {
    return user && user.services && user.services[service];
  }
}

export default RethinkDBDashDriver;
