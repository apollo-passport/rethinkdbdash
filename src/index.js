import 'regenerator-runtime/runtime';

/** Class implementing the Apollo Passport DBDriver interface */
class RethinkDBDashDriver {

  /**
   * Returns a DBDriver instance (for use by Apollo Passport).  Parameters are
   * driver-specific and should be clearly specificied in the README.
   * This documents the RethinkDBDash DBDriver specifically, although some
   * *options* are relevant for all drivers.
   *
   * @param {rethinkdbdash} r, e.g. var r = require('rethinkdbdash')();
   *
   * @param {string} options.userTableName    default: 'users'
   * @param {string} options.configTableName  default: 'apolloPassportConfig'
   * @param {string} options.dbName           default: current database
   */
  constructor(r, options = {}) {
    this.r = r;
    this.userTableName = options.userTableName || 'users';
    this.configTableName = options.configTableName || 'apolloPassportConfig';
    this.dbName = options.dbName || (r._poolMaster && r._poolMaster._options.db);
    this.db = r.db(this.dbName);
    this.readySubs = [];

    // don't await the init, run async
    if (options.init !== false)
      this._init();
  }

  /**
   * Internal method, documented for benefit of driver authors.  Most important
   * is to call fetchConfig() (XXX unfinished), but may also assert that all
   * tables exist, and run ready callbacks.
   */
  async _init() {
    await this._assertTableExists(this.userTableName);
    this.users = this.db.table(this.userTableName);

    await this._assertTableExists(this.configTableName);
    this.config = this.db.table(this.configTableName);

    this.initted = true;

    while(this.readySubs.length)
      this.readySubs.shift().call();
  }

  /**
   * Internal method, documented for benefit of driver authors.  An awaitable
   * promise that returns if the driver is ready (or when it becomes ready).
   */
  _ready() {
    return new Promise((resolve) => {
      if (this.initted)
        resolve();
      else
        this.readySubs.push(resolve);
    });
  }

  //////////////////
  // DB UTILITIES //
  //////////////////

  /**
   * Internal method, documented for benefit of driver authors.  Asserts (and
   * awaits) that the given table name exists.  This is a convenience for the
   * user but with RethinkDB **there is no safe way to do this** other than
   * creating the table in advance (outside of the app).  It's fine if the
   * table is created with only one app instance running, which is usually
   * the case for initial setup.
   *
   * @param {string} name - the name of the table to assert
   */
  async _assertTableExists(name) {
    try {
      await this.db.tableCreate(name).run();
    } catch (err) {
      if (err.msg !== `Table \`${this.dbName}.${name}\` already exists.`) {
        throw err;
      }
      // XXX give a warning about the caveat in the docs above.
    }
  }

  //////////////////
  // CONFIG TABLE //
  //////////////////

  /**
   * Retrieves _all_ configuration from the database.
   * @return {object} A nested dictionary arranged by type, i.e.
   *
   * ```js
   *   {
   *     service: {          // type
   *       facebook: {       // id
   *         ...data         // value (de-JSONified if from non-document DB)
   *       }
   *     }
   *   }
   * ```
   */
  async fetchConfig() {
    await this._ready();

    const results = await this.config.run();
    const out = {};

    results.forEach(row => {
      if (!out[row.type])
        out[row.type] = {};

      out[row.type][row.id] = row;
    });

    return out;
  }

  /**
   * Creates or updates the key with the given value.
   * NoSQL databases can store the destructured value as part of the record.
   * Fixed-schema databases should JSON-encode the 'value' column.
   *
   * @param {string} type  - e.g. "service"
   * @param {string} id    - e.g. "facebook"
   * @param {object} value - e.g. { id: 1, ...profile }
   */
  async setConfigKey(type, id, value) {
    await this._ready();
    await this.config.insert({ type, id, ...value });
  }

  ///////////
  // USERS //
  ///////////

  /**
   * Given a user record, save it to the database, and return its given id.
   * NoSQL databases should store the entire object, schema-based databases
   * should honor the 'emails' and 'services' keys and store as necessary
   * in another table.
   *
   * @param {object} user
   *
   * {
   *   emails: [ { address: "me@me.com" } ],
   *   services: [ { facebook: { id: 1, ...profile } } ]
   *   ...anyOtherDataForUserRecordAtCreationTimeFromAppHooks
   * }
   *
   * @return {string} the id of the inserted user record
   */
  async createUser(user) {
    await this._ready();
    let id = user.id;

    const result = await this.users.insert(user);

    if (!id)
      id = result.generated_keys[0];

    return id;
  }

  /**
   * Fetches a user record by id.  Schema-based databases should merge
   * appropriate user-data from e.g. `user_emails` and `user_services`.
   *
   * @param {string} id - the user record's id
   *
   * @return {object} user object in the same format expected by
   *   {@link RethinkDBDashDriver#createUser}, or *null* if none found.
   */
  async fetchUserById(userId) {
    await this._ready();
    return this.users.get(userId).run();
  }

  /**
   * Given a single "email" param, returns the matching user record if one
   * exists, or null, otherwise.
   *
   * @param {string} email - the email address to search for, e.g. "me@me.com"
   *
   * @return {object} user object in the same format expected by
   *   {@link RethinkDBDashDriver#createUser}, or *null* if none found.
   */
  async fetchUserByEmail(email) {
    await this._ready();

    const results = await this.users
      .filter(this.r.row('emails').contains(row => row('address').eq(email)))
      .limit(1)
      .run();

    return results[0] || null;
  }

  /**
   * Returns a user who has *either* a matching email address or matching
   * service record, or null, otherwise.
   *
   * @param {string} service - name of the service, e.g. "facebook"
   * @param {string} id      - id of the service record, e.g. "152356242"
   * @param {string} email   - the email address to search for, e.g. "me@me.com"
   *
   * @return {object} user object in the same format expected by
   *   {@link RethinkDBDashDriver#createUser}, or *null* if none found
   */
  async fetchUserByServiceIdOrEmail(service, id, email) {
    await this._ready();

    const results = await this.users.filter(
      this.r.or(
        this.r.row('services')(service)('id').eq(id).default(false),
        this.r.row('emails').contains({ address: email }).default(false)
      )
    ).limit(1).run();

    return results[0] || null;
  }

  /**
   * Given a userId, ensures the user record contains the given email
   * address, and updates it with optional data.
   *
   * @param {string} userId  - the id of the user to assert
   * @param {string} email   - the email address to ensure exists
   * @param {object} data    - optional, e.g. { type: 'work', verified: true }
   */
  async assertUserEmailData(userId, email, data) {
    await this._ready();

    await this.users.get(userId).update(row => ({
      emails: row('emails').default([])
        .filter(row('emails').default([]).contains({ address: email }).not())
        .append({ address: email, ...data })
    }));
  }

  /**
   * Given a userId, ensure the user record contains the given service
   * record, and updates it with the given data.
   *
   * @param {string} userId  - the id of the user to assert
   * @param {string} service - the name of the service, e.g. "facebook"
   * @param {object} data    - e.g. { id: "4321", displayName: "John Sheppard" }
   */
  async assertUserServiceData(userId, service, data) {
    await this._ready();
    await this.users.get(userId).update({ services: { [service]: data } });
  }

  // Not sure if we need this anymore, since fetch*() functions return
  // normalized data.  But let's see.
  mapUserToServiceData(user, service) {
    return user && user.services && user.services[service];
  }
}

export default RethinkDBDashDriver;
