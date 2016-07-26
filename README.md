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

If your `users` table is called something else, pass the name as the 2nd argument:

```js
new RethinkDBDashDriver(r, 'sheeple');
```

See [apollo-passport](https://github.com/apollo-passport/apollo-passport) for more info.
