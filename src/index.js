class RethinkDBDashDriver {

  /*
   *
   */
  constructor(r, userTableName = 'users') {
    this.r = r;
    this.users = this.r.table(userTableName);
  }

  /*
   * Given a user record, save it to the database, and return its given id.
   */
  async createUser(user) {
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
    const results = await this.users
      .filter(this.r.row('emails').contains({ address: email }))
      .limit(1)
      .run();

    return results[0] || null;
  }


}

export default RethinkDBDashDriver;
