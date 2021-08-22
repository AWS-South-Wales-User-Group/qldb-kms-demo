const Log = require('@dazn/lambda-powertools-logger');
const { getQldbDriver } = require('./helper/ConnectToLedger');
const RecordNotFoundError = require('./lib/RecordNotFoundError');

module.exports.handler = async (event) => {

    const { id } = event.pathParameters;
    Log.debug(`In the get-record handler with id ${id}`);
    const recordId = parseInt(id);

    try {
        const result = await getRecord(recordId);

        Log.debug('Result: ' + JSON.stringify(result));
        const record = JSON.parse(result);

        return {
            statusCode: 200,
            body: JSON.stringify(record),
        };

  
    } catch (error) {
        if (error instanceof RecordNotFoundError) {
            return error.getHttpResponse();
        }
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

const getRecord = async (id) => {
    Log.debug(`In getRecord function with id ${id}`);
  
    let licence;
    // Get a QLDB Driver instance
    const qldbDriver = await getQldbDriver();
    await qldbDriver.executeLambda(async (txn) => {
      // Get the current record
      const result = await getRecordById(txn, id);
      const resultList = result.getResultList();
  
      if (resultList.length === 0) {
        throw new RecordNotFoundError(400, 'Record Not Found Error', `Record with id ${id} does not exist`);
      } else {
        licence = JSON.stringify(resultList[0]);
      }
    });
    return licence;
  };

  async function getRecordById(txn, id) {
    Log.debug('In getRecordById function');
    const query = 'SELECT * FROM Test WHERE id = ?';
    return txn.execute(query, id);
  }