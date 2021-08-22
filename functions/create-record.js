const Log = require('@dazn/lambda-powertools-logger');
const { getQldbDriver } = require('./helper/ConnectToLedger');

module.exports.handler = async (event) => {
    const {
      id, firstName, lastName, email, street, postcode
    } = JSON.parse(event.body);
    Log.debug(`In the create licence handler with: id ${id} first name ${firstName} last name ${lastName} email ${email} street ${street} and postcode ${postcode}`);
  
    try {
      const response = await createRecord (
        id, firstName, lastName, email, street, postcode
      );

      return {
        statusCode: 201,
        body: JSON.stringify('Success'),
      };

    } catch (error) {
      Log.error(`Error returned: ${error}`);
      const errorBody = {
        status: 500,
        title: error.name,
        detail: error.message,
      };
      return {
        statusCode: 500,
        body: JSON.stringify(errorBody),
      };
    }
};


const createRecord = async (id, firstName, lastName, email, street, postcode) => {

  Log.debug('In the createRecord function');

  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {

    const recordDoc = {
      id, firstName, lastName, email, street, postcode
    };

    const statement = 'INSERT INTO Test ?';
    Log.debug('About to execute the statement');
    return txn.execute(statement, recordDoc);
  });
};