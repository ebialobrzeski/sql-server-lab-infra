# SQL Server Training on AWS with CDK

This project provisions an isolated environment on AWS for SQL Server training using AWS CDK. It sets up a **VPC**, **Amazon RDS SQL Server instance**, **bastion EC2 host**, and a **Lambda function** that can restore a `.bak` file from an S3 bucket.

---

## 📦 Prerequisites

- Node.js 18+
- AWS CLI with a configured profile (e.g. using `aws-vault`)
- CDK CLI (`npm install -g aws-cdk`)
- Git
- `npm install` run at the project root

---

## ✨ Setup (First Time)

1. **Clone the repo**

   ```bash
   git clone <your-repo-url>
   cd sql-server-training
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

---

## 💪 Usage

### 🧠 Choose your scope

Each deployment can be isolated by **scope**, allowing multiple people to deploy into the same AWS account:

```bash
aws-vault exec <your-profile> -- cdk deploy --context scope=yourname
```

### 🖑 Scoped Destroy

To destroy your stack (and only yours):

```bash
aws-vault exec <your-profile> -- cdk destroy --context scope=yourname
```

---

## 🛠️ What It Creates

- **Private VPC** with isolated subnets and VPC endpoints for SSM, Secrets Manager, etc.
- **Amazon RDS SQL Server Web Edition**
  - 500GB GP3 encrypted volume
  - `cost threshold for parallelism = 20`
  - Backup disabled
  - Performance Insights enabled
- **EC2 Bastion Host** (SSM managed, no SSH required)
- **Lambda function** that restores a `.bak` file from a specified S3 bucket
- **Secrets Manager secret** for RDS admin credentials

---

## 🔐 Secret Retrieval

To get the SQL Server admin credentials:

```bash
aws secretsmanager get-secret-value \
  --secret-id <your-scope>-sqlServerAdmin \
  --query SecretString \
  --output text
```

---

## 🔌 Port Forwarding to RDS

Connect to the RDS instance through the bastion host:

```bash
aws ssm start-session \
  --target <BastionInstanceId> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters host="<RdsEndpoint>",portNumber="1433",localPortNumber="1433"
```

This command is also printed as part of the CDK outputs.

---

## 💾 Restoring the Database

The Lambda restore function expects the `.bak` file in the S3 bucket:

```bash
s3://sql-lab-backup/StackOverflow.bak
```

### ✅ Triggering Restore

To invoke manually:

```bash
aws lambda invoke \
  --function-name <your-scope>-RestoreLambda \
  --payload '{}' \
  response.json
```

This command is also printed in the CDK outputs.

---

## 📁 Project Structure

```
sql-server-training/
│
├── assets/
│   └── StackOverflow.bak         # Your database backup file
│
├── bin/
│   └── sql-server-training.ts    # CDK app entrypoint
│
├── lib/
│   └── sql-server-training-stack.ts  # CDK stack definition
│
├── lambda/
│   └── restore-sql-js/
│       ├── index.js              # Lambda restore logic
│       └── package.json          # Lambda dependencies
│
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🪄 .gitignore (includes large files and build artifacts)

```
node_modules/
cdk.out/
.cdk.staging/
assets/StackOverflow.bak
*.js
*.d.ts
!jest.config.js
```

---

## 📚 References

- [Securely restore RDS SQL Server from S3](https://docs.aws.amazon.com/dms/latest/sbs/chap-manageddatabases.sql-server-rds-sql-server-full-load-backup-restore.html)
- [CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/home.html)

---

## ✍️ Author

Emil Bialobrzeski — [GitHub](https://github.com/<your-username>)

