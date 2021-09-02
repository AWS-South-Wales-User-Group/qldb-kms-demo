# QLDB KMS Demo

## Install and Deploy the Demo

The source code can be downloaded, dependencies installed, and the CloudFormation stack deployed using the following:

```shell
git clone https://github.com/AWS-South-Wales-User-Group/qldb-kms-demo
cd qldb-kms-demo
npm ci
sls deploy --stage {stage-name}
```

### Create Table and Index

When you deploy the stack, the QLDB ledger will be created, but you still need to go in and create a table and index. This can be done directly in the console or via the QLDB shell with the following commands:

```shell
CREATE TABLE Test;
CREATE INDEX ON Test (id);
```

### Configure Artillery Scripts

The source code repository includes a load testing tool called [Artillery](https://artillery.io/) that will be used for populating data. When you deploy the stack, you should see the POST and GET endpoints in a format such as below:

```ascii
POST - https://v0gbo1fgz3.execute-api.eu-west-2.amazonaws.com/poc/record
GET - https://v0gbo1fgz3.execute-api.eu-west-2.amazonaws.com/poc/record/{id}
```

Take a note of these values and update the target values in the `create-record.yml` and `get-record.yml` files in the `scripts` directory.

```ascii
config:
    target: "https://v0gbo1fgz3.execute-api.eu-west-2.amazonaws.com/poc"
    phases:
      - duration: 300
        arrivalRate: 5
    processor: "./createRecord.js"
```

The script above will create 5 virtual users every second for 300 seconds.

Now we are ready to test a number of scenarios

### Scenario 1: Create and Query Data

In the root directory create 1500 new records in 5 minutes by running the following command:

```shell
artillery run scripts/create-record.yml
```

Next, we show that we can retrieve these records by running the following command:

```shell
artillery run scripts/get-record.yml
```

This should successfully retrieve all 1500 records in around 2.5 minutes.

### Scenario 2: Rotate Key

This scenario tests what happens when we rotate the key associated with a QLDB ledger.

When we created the ledger, we specified an alias. This means we can simply update the alias to point at a different CMK. To do this, we need to know the key ID of the new CMK. Deploying the stack created a number of keys that we can use for testing.

The first step is to find the key ID of the rotate key. This value was output in the stack, and can be found in the Outputs section of the CloudFormation stack in the AWS console, or by querying CloudFormation using the AWS CLI as below:

```shell
aws cloudformation describe-stacks --region eu-west-2 --stack-name qldb-kms-{stage-name}
```

Next, run the artillery command to retrieve all 1500 records. This should take around 2.5 minutes. When this has started, run the following command to update the alias:

```shell
aws kms update-alias \
    --alias-name alias/qldb-kms-{stage-name} \
    --target-key-id {key-id} \
    --region eu-west-2
```

You should notice that all records were successfully retrieved, proving that the ledger remains fully accessible without any performance impact while the key change is being processed.

Instead of updating an alias, you can also directly update the KMS key used by the ledger. To do this, lookup the key id of the delete key created by the stack, kick off the artillery script to retrieve all records, and then run the following command:

```shell
aws qldb update-ledger \
   --name qldb-kms-ledger-poc \
   --region eu-west-2 \
   --kms-key 48ad14da-5bf9-497a-a4d9-d379bfb0d41e
```

You will see the output of the command being similar to below:

```json
{
    "Name": "qldb-kms-ledger-poc",
    "Arn": "arn:aws:qldb:eu-west-2:{account}:ledger/qldb-kms-ledger-poc",
    "State": "ACTIVE",
    "CreationDateTime": "2021-08-30T16:48:55.600000+01:00",
    "DeletionProtection": false,
    "EncryptionDescription": {
        "KmsKeyArn": "arn:aws:kms:eu-west-2:{account}:key/48ad14da-5bf9-497a-a4d9-d379bfb0d41e",
        "EncryptionStatus": "UPDATING"
    }
}
```

In this case, the `EncryptionStatus` is clearly shown as `UPDATING`, which is carried out asynchronously, without impacting on the performance or availability.

### Scenario 3: Disable (and re-enable) Key

The next scenario involves disabling the KMS key being used, and seeing the impact this has. Again, kick off the artillery script to retrieve all records, and then run the following command:

```shell
aws kms disable-key \
  --region eu-west-2 \
  --key-id 48ad14da-5bf9-497a-a4d9-d379bfb0d41e
```

The records continue to be successfully retrieved for a short period of time, before they begin to fail. An error message is returned that "Amazon QLDB does not have grant access on the AWS KMS customer managed key of the ledger. Restore the grant on the key for the ledger." You can query the status of the ledger using the following command:

```shell
aws qldb describe-ledger \
  --region eu-west-2 \
  --name qldb-kms-ledger-{stage-name}
```

This returns a response similar to the one below:

```json
{
    "Name": "qldb-kms-ledger-poc",
    "Arn": "arn:aws:qldb:eu-west-2:{account}:ledger/qldb-kms-ledger-poc",
    "State": "ACTIVE",
    "CreationDateTime": "2021-08-30T16:48:55.600000+01:00",
    "PermissionsMode": "STANDARD",
    "DeletionProtection": false,
    "EncryptionDescription": {
        "KmsKeyArn": "arn:aws:kms:eu-west-2:{account}:key/48ad14da-5bf9-497a-a4d9-d379bfb0d41e",
        "EncryptionStatus": "KMS_KEY_INACCESSIBLE",
        "InaccessibleKmsKeyDateTime": "2021-08-30T20:01:17.521000+01:00"
    }
}
```

The ledger now has an encryption status of `KMS_KEY_INACCESSIBLE`, meaning it is impaired and won't accept any read or write requests. For example, you won't even be able to connect to the ledger using the QLDB shell utility.

To revert this, you can simply re-enable the key using the following command:

```shell
aws kms enable-key \
  --region eu-west-2 \
  --key-id 48ad14da-5bf9-497a-a4d9-d379bfb0d41e
```

This will take a number of minutes to resolve, but at some point, the encryption status will revert back to `ENABLED` and the ledger is accessible.

### Scenario 4: Invalid Permissions

The final scenario involves using a key for which the roles used by the AWS Lambda functions do not have permission either in their own IAM policy or the key policy.

Update the ledger to use the key id associated with the no access key id in the Outputs of the CloudFormation stack. Next, run a `cURL` command to the HTTP GET endpoint to retrieve the record with the id of 1:

```script
curl 'https://aq1o120co1.execute-api.eu-west-2.amazonaws.com/poc/record/1'
```

This will return the following error message:

```json
{
  "status":500,
  "title":"AccessDeniedException",
  "detail":"The user does not have permissions to use the customer managed KMS key of the ledger (KMS Request ID: 61d6b556-4c6b-4f13-b4c4-fae49a2f11c3) : The ciphertext refers to a customer master key that does not exist, does not exist in this region, or you are not allowed to access."
}
```

## Tidy Up Resources

All the resources generated can be safely removed by running the following command:

```shell
sls remove --stage {stage-name}
```
