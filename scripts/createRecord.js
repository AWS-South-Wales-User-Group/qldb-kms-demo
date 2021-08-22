'use strict';

module.exports = {
  createNewRecord
};

let counter = 0;

// Make sure to "npm install faker" first.
const Faker = require('faker');

function createNewRecord(userContext, events, done) {
  // generate data with Faker:
  const id = ++counter;
  const firstName = `${Faker.name.firstName()}`;
  const lastName = `${Faker.name.lastName()}`;
  const email = firstName + `.` + lastName + `@email.com`;
  const street = `${Faker.address.streetName()}`;
  const postcode = `${Faker.address.zipCode()}`;

  // add variables to virtual user's context:
  userContext.vars.id = id;
  userContext.vars.firstName = firstName;
  userContext.vars.lastName = lastName;
  userContext.vars.email = email;
  userContext.vars.street = street;
  userContext.vars.postcode = postcode;

  // continue with executing the scenario:
  return done();
}
