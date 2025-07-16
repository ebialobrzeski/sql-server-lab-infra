// lib/sql-server-training-stack.ts
import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2, aws_rds as rds, aws_secretsmanager as secretsmanager, aws_kms as kms, aws_iam as iam, aws_lambda as lambda } from 'aws-cdk-lib';
import * as path from 'path';

export class SqlServerTrainingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const scopePrefix = this.node.tryGetContext('scope') || 'default';

    const vpc = new ec2.Vpc(this, `${scopePrefix}-Vpc`, {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: `${scopePrefix}-PrivateSubnet`,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24
        }
      ],
      natGateways: 0,
      restrictDefaultSecurityGroup: false,
      enableDnsHostnames: true,
      enableDnsSupport: true
    });

    vpc.addInterfaceEndpoint(`${scopePrefix}-SsmEndpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.SSM
    });

    vpc.addInterfaceEndpoint(`${scopePrefix}-SsmMessagesEndpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES
    });

    vpc.addInterfaceEndpoint(`${scopePrefix}-Ec2MessagesEndpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES
    });

    vpc.addInterfaceEndpoint(`${scopePrefix}-SecretsManagerEndpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER
    });

    vpc.addInterfaceEndpoint(`${scopePrefix}-CloudWatchLogsEndpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS
    });

    const securityGroup = new ec2.SecurityGroup(this, `${scopePrefix}-SqlSecurityGroup`, {
      vpc,
      allowAllOutbound: true,
      description: 'Allow internal access to SQL Server'
    });

    const adminSecret = new secretsmanager.Secret(this, `${scopePrefix}-SqlAdminSecret`, {
      secretName: `${scopePrefix}-sqlServerAdmin`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false
      }
    });

    const encryptionKey = new kms.Key(this, `${scopePrefix}-RdsStorageKey`, {
      enableKeyRotation: true
    });

    const parameterGroup = new rds.ParameterGroup(this, `${scopePrefix}-SqlParams`, {
      engine: rds.DatabaseInstanceEngine.sqlServerWeb({ version: rds.SqlServerEngineVersion.VER_16_00_4185_3_V1 }),
      parameters: {
        'cost threshold for parallelism': '20'
      }
    });

    const rdsS3Role = new iam.Role(this, `${scopePrefix}-RdsS3Role`, {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com')
    });
    rdsS3Role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'));

    const optionGroup = new rds.OptionGroup(this, `${scopePrefix}-SqlOptionGroup`, {
      engine: rds.DatabaseInstanceEngine.sqlServerWeb({ version: rds.SqlServerEngineVersion.VER_16_00_4185_3_V1 }),
      configurations: [
        {
          name: 'SQLSERVER_BACKUP_RESTORE',
          settings: {
            IAM_ROLE_ARN: rdsS3Role.roleArn
          }
        }
      ]
    });

    const rdsInstance = new rds.DatabaseInstance(this, `${scopePrefix}-SqlServerInstance`, {
      engine: rds.DatabaseInstanceEngine.sqlServerWeb({ version: rds.SqlServerEngineVersion.VER_16_00_4185_3_V1 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      publiclyAccessible: false,
      securityGroups: [securityGroup],
      credentials: rds.Credentials.fromSecret(adminSecret),
      allocatedStorage: 500,
      maxAllocatedStorage: 1000,
      storageType: rds.StorageType.GP3,
      iops: 3000,
      storageThroughput: 125,
      storageEncrypted: true,
      storageEncryptionKey: encryptionKey,
      enablePerformanceInsights: true,
      cloudwatchLogsExports: ['agent', 'error'],
      deletionProtection: false,
      multiAz: false,
      backupRetention: Duration.seconds(0),
      removalPolicy: RemovalPolicy.DESTROY,
      autoMinorVersionUpgrade: true,
      parameterGroup,
      optionGroup,
      instanceIdentifier: `${scopePrefix}-sql-instance`,
      characterSetName: 'Latin1_General_CI_AS'
    });

    const restoreLambda = new lambda.Function(this, `${scopePrefix}-RestoreLambda`, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/restore-sql-js')),
      timeout: Duration.minutes(5),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [securityGroup],
      environment: {
        INSTANCE_ENDPOINT: rdsInstance.dbInstanceEndpointAddress,
        BUCKET_NAME: 'sql-lab-backup',
        FILE_NAME: 'StackOverflow.bak',
        SECRET_ARN: adminSecret.secretArn,
        ROLE_ARN: rdsS3Role.roleArn
      }
    });

    adminSecret.grantRead(restoreLambda);

    securityGroup.addIngressRule(restoreLambda.connections.securityGroups[0], ec2.Port.tcp(1433), 'Allow Lambda to access SQL Server');

    const bastionRole = new iam.Role(this, `${scopePrefix}-BastionSSMRole`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });

    bastionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    const bastionSg = new ec2.SecurityGroup(this, `${scopePrefix}-BastionSecurityGroup`, {
      vpc,
      allowAllOutbound: true,
      description: 'Bastion host security group'
    });

    securityGroup.addIngressRule(bastionSg, ec2.Port.tcp(1433), 'Allow Bastion to access SQL Server');

    const bastionUserData = ec2.UserData.forLinux();

    const bastionInstance = new ec2.Instance(this, `${scopePrefix}-BastionHost`, {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: bastionSg,
      role: bastionRole,
      userData: bastionUserData,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            encrypted: true
          })
        }
      ]
    });

    new CfnOutput(this, `${scopePrefix}-PortForwardingHint`, {
      value: `aws ssm start-session --target ${bastionInstance.instanceId} --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host="${rdsInstance.dbInstanceEndpointAddress}",portNumber="1433",localPortNumber="1433"`,
      description: 'Command to start a port forwarding session to SQL Server via bastion host.'
    });

    new CfnOutput(this, `${scopePrefix}-SecretRetrievalHint`, {
      value: `aws secretsmanager get-secret-value --secret-id ${adminSecret.secretName} --query SecretString --output text`,
      description: 'Command to retrieve SQL admin credentials from Secrets Manager.'
    });

    new CfnOutput(this, `${scopePrefix}-LambdaInvokeCommand`, {
      value: `aws lambda invoke --function-name ${restoreLambda.functionName} --payload '{}' response.json`,
      description: 'Command to manually trigger restore Lambda.'
    });

  }
}
