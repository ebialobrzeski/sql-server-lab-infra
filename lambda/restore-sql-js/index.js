const https = require('https');
const url = require('url');
const sql = require('mssql');
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

exports.handler = async function(event, context) {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const isCustomResource = !!event.ResponseURL;

  if (event.RequestType === 'Delete' || event.RequestType === 'Update') {
    if (isCustomResource) {
      await sendResponse(event, context, 'SUCCESS');
    }
    return;
  }

  const { INSTANCE_ENDPOINT, BUCKET_NAME, FILE_NAME, SECRET_ARN, ROLE_ARN } = process.env;

  try {
    const secretValue = await secretsManager.getSecretValue({ SecretId: SECRET_ARN }).promise();
    const secret = JSON.parse(secretValue.SecretString);

    const connection = await sql.connect({
      server: INSTANCE_ENDPOINT,
      user: secret.username,
      password: secret.password,
      port: 1433,
      database: 'master',
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    });

    const restoreCommand = `
      exec msdb.dbo.rds_restore_database 
      @restore_db_name='StackOverflow', 
      @s3_arn_to_restore_from='arn:aws:s3:::${BUCKET_NAME}/${FILE_NAME}'
    `;

    console.log('Executing SQL:', restoreCommand);
    await connection.request().query(restoreCommand);

    if (isCustomResource) {
      await sendResponse(event, context, 'SUCCESS');
    }
  } catch (err) {
    console.error('Restore failed:', err);
    if (isCustomResource) {
      await sendResponse(event, context, 'FAILED', { Error: err.message });
    } else {
      throw err;
    }
  }
};

function sendResponse(event, context, responseStatus, responseData = {}) {
  return new Promise((resolve, reject) => {
    if (!event.ResponseURL) {
      return resolve();
    }

    const responseBody = JSON.stringify({
      Status: responseStatus,
      Reason: responseStatus === 'FAILED' ? responseData.Error : `See logs: ${context.logStreamName}`,
      PhysicalResourceId: event.PhysicalResourceId || context.logStreamName,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: responseData
    });

    console.log('Sending response:', responseBody);

    const parsedUrl = url.parse(event.ResponseURL);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: 'PUT',
      headers: {
        'Content-Type': '',
        'Content-Length': Buffer.byteLength(responseBody)
      }
    };

    const req = https.request(options, res => {
      console.log('CloudFormation response status:', res.statusCode);
      resolve();
    });

    req.on('error', err => {
      console.error('Failed to send response:', err);
      reject(err);
    });

    req.write(responseBody);
    req.end();
  });
}
