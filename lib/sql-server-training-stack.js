"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlServerTrainingStack = void 0;
// lib/sql-server-training-stack.ts
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_cdk_lib_2 = require("aws-cdk-lib");
const path = __importStar(require("path"));
class SqlServerTrainingStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const scopePrefix = this.node.tryGetContext('scope') || 'default';
        const vpc = new aws_cdk_lib_2.aws_ec2.Vpc(this, `${scopePrefix}-Vpc`, {
            ipAddresses: aws_cdk_lib_2.aws_ec2.IpAddresses.cidr('10.0.0.0/16'),
            maxAzs: 2,
            subnetConfiguration: [
                {
                    name: `${scopePrefix}-PrivateSubnet`,
                    subnetType: aws_cdk_lib_2.aws_ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24
                }
            ],
            natGateways: 0,
            restrictDefaultSecurityGroup: false,
            enableDnsHostnames: true,
            enableDnsSupport: true
        });
        vpc.addInterfaceEndpoint(`${scopePrefix}-SsmEndpoint`, {
            service: aws_cdk_lib_2.aws_ec2.InterfaceVpcEndpointAwsService.SSM
        });
        vpc.addInterfaceEndpoint(`${scopePrefix}-SsmMessagesEndpoint`, {
            service: aws_cdk_lib_2.aws_ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES
        });
        vpc.addInterfaceEndpoint(`${scopePrefix}-Ec2MessagesEndpoint`, {
            service: aws_cdk_lib_2.aws_ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES
        });
        vpc.addInterfaceEndpoint(`${scopePrefix}-SecretsManagerEndpoint`, {
            service: aws_cdk_lib_2.aws_ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER
        });
        vpc.addInterfaceEndpoint(`${scopePrefix}-CloudWatchLogsEndpoint`, {
            service: aws_cdk_lib_2.aws_ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS
        });
        const securityGroup = new aws_cdk_lib_2.aws_ec2.SecurityGroup(this, `${scopePrefix}-SqlSecurityGroup`, {
            vpc,
            allowAllOutbound: true,
            description: 'Allow internal access to SQL Server'
        });
        const adminSecret = new aws_cdk_lib_2.aws_secretsmanager.Secret(this, `${scopePrefix}-SqlAdminSecret`, {
            secretName: `${scopePrefix}-sqlServerAdmin`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'admin' }),
                generateStringKey: 'password',
                excludePunctuation: true,
                includeSpace: false
            }
        });
        new aws_cdk_lib_1.CfnOutput(this, `${scopePrefix}-SqlAdminSecretOutput`, {
            value: adminSecret.secretName,
            exportName: `${scopePrefix}-SqlAdminSecretName`
        });
        new aws_cdk_lib_1.CfnOutput(this, `${scopePrefix}-SecretRetrievalHint`, {
            value: `aws secretsmanager get-secret-value --secret-id ${adminSecret.secretName} --query SecretString --output text`,
            description: 'Command to retrieve SQL admin credentials from Secrets Manager.'
        });
        const encryptionKey = new aws_cdk_lib_2.aws_kms.Key(this, `${scopePrefix}-RdsStorageKey`, {
            enableKeyRotation: true
        });
        const parameterGroup = new aws_cdk_lib_2.aws_rds.ParameterGroup(this, `${scopePrefix}-SqlParams`, {
            engine: aws_cdk_lib_2.aws_rds.DatabaseInstanceEngine.sqlServerWeb({ version: aws_cdk_lib_2.aws_rds.SqlServerEngineVersion.VER_16_00_4185_3_V1 }),
            parameters: {
                'cost threshold for parallelism': '20'
            }
        });
        const rdsS3Role = new aws_cdk_lib_2.aws_iam.Role(this, `${scopePrefix}-RdsS3Role`, {
            assumedBy: new aws_cdk_lib_2.aws_iam.ServicePrincipal('rds.amazonaws.com')
        });
        rdsS3Role.addManagedPolicy(aws_cdk_lib_2.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'));
        const optionGroup = new aws_cdk_lib_2.aws_rds.OptionGroup(this, `${scopePrefix}-SqlOptionGroup`, {
            engine: aws_cdk_lib_2.aws_rds.DatabaseInstanceEngine.sqlServerWeb({ version: aws_cdk_lib_2.aws_rds.SqlServerEngineVersion.VER_16_00_4185_3_V1 }),
            configurations: [
                {
                    name: 'SQLSERVER_BACKUP_RESTORE',
                    settings: {
                        IAM_ROLE_ARN: rdsS3Role.roleArn
                    }
                }
            ]
        });
        const rdsInstance = new aws_cdk_lib_2.aws_rds.DatabaseInstance(this, `${scopePrefix}-SqlServerInstance`, {
            engine: aws_cdk_lib_2.aws_rds.DatabaseInstanceEngine.sqlServerWeb({ version: aws_cdk_lib_2.aws_rds.SqlServerEngineVersion.VER_16_00_4185_3_V1 }),
            instanceType: aws_cdk_lib_2.aws_ec2.InstanceType.of(aws_cdk_lib_2.aws_ec2.InstanceClass.T3, aws_cdk_lib_2.aws_ec2.InstanceSize.MEDIUM),
            vpc,
            vpcSubnets: { subnetType: aws_cdk_lib_2.aws_ec2.SubnetType.PRIVATE_ISOLATED },
            publiclyAccessible: false,
            securityGroups: [securityGroup],
            credentials: aws_cdk_lib_2.aws_rds.Credentials.fromSecret(adminSecret),
            allocatedStorage: 500,
            maxAllocatedStorage: 1000,
            storageType: aws_cdk_lib_2.aws_rds.StorageType.GP3,
            iops: 3000,
            storageThroughput: 125,
            storageEncrypted: true,
            storageEncryptionKey: encryptionKey,
            enablePerformanceInsights: true,
            cloudwatchLogsExports: ['agent', 'error'],
            deletionProtection: false,
            multiAz: false,
            backupRetention: aws_cdk_lib_1.Duration.seconds(0),
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoMinorVersionUpgrade: true,
            parameterGroup,
            optionGroup,
            instanceIdentifier: `${scopePrefix}-sql-instance`
        });
        const restoreLambda = new aws_cdk_lib_2.aws_lambda.Function(this, `${scopePrefix}-RestoreLambda`, {
            runtime: aws_cdk_lib_2.aws_lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: aws_cdk_lib_2.aws_lambda.Code.fromAsset(path.join(__dirname, '../lambda/restore-sql-js')),
            timeout: aws_cdk_lib_1.Duration.minutes(5),
            vpc,
            vpcSubnets: { subnetType: aws_cdk_lib_2.aws_ec2.SubnetType.PRIVATE_ISOLATED },
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
        // Remove RDS Data API permission if not using RDS Data API
        // restoreLambda.addToRolePolicy(new iam.PolicyStatement({
        //   actions: ['rds-data:ExecuteStatement'],
        //   resources: ['*']
        // }));
        securityGroup.addIngressRule(restoreLambda.connections.securityGroups[0], aws_cdk_lib_2.aws_ec2.Port.tcp(1433), 'Allow Lambda to access SQL Server');
        const bastionRole = new aws_cdk_lib_2.aws_iam.Role(this, `${scopePrefix}-BastionSSMRole`, {
            assumedBy: new aws_cdk_lib_2.aws_iam.ServicePrincipal('ec2.amazonaws.com')
        });
        bastionRole.addManagedPolicy(aws_cdk_lib_2.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
        const bastionSg = new aws_cdk_lib_2.aws_ec2.SecurityGroup(this, `${scopePrefix}-BastionSecurityGroup`, {
            vpc,
            allowAllOutbound: true,
            description: 'Bastion host security group'
        });
        securityGroup.addIngressRule(bastionSg, aws_cdk_lib_2.aws_ec2.Port.tcp(1433), 'Allow Bastion to access SQL Server');
        // SSM agent is pre-installed and auto-starts on Amazon Linux 2023
        const bastionUserData = aws_cdk_lib_2.aws_ec2.UserData.forLinux();
        // bastionUserData.addCommands(
        //   'sudo systemctl enable amazon-ssm-agent',
        //   'sudo systemctl start amazon-ssm-agent'
        // );
        const bastionInstance = new aws_cdk_lib_2.aws_ec2.Instance(this, `${scopePrefix}-BastionHost`, {
            vpc,
            vpcSubnets: { subnetType: aws_cdk_lib_2.aws_ec2.SubnetType.PRIVATE_ISOLATED },
            instanceType: aws_cdk_lib_2.aws_ec2.InstanceType.of(aws_cdk_lib_2.aws_ec2.InstanceClass.T3, aws_cdk_lib_2.aws_ec2.InstanceSize.MICRO),
            machineImage: aws_cdk_lib_2.aws_ec2.MachineImage.latestAmazonLinux2023(),
            securityGroup: bastionSg,
            role: bastionRole,
            userData: bastionUserData,
            blockDevices: [
                {
                    deviceName: '/dev/xvda',
                    volume: aws_cdk_lib_2.aws_ec2.BlockDeviceVolume.ebs(8, {
                        encrypted: true
                    })
                }
            ]
        });
        new aws_cdk_lib_1.CfnOutput(this, `${scopePrefix}-SqlInstanceEndpoint`, {
            value: rdsInstance.dbInstanceEndpointAddress,
            exportName: `${scopePrefix}-SqlInstanceEndpoint`
        });
        new aws_cdk_lib_1.CfnOutput(this, `${scopePrefix}-PortForwardingHint`, {
            value: `aws ssm start-session --target ${bastionInstance.instanceId} --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host="${rdsInstance.dbInstanceEndpointAddress}",portNumber="1433",localPortNumber="1433"`,
            description: 'Command to start a port forwarding session to SQL Server via bastion host.'
        });
        new aws_cdk_lib_1.CfnOutput(this, `${scopePrefix}-LambdaInvokeCommand`, {
            value: `aws lambda invoke --function-name ${restoreLambda.functionName} --payload '{}' response.json`,
            description: 'Command to manually trigger restore Lambda.'
        });
    }
}
exports.SqlServerTrainingStack = SqlServerTrainingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3FsLXNlcnZlci10cmFpbmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNxbC1zZXJ2ZXItdHJhaW5pbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxtQ0FBbUM7QUFDbkMsNkNBQW9GO0FBRXBGLDZDQUF5SjtBQUN6SiwyQ0FBNkI7QUFFN0IsTUFBYSxzQkFBdUIsU0FBUSxtQkFBSztJQUMvQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQzFELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLFNBQVMsQ0FBQztRQUVsRSxNQUFNLEdBQUcsR0FBRyxJQUFJLHFCQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLFdBQVcsTUFBTSxFQUFFO1lBQ2xELFdBQVcsRUFBRSxxQkFBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO1lBQ2hELE1BQU0sRUFBRSxDQUFDO1lBQ1QsbUJBQW1CLEVBQUU7Z0JBQ25CO29CQUNFLElBQUksRUFBRSxHQUFHLFdBQVcsZ0JBQWdCO29CQUNwQyxVQUFVLEVBQUUscUJBQUcsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCO29CQUMzQyxRQUFRLEVBQUUsRUFBRTtpQkFDYjthQUNGO1lBQ0QsV0FBVyxFQUFFLENBQUM7WUFDZCw0QkFBNEIsRUFBRSxLQUFLO1lBQ25DLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsZ0JBQWdCLEVBQUUsSUFBSTtTQUN2QixDQUFDLENBQUM7UUFFSCxHQUFHLENBQUMsb0JBQW9CLENBQUMsR0FBRyxXQUFXLGNBQWMsRUFBRTtZQUNyRCxPQUFPLEVBQUUscUJBQUcsQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHO1NBQ2hELENBQUMs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dCI6WyIvLyBsaWIvc3FsLXNlcnZlci10cmFpbmluZy1zdGFjay50c1xyXG5pbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgRHVyYXRpb24sIFJlbW92YWxQb2xpY3ksIENmbk91dHB1dCB9IGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCB7IGF3c19lYzIgYXMgZWMyLCBhd3NfcmRzIGFzIHJkcywgYXdzX3NlY3JldHNtYW5hZ2VyIGFzIHNlY3JldHNtYW5hZ2VyLCBhd3Nfa21zIGFzIGttcywgYXdzX2lhbSBhcyBpYW0sIGF3c19sYW1iZGEgYXMgbGFtYmRhIH0gZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuZXhwb3J0IGNsYXNzIFNxbFNlcnZlclRyYWluaW5nU3RhY2sgZXh0ZW5kcyBTdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCBzY29wZVByZWZpeCA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdzY29wZScpIHx8ICdkZWZhdWx0JztcclxuXHJcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCBgJHtzY29wZVByZWZpeH0tVnBjYCwge1xyXG4gICAgICBpcEFkZHJlc3NlczogZWMyLklwQWRkcmVzc2VzLmNpZHIoJzEwLjAuMC4wLzE2JyksXHJcbiAgICAgIG1heEF6czogMixcclxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIG5hbWU6IGAke3Njb3BlUHJlZml4fS1Qcml2YXRlU3VibmV0YCxcclxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQsXHJcbiAgICAgICAgICBjaWRyTWFzazogMjRcclxuICAgICAgICB9XHJcbiAgICAgIF0sXHJcbiAgICAgIG5hdEdhdGV3YXlzOiAwLFxyXG4gICAgICByZXN0cmljdERlZmF1bHRTZWN1cml0eUdyb3VwOiBmYWxzZSxcclxuICAgICAgZW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxyXG4gICAgICBlbmFibGVEbnNTdXBwb3J0OiB0cnVlXHJcbiAgICB9KTtcclxuXHJcbiAgICB2cGMuYWRkSW50ZXJmYWNlRW5kcG9pbnQoYCR7c2NvcGVQcmVmaXh9LVNzbUVuZHBvaW50YCwge1xyXG4gICAgICBzZXJ2aWNlOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLlNTTVxyXG4gICAgfSk7XHJcblxyXG4gICAgdnBjLmFkZEludGVyZmFjZUVuZHBvaW50KGAke3Njb3BlUHJlZml4fS1Tc21NZXNzYWdlc0VuZHBvaW50YCwge1xyXG4gICAgICBzZXJ2aWNlOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLlNTTV9NRVNTQUdFU1xyXG4gICAgfSk7XHJcblxyXG4gICAgdnBjLmFkZEludGVyZmFjZUVuZHBvaW50KGAke3Njb3BlUHJlZml4fS1FYzJNZXNzYWdlc0VuZHBvaW50YCwge1xyXG4gICAgICBzZXJ2aWNlOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLkVDMl9NRVNTQUdFU1xyXG4gICAgfSk7XHJcblxyXG4gICAgdnBjLmFkZEludGVyZmFjZUVuZHBvaW50KGAke3Njb3BlUHJlZml4fS1TZWNyZXRzTWFuYWdlckVuZHBvaW50YCwge1xyXG4gICAgICBzZXJ2aWNlOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLlNFQ1JFVFNfTUFOQUdFUlxyXG4gICAgfSk7XHJcblxyXG4gICAgdnBjLmFkZEludGVyZmFjZUVuZHBvaW50KGAke3Njb3BlUHJlZml4fS1DbG91ZFdhdGNoTG9nc0VuZHBvaW50YCwge1xyXG4gICAgICBzZXJ2aWNlOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLkNMT1VEV0FUQ0hfTE9HU1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgc2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCBgJHtzY29wZVByZWZpeH0tU3FsU2VjdXJpdHlHcm91cGAsIHtcclxuICAgICAgdnBjLFxyXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FsbG93IGludGVybmFsIGFjY2VzcyB0byBTUUwgU2VydmVyJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgYWRtaW5TZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsIGAke3Njb3BlUHJlZml4fS1TcWxBZG1pblNlY3JldGAsIHtcclxuICAgICAgc2VjcmV0TmFtZTogYCR7c2NvcGVQcmVmaXh9LXNxbFNlcnZlckFkbWluYCxcclxuICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcclxuICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogJ2FkbWluJyB9KSxcclxuICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogJ3Bhc3N3b3JkJyxcclxuICAgICAgICBleGNsdWRlUHVuY3R1YXRpb246IHRydWUsXHJcbiAgICAgICAgaW5jbHVkZVNwYWNlOiBmYWxzZVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Njb3BlUHJlZml4fS1TcWxBZG1pblNlY3JldE91dHB1dGAsIHtcclxuICAgICAgdmFsdWU6IGFkbWluU2VjcmV0LnNlY3JldE5hbWUsXHJcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Njb3BlUHJlZml4fS1TcWxBZG1pblNlY3JldE5hbWVgXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Njb3BlUHJlZml4fS1TZWNyZXRSZXRyaWV2YWxIaW50YCwge1xyXG4gICAgICB2YWx1ZTogYGF3cyBzZWNyZXRzbWFuYWdlciBnZXQtc2VjcmV0LXZhbHVlIC0tc2VjcmV0LWlkICR7YWRtaW5TZWNyZXQuc2VjcmV0TmFtZX0gLS1xdWVyeSBTZWNyZXRTdHJpbmcgLS1vdXRwdXQgdGV4dGAsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29tbWFuZCB0byByZXRyaWV2ZSBTUUwgYWRtaW4gY3JlZGVudGlhbHMgZnJvbSBTZWNyZXRzIE1hbmFnZXIuJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgZW5jcnlwdGlvbktleSA9IG5ldyBrbXMuS2V5KHRoaXMsIGAke3Njb3BlUHJlZml4fS1SZHNTdG9yYWdlS2V5YCwge1xyXG4gICAgICBlbmFibGVLZXlSb3RhdGlvbjogdHJ1ZVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcGFyYW1ldGVyR3JvdXAgPSBuZXcgcmRzLlBhcmFtZXRlckdyb3VwKHRoaXMsIGAke3Njb3BlUHJlZml4fS1TcWxQYXJhbXNgLCB7XHJcbiAgICAgIGVuZ2luZTogcmRzLkRhdGFiYXNlSW5zdGFuY2VFbmdpbmUuc3FsU2VydmVyV2ViKHsgdmVyc2lvbjogcmRzLlNxbFNlcnZlckVuZ2luZVZlcnNpb24uVkVSXzE2XzAwXzQxODVfM19WMSB9KSxcclxuICAgICAgcGFyYW1ldGVyczoge1xyXG4gICAgICAgICdjb3N0IHRocmVzaG9sZCBmb3IgcGFyYWxsZWxpc20nOiAnMjAnXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHJkc1MzUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBgJHtzY29wZVByZWZpeH0tUmRzUzNSb2xlYCwge1xyXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgncmRzLmFtYXpvbmF3cy5jb20nKVxyXG4gICAgfSk7XHJcbiAgICByZHNTM1JvbGUuYWRkTWFuYWdlZFBvbGljeShpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvblMzUmVhZE9ubHlBY2Nlc3MnKSk7XHJcblxyXG4gICAgY29uc3Qgb3B0aW9uR3JvdXAgPSBuZXcgcmRzLk9wdGlvbkdyb3VwKHRoaXMsIGAke3Njb3BlUHJlZml4fS1TcWxPcHRpb25Hcm91cGAsIHtcclxuICAgICAgZW5naW5lOiByZHMuRGF0YWJhc2VJbnN0YW5jZUVuZ2luZS5zcWxTZXJ2ZXJXZWIoeyB2ZXJzaW9uOiByZHMuU3FsU2VydmVyRW5naW5lVmVyc2lvbi5WRVJfMTZfMDBfNDE4NV8zX1YxIH0pLFxyXG4gICAgICBjb25maWd1cmF0aW9uczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIG5hbWU6ICdTUUxTRVJWRVJfQkFDS1VQX1JFU1RPUkUnLFxyXG4gICAgICAgICAgc2V0dGluZ3M6IHtcclxuICAgICAgICAgICAgSUFNX1JPTEVfQVJOOiByZHNTM1JvbGUucm9sZUFyblxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgXVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcmRzSW5zdGFuY2UgPSBuZXcgcmRzLkRhdGFiYXNlSW5zdGFuY2UodGhpcywgYCR7c2NvcGVQcmVmaXh9LVNxbFNlcnZlckluc3RhbmNlYCwge1xyXG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUluc3RhbmNlRW5naW5lLnNxbFNlcnZlcldlYih7IHZlcnNpb246IHJkcy5TcWxTZXJ2ZXJFbmdpbmVWZXJzaW9uLlZFUl8xNl8wMF80MTg1XzNfVjEgfSksXHJcbiAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5UMywgZWMyLkluc3RhbmNlU2l6ZS5NRURJVU0pLFxyXG4gICAgICB2cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCB9LFxyXG4gICAgICBwdWJsaWNseUFjY2Vzc2libGU6IGZhbHNlLFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW3NlY3VyaXR5R3JvdXBdLFxyXG4gICAgICBjcmVkZW50aWFsczogcmRzLkNyZWRlbnRpYWxzLmZyb21TZWNyZXQoYWRtaW5TZWNyZXQpLFxyXG4gICAgICBhbGxvY2F0ZWRTdG9yYWdlOiA1MDAsXHJcbiAgICAgIG1heEFsbG9jYXRlZFN0b3JhZ2U6IDEwMDAsXHJcbiAgICAgIHN0b3JhZ2VUeXBlOiByZHMuU3RvcmFnZVR5cGUuR1AzLFxyXG4gICAgICBpb3BzOiAzMDAwLFxyXG4gICAgICBzdG9yYWdlVGhyb3VnaHB1dDogMTI1LFxyXG4gICAgICBzdG9yYWdlRW5jcnlwdGVkOiB0cnVlLFxyXG4gICAgICBzdG9yYWdlRW5jcnlwdGlvbktleTogZW5jcnlwdGlvbktleSxcclxuICAgICAgZW5hYmxlUGVyZm9ybWFuY2VJbnNpZ2h0czogdHJ1ZSxcclxuICAgICAgY2xvdWR3YXRjaExvZ3NFeHBvcnRzOiBbJ2FnZW50JywgJ2Vycm9yJ10sXHJcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZmFsc2UsXHJcbiAgICAgIG11bHRpQXo6IGZhbHNlLFxyXG4gICAgICBiYWNrdXBSZXRlbnRpb246IER1cmF0aW9uLnNlY29uZHMoMCksXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b01pbm9yVmVyc2lvblVwZ3JhZGU6IHRydWUsXHJcbiAgICAgIHBhcmFtZXRlckdyb3VwLFxyXG4gICAgICBvcHRpb25Hcm91cCxcclxuICAgICAgaW5zdGFuY2VJZGVudGlmaWVyOiBgJHtzY29wZVByZWZpeH0tc3FsLWluc3RhbmNlYFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcmVzdG9yZUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYCR7c2NvcGVQcmVmaXh9LVJlc3RvcmVMYW1iZGFgLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL3Jlc3RvcmUtc3FsLWpzJykpLFxyXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICB2cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCB9LFxyXG4gICAgICBzZWN1cml0eUdyb3VwczogW3NlY3VyaXR5R3JvdXBdLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIElOU1RBTkNFX0VORFBPSU5UOiByZHNJbnN0YW5jZS5kYkluc3RhbmNlRW5kcG9pbnRBZGRyZXNzLFxyXG4gICAgICAgIEJVQ0tFVF9OQU1FOiAnc3FsLWxhYi1iYWNrdXAnLFxyXG4gICAgICAgIEZJTEVfTkFNRTogJ1N0YWNrT3ZlcmZsb3cuYmFrJyxcclxuICAgICAgICBTRUNSRVRfQVJOOiBhZG1pblNlY3JldC5zZWNyZXRBcm4sXHJcbiAgICAgICAgUk9MRV9BUk46IHJkc1MzUm9sZS5yb2xlQXJuXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGFkbWluU2VjcmV0LmdyYW50UmVhZChyZXN0b3JlTGFtYmRhKTtcclxuICAgIC8vIFJlbW92ZSBSRFMgRGF0YSBBUEkgcGVybWlzc2lvbiBpZiBub3QgdXNpbmcgUkRTIERhdGEgQVBJXHJcbiAgICAvLyByZXN0b3JlTGFtYmRhLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAvLyAgIGFjdGlvbnM6IFsncmRzLWRhdGE6RXhlY3V0ZVN0YXRlbWVudCddLFxyXG4gICAgLy8gICByZXNvdXJjZXM6IFsnKiddXHJcbiAgICAvLyB9KSk7XHJcblxyXG4gICAgc2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShyZXN0b3JlTGFtYmRhLmNvbm5lY3Rpb25zLnNlY3VyaXR5R3JvdXBzWzBdLCBlYzIuUG9ydC50Y3AoMTQzMyksICdBbGxvdyBMYW1iZGEgdG8gYWNjZXNzIFNRTCBTZXJ2ZXInKTtcclxuXHJcbiAgICBjb25zdCBiYXN0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBgJHtzY29wZVByZWZpeH0tQmFzdGlvblNTTVJvbGVgLCB7XHJcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdlYzIuYW1hem9uYXdzLmNvbScpXHJcbiAgICB9KTtcclxuXHJcbiAgICBiYXN0aW9uUm9sZS5hZGRNYW5hZ2VkUG9saWN5KGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU1NNTWFuYWdlZEluc3RhbmNlQ29yZScpKTtcclxuXHJcbiAgICBjb25zdCBiYXN0aW9uU2cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgYCR7c2NvcGVQcmVmaXh9LUJhc3Rpb25TZWN1cml0eUdyb3VwYCwge1xyXG4gICAgICB2cGMsXHJcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQmFzdGlvbiBob3N0IHNlY3VyaXR5IGdyb3VwJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgc2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShiYXN0aW9uU2csIGVjMi5Qb3J0LnRjcCgxNDMzKSwgJ0FsbG93IEJhc3Rpb24gdG8gYWNjZXNzIFNRTCBTZXJ2ZXInKTtcclxuXHJcbiAgICAvLyBTU00gYWdlbnQgaXMgcHJlLWluc3RhbGxlZCBhbmQgYXV0by1zdGFydHMgb24gQW1hem9uIExpbnV4IDIwMjNcclxuICAgIGNvbnN0IGJhc3Rpb25Vc2VyRGF0YSA9IGVjMi5Vc2VyRGF0YS5mb3JMaW51eCgpO1xyXG4gICAgLy8gYmFzdGlvblVzZXJEYXRhLmFkZENvbW1hbmRzKFxyXG4gICAgLy8gICAnc3VkbyBzeXN0ZW1jdGwgZW5hYmxlIGFtYXpvbi1zc20tYWdlbnQnLFxyXG4gICAgLy8gICAnc3VkbyBzeXN0ZW1jdGwgc3RhcnQgYW1hem9uLXNzbS1hZ2VudCdcclxuICAgIC8vICk7XHJcblxyXG4gICAgY29uc3QgYmFzdGlvbkluc3RhbmNlID0gbmV3IGVjMi5JbnN0YW5jZSh0aGlzLCBgJHtzY29wZVByZWZpeH0tQmFzdGlvbkhvc3RgLCB7XHJcbiAgICAgIHZwYyxcclxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXHJcbiAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5UMywgZWMyLkluc3RhbmNlU2l6ZS5NSUNSTyksXHJcbiAgICAgIG1hY2hpbmVJbWFnZTogZWMyLk1hY2hpbmVJbWFnZS5sYXRlc3RBbWF6b25MaW51eDIwMjMoKSxcclxuICAgICAgc2VjdXJpdHlHcm91cDogYmFzdGlvblNnLFxyXG4gICAgICByb2xlOiBiYXN0aW9uUm9sZSxcclxuICAgICAgdXNlckRhdGE6IGJhc3Rpb25Vc2VyRGF0YSxcclxuICAgICAgYmxvY2tEZXZpY2VzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgZGV2aWNlTmFtZTogJy9kZXYveHZkYScsXHJcbiAgICAgICAgICB2b2x1bWU6IGVjMi5CbG9ja0RldmljZVZvbHVtZS5lYnMoOCwge1xyXG4gICAgICAgICAgICBlbmNyeXB0ZWQ6IHRydWVcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgfVxyXG4gICAgICBdXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Njb3BlUHJlZml4fS1TcWxJbnN0YW5jZUVuZHBvaW50YCwge1xyXG4gICAgICB2YWx1ZTogcmRzSW5zdGFuY2UuZGJJbnN0YW5jZUVuZHBvaW50QWRkcmVzcyxcclxuICAgICAgZXhwb3J0TmFtZTogYCR7c2NvcGVQcmVmaXh9LVNxbEluc3RhbmNlRW5kcG9pbnRgXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Njb3BlUHJlZml4fS1Qb3J0Rm9yd2FyZGluZ0hpbnRgLCB7XHJcbiAgICAgIHZhbHVlOiBgYXdzIHNzbSBzdGFydC1zZXNzaW9uIC0tdGFyZ2V0ICR7YmFzdGlvbkluc3RhbmNlLmluc3RhbmNlSWR9IC0tZG9jdW1lbnQtbmFtZSBBV1MtU3RhcnRQb3J0Rm9yd2FyZGluZ1Nlc3Npb25Ub1JlbW90ZUhvc3QgLS1wYXJhbWV0ZXJzIGhvc3Q9XCIke3Jkc0luc3RhbmNlLmRiSW5zdGFuY2VFbmRwb2ludEFkZHJlc3N9XCIscG9ydE51bWJlcj1cIjE0MzNcIixsb2NhbFBvcnROdW1iZXI9XCIxNDMzXCJgLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbW1hbmQgdG8gc3RhcnQgYSBwb3J0IGZvcndhcmRpbmcgc2Vzc2lvbiB0byBTUUwgU2VydmVyIHZpYSBiYXN0aW9uIGhvc3QuJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtzY29wZVByZWZpeH0tTGFtYmRhSW52b2tlQ29tbWFuZGAsIHtcclxuICAgICAgdmFsdWU6IGBhd3MgbGFtYmRhIGludm9rZSAtLWZ1bmN0aW9uLW5hbWUgJHtyZXN0b3JlTGFtYmRhLmZ1bmN0aW9uTmFtZX0gLS1wYXlsb2FkICd7fScgcmVzcG9uc2UuanNvbmAsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29tbWFuZCB0byBtYW51YWxseSB0cmlnZ2VyIHJlc3RvcmUgTGFtYmRhLidcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=