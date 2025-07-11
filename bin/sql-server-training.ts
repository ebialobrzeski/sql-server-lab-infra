#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SqlServerTrainingStack } from '../lib/sql-server-training-stack';

const app = new cdk.App();

const scope = app.node.tryGetContext('scope');
if (!scope) {
  throw new Error('You must provide a --context scope=yourname to deploy this stack.');
}

new SqlServerTrainingStack(app, `${scope}-SqlServerTrainingStack`);
