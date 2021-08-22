'use strict';

module.exports = {
  getNewRecord
};

let counter = 0;

// Make sure to "npm install faker" first.
const Faker = require('faker');

function getNewRecord(userContext, events, done) {
  // generate data with Faker:
  const id = ++counter;
  // add variables to virtual user's context:
  userContext.vars.id = id;

  // continue with executing the scenario:
  return done();
}
