# apollo-passport-rethinkdbdash

rethinkdbdash driver for apollo-passport

[![npm](https://img.shields.io/npm/v/apollo-passport-rethinkdbdash.svg?maxAge=2592000)](https://www.npmjs.com/package/apollo-passport-rethinkdbdash) [![Circle CI](https://circleci.com/gh/apollo-passport/rethinkdbdash.svg?style=shield)](https://circleci.com/gh/apollo-passport/rethinkdbdash) [![Coverage Status](https://coveralls.io/repos/github/apollo-passport/rethinkdbdash/badge.svg?branch=master)](https://coveralls.io/github/apollo-passport/rethinkdbdash?branch=master) ![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

Copyright (c) 2016 by Gadi Cohen, released under the MIT license.

## Usage

```js
import rethinkdbdash from 'rethinkdbdash';
import RethinkDBDashDriver from 'apollo-passport-rethinkdbdash';

// However you usually create your "r" instance
const r = rethinkdbdash({
  db: "myApp",
  servers: [ { host, port } ]
});

// Pass to apollo passport at creation time
const apolloPassport = new ApolloPassport({
  // along with any other relevant options
  db: new RethinkDBDashDriver(r)
});
```

**Optional parameters**, e.g. if your `users` table is called something else:

```js
new RethinkDBDashDriver(r, {
  userTableName: 'users',
  configTableName: 'apolloPassportConfig',
  db: '(override default database given to rethinkdbdash)'
});
```

See [apollo-passport](https://github.com/apollo-passport/apollo-passport) for more info.

## Create your own DBDriver

This package is fully documented with 100% test coverage.  It can be used as a basis for creating other DBDrivers for Apollo Passport.

See also the [docs/api/apollo-passport-rethinkdbdash][API Docs].
